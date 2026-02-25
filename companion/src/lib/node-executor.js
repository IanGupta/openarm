const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { sendWakeOnLan } = require("./wol");
const {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_SESSION_KEY,
  OUTPUT_CAP,
  OUTPUT_EVENT_TAIL
} = require("./constants");
const {
  sanitizeText,
  safeJsonParse,
  truncateOutput
} = require("./util");

function getNodeCommands(enableExtendedCommands) {
  const base = [
    "system.run",
    "system.which",
    "system.execApprovals.get",
    "system.execApprovals.set"
  ];
  if (!enableExtendedCommands) {
    return base;
  }
  return [
    ...base,
    "openarm.file.read",
    "openarm.file.write",
    "openarm.file.list",
    "openarm.file.stat",
    "openarm.wol.wake"
  ];
}

function defaultExecApprovals() {
  return {
    defaults: {
      security: "full",
      ask: "off",
      autoAllowSkills: false
    },
    allowlist: []
  };
}

function normalizeExecApprovals(file) {
  const defaults = file?.defaults && typeof file.defaults === "object" ? file.defaults : {};
  const security =
    defaults.security === "deny" || defaults.security === "allowlist" || defaults.security === "full"
      ? defaults.security
      : "full";
  const ask = defaults.ask === "off" || defaults.ask === "on-miss" || defaults.ask === "always" ? defaults.ask : "off";
  const allowlistRaw = Array.isArray(file?.allowlist) ? file.allowlist : [];
  const allowlist = allowlistRaw
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }
      if (entry && typeof entry.pattern === "string") {
        return entry.pattern.trim();
      }
      return "";
    })
    .filter(Boolean);
  return {
    defaults: {
      security,
      ask,
      autoAllowSkills: Boolean(defaults.autoAllowSkills)
    },
    allowlist
  };
}

function execApprovalsHash(file) {
  return crypto.createHash("sha256").update(JSON.stringify(file)).digest("hex");
}

function createExecApprovalsStore(approvalsPath) {
  return {
    async readSnapshot() {
      try {
        if (!fsSync.existsSync(approvalsPath)) {
          const file = defaultExecApprovals();
          return {
            path: approvalsPath,
            exists: false,
            hash: execApprovalsHash(file),
            file
          };
        }
        const raw = await fs.readFile(approvalsPath, "utf8");
        const file = normalizeExecApprovals(safeJsonParse(raw, {}));
        return {
          path: approvalsPath,
          exists: true,
          hash: execApprovalsHash(file),
          file
        };
      } catch {
        const file = defaultExecApprovals();
        return {
          path: approvalsPath,
          exists: false,
          hash: execApprovalsHash(file),
          file
        };
      }
    },
    async write(file) {
      await fs.mkdir(path.dirname(approvalsPath), { recursive: true });
      await fs.writeFile(
        approvalsPath,
        `${JSON.stringify(normalizeExecApprovals(file), null, 2)}\n`,
        "utf8"
      );
    }
  };
}

function sanitizeEnv(overrides) {
  const merged = { ...process.env };
  if (!overrides || typeof overrides !== "object") {
    return merged;
  }
  const blockedKeys = new Set(["NODE_OPTIONS", "PYTHONHOME", "PYTHONPATH", "PERL5LIB", "PERL5OPT", "RUBYOPT", "PATH"]);
  const blockedPrefixes = ["DYLD_", "LD_"];
  for (const [rawKey, rawValue] of Object.entries(overrides)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    const upper = key.toUpperCase();
    if (blockedKeys.has(upper) || blockedPrefixes.some((prefix) => upper.startsWith(prefix))) {
      continue;
    }
    merged[key] = String(rawValue);
  }
  return merged;
}

function resolveExecutable(bin, env) {
  if (!bin || bin.includes("/") || bin.includes("\\")) {
    return null;
  }
  const pathEnv = env?.PATH || env?.Path || process.env.PATH || process.env.Path || "";
  const pathDirs = pathEnv.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT || process.env.PathExt || ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .map((entry) => entry.toLowerCase())
      : [""];
  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, bin + ext);
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function allowlistPatternMatches(pattern, candidate) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  const regex = new RegExp(`^${escaped}$`, process.platform === "win32" ? "i" : "");
  return regex.test(candidate);
}

function allowlistSatisfied(argv, env, allowlist) {
  const command = argv[0] || "";
  if (!command) {
    return false;
  }
  const resolved = path.isAbsolute(command) ? command : resolveExecutable(command, env);
  const base = path.basename(command);
  const candidates = [command, base, resolved].filter(Boolean);
  for (const pattern of allowlist) {
    for (const candidate of candidates) {
      if (allowlistPatternMatches(pattern, candidate)) {
        return true;
      }
    }
  }
  return false;
}

async function runCommand(argv, cwd, env, timeoutMs) {
  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let outputLen = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    const onChunk = (chunk, streamType) => {
      if (outputLen >= OUTPUT_CAP) {
        truncated = true;
        return;
      }
      const remaining = OUTPUT_CAP - outputLen;
      const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
      const text = slice.toString("utf8");
      outputLen += slice.length;
      if (streamType === "stdout") {
        stdout += text;
      } else {
        stderr += text;
      }
      if (chunk.length > remaining) {
        truncated = true;
      }
    };

    child.stdout?.on("data", (chunk) => onChunk(chunk, "stdout"));
    child.stderr?.on("data", (chunk) => onChunk(chunk, "stderr"));

    let timer = null;
    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          // Ignore kill failures.
        }
      }, timeoutMs);
    }

    const finish = (exitCode, errorMessage) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      resolve({
        exitCode,
        timedOut,
        success: exitCode === 0 && !timedOut && !errorMessage,
        stdout,
        stderr,
        error: errorMessage || null,
        truncated
      });
    };

    child.on("error", (error) => {
      finish(undefined, error.message);
    });

    child.on("exit", (code) => {
      finish(typeof code === "number" ? code : undefined, null);
    });
  });
}

function coerceNodeInvokePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const id = sanitizeText(payload.id, 120);
  const nodeId = sanitizeText(payload.nodeId, 160);
  const command = sanitizeText(payload.command, 160);
  if (!id || !nodeId || !command) {
    return null;
  }
  const paramsJSON =
    typeof payload.paramsJSON === "string"
      ? payload.paramsJSON
      : payload.params !== undefined
        ? JSON.stringify(payload.params)
        : null;
  return {
    id,
    nodeId,
    command,
    paramsJSON,
    timeoutMs: typeof payload.timeoutMs === "number" ? payload.timeoutMs : null,
    idempotencyKey: sanitizeText(payload.idempotencyKey, 160) || null
  };
}

function decodeParams(rawParamsJson) {
  if (!rawParamsJson) {
    throw new Error("INVALID_REQUEST: paramsJSON required");
  }
  const params = safeJsonParse(rawParamsJson, null);
  if (!params || typeof params !== "object") {
    throw new Error("INVALID_REQUEST: paramsJSON must be a JSON object");
  }
  return params;
}

function buildNodeInvokeResultParams(frame, result) {
  const params = {
    id: frame.id,
    nodeId: frame.nodeId,
    ok: Boolean(result.ok)
  };
  if (result.payload !== undefined) {
    params.payload = result.payload;
  }
  if (typeof result.payloadJSON === "string") {
    params.payloadJSON = result.payloadJSON;
  }
  if (result.error) {
    params.error = result.error;
  }
  return params;
}

async function executeNodeCommand({ frame, approvalsStore, sendNodeEvent }) {
  const command = frame.command;

  if (command === "system.execApprovals.get") {
    const snapshot = await approvalsStore.readSnapshot();
    return { ok: true, payloadJSON: JSON.stringify(snapshot) };
  }

  if (command === "system.execApprovals.set") {
    const params = decodeParams(frame.paramsJSON);
    if (!params.file || typeof params.file !== "object") {
      throw new Error("INVALID_REQUEST: exec approvals file required");
    }
    const current = await approvalsStore.readSnapshot();
    const baseHash = sanitizeText(params.baseHash, 200);
    if (current.exists && !baseHash) {
      throw new Error("INVALID_REQUEST: exec approvals base hash required; reload and retry");
    }
    if (current.exists && baseHash && baseHash !== current.hash) {
      throw new Error("INVALID_REQUEST: exec approvals changed; reload and retry");
    }
    await approvalsStore.write(params.file);
    const next = await approvalsStore.readSnapshot();
    return { ok: true, payloadJSON: JSON.stringify(next) };
  }

  if (command === "system.which") {
    const params = decodeParams(frame.paramsJSON);
    if (!Array.isArray(params.bins)) {
      throw new Error("INVALID_REQUEST: bins required");
    }
    const env = sanitizeEnv(undefined);
    const found = {};
    for (const rawBin of params.bins) {
      const bin = sanitizeText(rawBin, 160);
      if (!bin) {
        continue;
      }
      const resolved = resolveExecutable(bin, env);
      if (resolved) {
        found[bin] = resolved;
      }
    }
    return { ok: true, payloadJSON: JSON.stringify({ bins: found }) };
  }

  if (
    command === "openarm.file.read" ||
    command === "openarm.file.write" ||
    command === "openarm.file.list" ||
    command === "openarm.file.stat"
  ) {
    const params = decodeParams(frame.paramsJSON);
    const targetPath = sanitizeText(params.path, 4096);
    if (!targetPath) {
      throw new Error("INVALID_REQUEST: path required");
    }
    const absolutePath = path.resolve(targetPath);

    if (command === "openarm.file.read") {
      const encoding = sanitizeText(params.encoding, 40) || "utf8";
      const content = await fs.readFile(absolutePath, encoding);
      return {
        ok: true,
        payloadJSON: JSON.stringify({
          path: absolutePath,
          encoding,
          content
        })
      };
    }

    if (command === "openarm.file.write") {
      const encoding = sanitizeText(params.encoding, 40) || "utf8";
      const content = (params.content ?? "").toString();
      const append = Boolean(params.append);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      if (append) {
        await fs.appendFile(absolutePath, content, { encoding });
      } else {
        await fs.writeFile(absolutePath, content, { encoding });
      }
      return {
        ok: true,
        payloadJSON: JSON.stringify({
          path: absolutePath,
          bytesWritten: Buffer.byteLength(content, encoding),
          append
        })
      };
    }

    if (command === "openarm.file.list") {
      const depth = Math.min(Math.max(Number(params.depth) || 1, 1), 4);
      const entries = [];
      for (const item of (await fs.readdir(absolutePath, { withFileTypes: true })).slice(0, 500)) {
        const fullPath = path.join(absolutePath, item.name);
        const stats = await fs.stat(fullPath);
        entries.push({
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? "directory" : "file",
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          depth
        });
      }
      return {
        ok: true,
        payloadJSON: JSON.stringify({
          path: absolutePath,
          depth,
          entries
        })
      };
    }

    const stats = await fs.stat(absolutePath);
    return {
      ok: true,
      payloadJSON: JSON.stringify({
        path: absolutePath,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      })
    };
  }

  if (command === "openarm.wol.wake") {
    const params = decodeParams(frame.paramsJSON);
    const mac = sanitizeText(params.mac, 64);
    if (!mac) {
      throw new Error("INVALID_REQUEST: mac required");
    }
    const address = sanitizeText(params.address || params.broadcast || params.broadcastAddress, 120) || "";
    const port = Number(params.port) > 0 ? Number(params.port) : 9;
    const result = await sendWakeOnLan({
      mac,
      address,
      port
    });
    return {
      ok: true,
      payloadJSON: JSON.stringify(result)
    };
  }

  if (command !== "system.run") {
    return {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "command not supported"
      }
    };
  }

  const params = decodeParams(frame.paramsJSON);
  if (!Array.isArray(params.command) || params.command.length === 0) {
    throw new Error("INVALID_REQUEST: command required");
  }

  const argv = params.command.map((entry) => String(entry));
  const cmdText = sanitizeText(params.rawCommand, 4000) || argv.join(" ");
  const sessionKey = sanitizeText(params.sessionKey, 160) || DEFAULT_SESSION_KEY;
  const runId = sanitizeText(params.runId, 160) || crypto.randomUUID();
  const env = sanitizeEnv(params.env ?? undefined);
  const timeoutMs =
    typeof params.timeoutMs === "number" && params.timeoutMs > 0
      ? Math.min(params.timeoutMs, 180_000)
      : DEFAULT_TIMEOUT_MS;

  const snapshot = await approvalsStore.readSnapshot();
  const security = snapshot.file.defaults.security;
  const ask = snapshot.file.defaults.ask;
  const approvedByAsk =
    params.approved === true ||
    params.approvalDecision === "allow-once" ||
    params.approvalDecision === "allow-always";
  const allowedByList = allowlistSatisfied(argv, env, snapshot.file.allowlist);

  const deny = async (reason, message) => {
    await sendNodeEvent("exec.denied", {
      sessionKey,
      runId,
      host: "node",
      command: cmdText,
      reason
    });
    return {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message
      }
    };
  };

  if (params.needsScreenRecording === true) {
    return await deny("permission:screenRecording", "PERMISSION_MISSING: screenRecording");
  }
  if (security === "deny") {
    return await deny("security=deny", "SYSTEM_RUN_DISABLED: security=deny");
  }
  if (ask === "always" && !approvedByAsk) {
    return await deny("approval-required", "SYSTEM_RUN_DENIED: approval required");
  }
  if (security === "allowlist" && !allowedByList && !approvedByAsk) {
    return await deny("allowlist-miss", "SYSTEM_RUN_DENIED: allowlist miss");
  }
  if (ask === "on-miss" && security === "allowlist" && !allowedByList && !approvedByAsk) {
    return await deny("approval-required", "SYSTEM_RUN_DENIED: approval required");
  }

  if (params.approvalDecision === "allow-always" && security === "allowlist" && argv[0]) {
    const resolved = path.isAbsolute(argv[0]) ? argv[0] : resolveExecutable(argv[0], env) || argv[0];
    if (!snapshot.file.allowlist.includes(resolved)) {
      snapshot.file.allowlist.push(resolved);
      await approvalsStore.write(snapshot.file);
    }
  }

  const result = await runCommand(argv, sanitizeText(params.cwd, 2000) || undefined, env, timeoutMs);
  if (result.truncated) {
    const suffix = "... (truncated)";
    if (result.stderr.trim()) {
      result.stderr = `${result.stderr}\n${suffix}`;
    } else {
      result.stdout = `${result.stdout}\n${suffix}`;
    }
  }

  const output = [result.stdout, result.stderr, result.error].filter(Boolean).join("\n");
  const outputTail = output ? truncateOutput(output, OUTPUT_EVENT_TAIL).text : "";
  await sendNodeEvent("exec.finished", {
    sessionKey,
    runId,
    host: "node",
    command: cmdText,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    success: result.success,
    output: outputTail
  });

  return {
    ok: true,
    payloadJSON: JSON.stringify({
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error
    })
  };
}

module.exports = {
  getNodeCommands,
  coerceNodeInvokePayload,
  buildNodeInvokeResultParams,
  createExecApprovalsStore,
  executeNodeCommand
};
