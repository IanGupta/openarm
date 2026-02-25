const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const os = require("node:os");
const fs = require("node:fs/promises");
const { spawn, execFileSync } = require("node:child_process");
const {
  NODE_CLIENT,
  OPERATOR_CLIENT
} = require("./lib/constants");
const {
  nowIso,
  randomId,
  sanitizeText,
  safeJsonParse,
  makeErrorMessage
} = require("./lib/util");
const {
  loadOrCreateDeviceIdentity
} = require("./lib/device-identity");
const { GatewayRpcClient } = require("./lib/gateway-rpc-client");
const {
  getNodeCommands,
  coerceNodeInvokePayload,
  buildNodeInvokeResultParams,
  createExecApprovalsStore,
  executeNodeCommand
} = require("./lib/node-executor");
const { sendWakeOnLan } = require("./lib/wol");
const {
  createDefaultSettings,
  normalizeSettings,
  loadSettings,
  saveSettings
} = require("./lib/settings-store");
const { detectOpenClawEnvironment } = require("./lib/openclaw-detect");
const {
  createHubPairPinService,
  normalizePairGateway,
  discoverPairPinHubs,
  redeemPairPin
} = require("./lib/pair-pin");

let mainWindow = null;
let nodeClient = null;
let operatorClient = null;
let approvalsStore = null;
let identity = null;
let pairPinService = null;
let gatewayRelayServer = null;
let gatewayRelaySpec = null;
let tray = null;
let isQuitting = false;

const OPENARM_NODE_COMMANDS = [
  "openarm.file.read",
  "openarm.file.write",
  "openarm.file.list",
  "openarm.file.stat",
  "openarm.wol.wake"
];
const OPENARM_AGENT_INTEGRATION_VERSION = 1;

const OPENARM_TOOLS_MD_BLOCK_START = "<!-- OPENARM-INTEGRATION:START -->";
const OPENARM_TOOLS_MD_BLOCK_END = "<!-- OPENARM-INTEGRATION:END -->";
let openArmAgentIntegrationPromise = null;

const state = {
  settings: createDefaultSettings(),
  bootstrap: {
    installerRole: "",
    openclaw: null
  },
  nodeConnection: {
    status: "disconnected",
    lastError: "",
    connectedAt: null,
    nodeId: null,
    reconnectAttempt: 0
  },
  operatorConnection: {
    status: "disconnected",
    lastError: "",
    connectedAt: null,
    reconnectAttempt: 0
  },
  nodes: [],
  devicePairing: {
    pending: [],
    paired: [],
    fetchedAt: null
  },
  pairPin: {
    active: null,
    lastEvent: null,
    relay: {
      discoveryPort: null,
      redeemPort: null,
      hostHints: []
    }
  }
};

function configPath() {
  return path.join(app.getPath("userData"), "openarm.openclaw.config.json");
}

function identityPath() {
  return path.join(app.getPath("userData"), "identity", "device.json");
}

function deviceAuthPath() {
  return path.join(app.getPath("userData"), "identity", "device-auth-tokens.json");
}

function approvalsPath() {
  return path.join(app.getPath("userData"), "exec-approvals.json");
}

function normalizeRole(value) {
  const mode = sanitizeText(value, 20).toLowerCase();
  return mode === "arm" || mode === "hub" ? mode : "";
}

function normalizePairHost(value) {
  const raw = sanitizeText(value, 300);
  if (!raw) {
    return "";
  }
  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }
  if (raw === "::1") {
    return "127.0.0.1";
  }
  return raw;
}

function normalizeHostForCompare(value) {
  return normalizePairHost(value).toLowerCase().replace(/^\[(.*)\]$/, "$1");
}

function isLoopbackLikeHost(value) {
  const host = normalizeHostForCompare(value);
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "::" ||
    host === "0.0.0.0"
  );
}

function rewriteGatewayUrlForArm(gatewayUrl, controllerHost) {
  const original = sanitizeText(gatewayUrl, 2048);
  const host = normalizePairHost(controllerHost);
  if (!original || !host) {
    return {
      url: original || "",
      rewritten: false
    };
  }
  if (isLoopbackLikeHost(host)) {
    return {
      url: original,
      rewritten: false
    };
  }
  let parsed;
  try {
    parsed = new URL(original);
  } catch {
    return {
      url: original,
      rewritten: false
    };
  }
  if (!isLoopbackLikeHost(parsed.hostname)) {
    return {
      url: original,
      rewritten: false
    };
  }
  parsed.hostname = host;
  return {
    url: parsed.toString(),
    rewritten: true
  };
}

function parseGatewayEndpoint(gatewayUrl) {
  const raw = sanitizeText(gatewayUrl, 2048);
  if (!raw) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return null;
  }
  const host = sanitizeText(parsed.hostname, 255);
  if (!host) {
    return null;
  }
  const port = Number(parsed.port) || (parsed.protocol === "wss:" ? 443 : 80);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return null;
  }
  return {
    url: raw,
    host,
    port,
    protocol: parsed.protocol
  };
}

function buildGatewayUnreachableMessage(gatewayUrl, endpoint, errorCode = "") {
  const base = `Gateway is not reachable at ${gatewayUrl}.`;
  const codeText = errorCode ? ` (${errorCode})` : "";
  if (!endpoint) {
    return `${base} Check the gateway URL and network connectivity${codeText}.`;
  }
  const host = normalizeHostForCompare(endpoint.host);
  if (
    host !== "127.0.0.1" &&
    host !== "localhost" &&
    host !== "::1" &&
    host !== "::" &&
    process.platform === "win32"
  ) {
    return `${base} Ensure port ${endpoint.port} on the Controller is reachable from this device${codeText}. ` +
      "If OpenClaw runs in WSL, expose the gateway to LAN (bind host 0.0.0.0 and add Windows portproxy/firewall rule).";
  }
  return `${base} Ensure OpenClaw gateway is running and listening on ${endpoint.host}:${endpoint.port}${codeText}.`;
}

async function checkGatewayReachability(gatewayUrl, timeoutMs = 3000) {
  const endpoint = parseGatewayEndpoint(gatewayUrl);
  if (!endpoint) {
    return {
      ok: false,
      message: "Gateway URL must be a valid ws:// or wss:// URL."
    };
  }
  const timeout = Math.max(600, Math.min(10_000, Math.floor(Number(timeoutMs) || 3000)));
  return await new Promise((resolve) => {
    let settled = false;
    const socket = new net.Socket();

    const finish = (ok, errorCode = "") => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (ok) {
        resolve({ ok: true, endpoint });
      } else {
        resolve({
          ok: false,
          endpoint,
          errorCode,
          message: buildGatewayUnreachableMessage(gatewayUrl, endpoint, errorCode)
        });
      }
    };

    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "TIMEOUT"));
    socket.once("error", (error) => {
      const code = sanitizeText(error?.code, 40) || sanitizeText(error?.message, 120) || "CONNECT_ERROR";
      finish(false, code);
    });
    socket.connect(endpoint.port, endpoint.host);
  });
}

function listLanIpv4Hosts() {
  const interfaces = os.networkInterfaces();
  const hosts = [];
  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") {
        continue;
      }
      if (entry.address) {
        hosts.push(entry.address);
      }
    }
  }
  return [...new Set(hosts)];
}

function ipv4Priority(host) {
  const value = sanitizeText(host, 120);
  if (!value) {
    return 999;
  }
  if (value.startsWith("192.168.")) {
    return 1;
  }
  if (value.startsWith("10.")) {
    return 2;
  }
  if (value.startsWith("172.")) {
    const second = Number(value.split(".")[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      return 3;
    }
  }
  return 9;
}

function pickPreferredLanHost() {
  const hosts = listLanIpv4Hosts();
  if (!hosts.length) {
    return "";
  }
  return [...hosts].sort((a, b) => ipv4Priority(a) - ipv4Priority(b))[0];
}

function runProcess(file, args, options = {}) {
  const timeoutMs = Math.max(1000, Math.min(120_000, Number(options.timeoutMs) || 12_000));
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let child;
    try {
      child = spawn(file, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      resolve({
        code: -1,
        stdout: "",
        stderr: "",
        error
      });
      return;
    }

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(payload);
    };

    const timeout = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // Ignore kill failures.
      }
      finish({
        code: -1,
        stdout,
        stderr,
        error: new Error("Process timed out.")
      });
    }, timeoutMs);
    timeout.unref?.();

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      finish({
        code: -1,
        stdout,
        stderr,
        error
      });
    });
    child.once("close", (code) => {
      finish({
        code: Number.isFinite(code) ? code : -1,
        stdout,
        stderr
      });
    });
  });
}

function parseWslDistroNames(stdout) {
  return sanitizeText(stdout, 20000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^\*/, "").trim())
    .filter(Boolean);
}

async function runWslBash(command, distro = "", timeoutMs = 20_000) {
  const args = [];
  if (distro) {
    args.push("-d", distro);
  }
  args.push("bash", "-lc", command);
  return await runProcess("wsl.exe", args, { timeoutMs });
}

async function probeWslOpenClawCli() {
  const list = await runProcess("wsl.exe", ["-l", "-q"], { timeoutMs: 10_000 });
  const distros = list.code === 0 ? parseWslDistroNames(list.stdout) : [];
  const probeScript = 'BIN="$(command -v openclaw || command -v clawdbot || true)"; if [ -n "$BIN" ]; then echo "$BIN"; fi';
  const candidates = ["", ...distros];
  for (const distro of candidates) {
    const probe = await runWslBash(probeScript, distro, 10_000);
    const cliPath = sanitizeText(probe.stdout, 4000).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
    if (probe.code === 0 && cliPath) {
      return {
        distro: distro || "",
        cliPath,
        distros
      };
    }
  }
  return {
    distro: "",
    cliPath: "",
    distros,
    probeError:
      list.code !== 0
        ? sanitizeText(list.stderr, 400) || sanitizeText(list.error?.message, 400) || "Failed to enumerate WSL distributions."
        : ""
  };
}

function parseTaggedOutputLine(text, key) {
  const lines = sanitizeText(text, 50_000).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(`${key}=`)) {
      continue;
    }
    return trimmed.slice(key.length + 1).trim();
  }
  return "";
}

async function applyWslGatewayLanFix({ distro, port }) {
  const safePort = Number.isFinite(port) && port > 0 ? Math.floor(port) : 18789;
  const script = `
set +e
BIN="$(command -v openclaw || command -v clawdbot || true)"
if [ -n "$BIN" ]; then
  "$BIN" config set gateway.bind lan >/dev/null 2>&1 || true
  "$BIN" config set gateway.port ${safePort} >/dev/null 2>&1 || true
fi
if command -v python3 >/dev/null 2>&1; then
python3 - <<'PY'
import json, os
paths = []
for candidate in [
    os.environ.get("OPENCLAW_CONFIG_PATH"),
    os.environ.get("CLAWDBOT_CONFIG_PATH"),
    os.path.expanduser("~/.openclaw/openclaw.json"),
    os.path.expanduser("~/.clawdbot/clawdbot.json"),
    os.path.expanduser("~/.moldbot/moldbot.json"),
    os.path.expanduser("~/.moltbot/moltbot.json"),
]:
    if candidate and candidate not in paths:
        paths.append(candidate)
updated = []
for path in paths:
    if not os.path.exists(path):
        continue
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        continue
    if not isinstance(data, dict):
        continue
    gateway = data.get("gateway")
    if not isinstance(gateway, dict):
        gateway = {}
        data["gateway"] = gateway
    changed = False
    if gateway.get("bind") != "lan":
        gateway["bind"] = "lan"
        changed = True
    if int(gateway.get("port") or 0) != ${safePort}:
        gateway["port"] = ${safePort}
        changed = True
    if changed:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
            handle.write("\\n")
        updated.append(path)
print("OPENARM_UPDATED=" + ";".join(updated))
PY
fi
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload >/dev/null 2>&1 || true
  for svc in openclaw-gateway.service clawdbot-gateway.service moldbot-gateway.service moltbot-gateway.service; do
    systemctl --user restart "$svc" >/dev/null 2>&1 || true
  done
fi
LISTEN="$(ss -ltn 2>/dev/null | awk '$4 ~ /:${safePort}$/ {print $4}' | paste -sd',' -)"
echo "OPENARM_LISTEN=\${LISTEN:-}"
`;
  const result = await runWslBash(script, distro, 45_000);
  const updatedRaw = parseTaggedOutputLine(result.stdout, "OPENARM_UPDATED");
  const listenRaw = parseTaggedOutputLine(result.stdout, "OPENARM_LISTEN");
  return {
    ok: result.code === 0,
    distro,
    updatedConfigs: updatedRaw ? updatedRaw.split(";").map((line) => line.trim()).filter(Boolean) : [],
    listenSummary: listenRaw || "",
    errorMessage:
      sanitizeText(result.stderr, 800) || sanitizeText(result.error?.message, 800) || ""
  };
}

async function stopGatewayRelay() {
  if (!gatewayRelayServer) {
    gatewayRelaySpec = null;
    return;
  }
  await new Promise((resolve) => {
    try {
      gatewayRelayServer.close(() => resolve());
    } catch {
      resolve();
    }
  });
  gatewayRelayServer = null;
  gatewayRelaySpec = null;
}

async function ensureGatewayRelay({ listenHost, listenPort, targetHost, targetPort }) {
  const normalizedListenHost = sanitizeText(listenHost, 200) || "0.0.0.0";
  const normalizedTargetHost = sanitizeText(targetHost, 200) || "127.0.0.1";
  const normalizedListenPort = Number(listenPort);
  const normalizedTargetPort = Number(targetPort);
  if (
    !Number.isFinite(normalizedListenPort) ||
    normalizedListenPort <= 0 ||
    !Number.isFinite(normalizedTargetPort) ||
    normalizedTargetPort <= 0
  ) {
    throw new Error("Invalid relay port.");
  }
  const spec = {
    listenHost: normalizedListenHost,
    listenPort: Math.floor(normalizedListenPort),
    targetHost: normalizedTargetHost,
    targetPort: Math.floor(normalizedTargetPort)
  };
  if (
    gatewayRelayServer &&
    gatewayRelaySpec &&
    gatewayRelaySpec.listenHost === spec.listenHost &&
    gatewayRelaySpec.listenPort === spec.listenPort &&
    gatewayRelaySpec.targetHost === spec.targetHost &&
    gatewayRelaySpec.targetPort === spec.targetPort
  ) {
    return {
      started: false,
      alreadyRunning: true,
      spec
    };
  }
  if (gatewayRelayServer) {
    await stopGatewayRelay();
  }
  const server = net.createServer((socket) => {
    const upstream = net.createConnection({
      host: spec.targetHost,
      port: spec.targetPort
    });
    socket.on("error", () => {});
    upstream.on("error", () => {
      socket.destroy();
    });
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  return await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn) => (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      fn(payload);
    };
    server.once(
      "error",
      finish((error) => {
        try {
          server.close();
        } catch {
          // Ignore close failures.
        }
        reject(error);
      })
    );
    server.listen(spec.listenPort, spec.listenHost, finish(() => {
      gatewayRelayServer = server;
      gatewayRelaySpec = spec;
      resolve({
        started: true,
        alreadyRunning: false,
        spec
      });
    }));
  });
}

async function runGatewayAutoFix(payload = {}) {
  const requestedGatewayUrl = sanitizeText(payload?.gatewayUrl, 2048) || state.settings.gatewayUrl || "";
  const endpoint = parseGatewayEndpoint(requestedGatewayUrl);
  if (!endpoint) {
    throw new Error("Gateway URL must be a valid ws:// or wss:// URL.");
  }
  const operations = [];
  const warnings = [];
  const localLanHost = pickPreferredLanHost();
  const result = {
    reachable: false,
    changed: false,
    suggestedGatewayUrl: requestedGatewayUrl,
    localLanHost,
    operations,
    warnings,
    wsl: null,
    relay: null
  };

  if (!isLoopbackLikeHost(endpoint.host)) {
    const reachable = await checkGatewayReachability(requestedGatewayUrl, 2500);
    result.reachable = reachable.ok;
    operations.push("Gateway URL already points to a non-loopback host.");
    if (!reachable.ok) {
      warnings.push(reachable.message);
    }
    return result;
  }

  if (!localLanHost) {
    warnings.push("No LAN IPv4 address detected on this device.");
    return result;
  }

  const lanGateway = rewriteGatewayUrlForArm(requestedGatewayUrl, localLanHost);
  if (lanGateway.rewritten && lanGateway.url) {
    result.suggestedGatewayUrl = lanGateway.url;
  }

  if (process.platform === "win32") {
    const probe = await probeWslOpenClawCli();
    if (probe?.cliPath) {
      const label = probe.distro ? `${probe.distro}` : "default WSL distro";
      operations.push(`WSL OpenClaw CLI found in ${label}.`);
      const wslFix = await applyWslGatewayLanFix({
        distro: probe.distro,
        port: endpoint.port
      });
      result.wsl = wslFix;
      if (wslFix.updatedConfigs.length) {
        result.changed = true;
        operations.push(`Updated WSL gateway config in ${wslFix.updatedConfigs.length} file(s).`);
      } else {
        operations.push("WSL gateway config update attempted.");
      }
      if (wslFix.listenSummary) {
        operations.push(`WSL listener check: ${wslFix.listenSummary}`);
      }
      if (!wslFix.ok && wslFix.errorMessage) {
        warnings.push(`WSL update warning: ${wslFix.errorMessage}`);
      }
    } else if (probe?.probeError) {
      warnings.push(`Could not inspect WSL distributions: ${probe.probeError}`);
    } else {
      operations.push("No OpenClaw/Clawdbot CLI found in WSL. Skipped WSL config patch.");
    }
  }

  const before = await checkGatewayReachability(result.suggestedGatewayUrl, 1800);
  if (before.ok) {
    operations.push(`Gateway already reachable at ${localLanHost}:${endpoint.port}.`);
    result.reachable = true;
    result.changed = true;
    return result;
  }

  try {
    const relay = await ensureGatewayRelay({
      listenHost: "0.0.0.0",
      listenPort: endpoint.port,
      targetHost: "127.0.0.1",
      targetPort: endpoint.port
    });
    result.relay = relay;
    operations.push(`LAN relay active on 0.0.0.0:${endpoint.port} -> 127.0.0.1:${endpoint.port}.`);
    result.changed = true;
  } catch (error) {
    const code = sanitizeText(error?.code, 80);
    if (code === "EADDRINUSE") {
      operations.push(`Port ${endpoint.port} is already in use on Windows host.`);
    } else {
      warnings.push(`Relay start failed: ${makeErrorMessage(error)}`);
    }
  }

  const after = await checkGatewayReachability(result.suggestedGatewayUrl, 2800);
  result.reachable = after.ok;
  if (!after.ok) {
    warnings.push(after.message);
  }
  return result;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry : String(entry)))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unionStringArrays(base, add) {
  const baseNorm = normalizeStringArray(base);
  const addNorm = normalizeStringArray(add);
  const seen = new Set(baseNorm.map((entry) => entry.toLowerCase()));
  const merged = [...baseNorm];
  for (const entry of addNorm) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(entry);
  }
  return merged;
}

function resolveDefaultAgentIdFromConfig(config) {
  const list = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const byDefault = list.find((entry) => entry && typeof entry === "object" && entry.default === true);
  const byFirst = list.find((entry) => entry && typeof entry === "object" && typeof entry.id === "string" && entry.id.trim());
  const raw = (byDefault?.id || byFirst?.id || "main").toString().trim();
  return raw || "main";
}

function shouldPatchToolsAlsoAllow(toolsObj) {
  const profileRaw = typeof toolsObj?.profile === "string" ? toolsObj.profile.trim().toLowerCase() : "";
  if (!profileRaw) {
    return false;
  }
  return profileRaw !== "full";
}

function buildNodesToolPolicyPatch(toolsObj) {
  if (!toolsObj || typeof toolsObj !== "object") {
    return null;
  }

  // If the user configured an explicit allowlist, do NOT mutate it unless it is non-empty.
  // An empty allowlist means "allow everything" and adding entries would accidentally restrict tools.
  if (Array.isArray(toolsObj.allow)) {
    const allow = normalizeStringArray(toolsObj.allow);
    if (allow.length === 0) {
      // Edge-case: allow exists but is empty and profile is restrictive (e.g. coding). Since allow lists
      // cannot be expanded additively with alsoAllow in the same scope, remove the empty allow and use
      // alsoAllow to extend the profile allowlist safely.
      if (shouldPatchToolsAlsoAllow(toolsObj)) {
        const alsoAllow = normalizeStringArray(toolsObj.alsoAllow);
        const nextAlsoAllow = unionStringArrays(alsoAllow, ["nodes"]);
        return { allow: null, alsoAllow: nextAlsoAllow };
      }
      return null;
    }
    const nextAllow = unionStringArrays(allow, ["nodes"]);
    if (JSON.stringify(nextAllow) !== JSON.stringify(allow)) {
      return { allow: nextAllow };
    }
    return null;
  }

  const alsoAllow = normalizeStringArray(toolsObj.alsoAllow);
  const canUseAlsoAllow = alsoAllow.length > 0 || shouldPatchToolsAlsoAllow(toolsObj);
  if (!canUseAlsoAllow) {
    return null;
  }
  const nextAlsoAllow = unionStringArrays(alsoAllow, ["nodes"]);
  if (JSON.stringify(nextAlsoAllow) !== JSON.stringify(alsoAllow)) {
    return { alsoAllow: nextAlsoAllow };
  }
  return null;
}

function buildOpenArmConfigPatch(config) {
  const patch = {};
  const operations = [];

  const globalToolsPatch = buildNodesToolPolicyPatch(config?.tools);
  if (globalToolsPatch) {
    patch.tools = globalToolsPatch;
    operations.push("Enabled OpenClaw agent tool access: added \"nodes\" to tools policy.");
  }

  const defaultAgentId = resolveDefaultAgentIdFromConfig(config);
  const agentList = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const defaultAgentEntry = agentList.find((entry) => entry && typeof entry === "object" && String(entry.id || "").trim() === defaultAgentId);
  const agentToolsPatch = buildNodesToolPolicyPatch(defaultAgentEntry?.tools);
  if (agentToolsPatch && defaultAgentEntry?.id) {
    patch.agents = {
      list: [
        {
          id: String(defaultAgentEntry.id),
          tools: agentToolsPatch
        }
      ]
    };
    operations.push(`Enabled agent "${defaultAgentId}" tool access: added \"nodes\" to agent tools policy.`);
  }

  const existingAllowCommands = normalizeStringArray(config?.gateway?.nodes?.allowCommands);
  const nextAllowCommands = unionStringArrays(existingAllowCommands, OPENARM_NODE_COMMANDS);
  if (JSON.stringify(nextAllowCommands) !== JSON.stringify(existingAllowCommands)) {
    patch.gateway = {
      nodes: {
        allowCommands: nextAllowCommands
      }
    };
    operations.push("Enabled OpenArm node commands through OpenClaw allowlist (gateway.nodes.allowCommands).");
  }

  return {
    patch,
    operations,
    defaultAgentId
  };
}

function upsertMarkedBlock(content, block) {
  const existing = typeof content === "string" ? content : "";
  const startIdx = existing.indexOf(OPENARM_TOOLS_MD_BLOCK_START);
  const endIdx = existing.indexOf(OPENARM_TOOLS_MD_BLOCK_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const afterEnd = endIdx + OPENARM_TOOLS_MD_BLOCK_END.length;
    return existing.slice(0, startIdx) + block + existing.slice(afterEnd);
  }
  const trimmed = existing.replace(/\s+$/, "");
  if (!trimmed) {
    return block + "\n";
  }
  return trimmed + "\n\n" + block + "\n";
}

function openArmSkillMarkdown() {
  return [
    "---",
    "name: openarm",
    "description: Use OpenArm as the OpenClaw bridge to Arm devices. Trigger when a task must connect to, discover, or run on another paired computer.",
    "metadata:",
    "  { \"openclaw\": { } }",
    "---",
    "",
    "# OpenArm (Connect + Control Arms)",
    "",
    "OpenArm exposes remote devices (\"Arms\") to OpenClaw through the **nodes** tool.",
    "Use this skill whenever the user asks to connect to an Arm, check whether an Arm is online, or run work on another computer.",
    "",
    "Connection-first workflow:",
    "1. Discover Arms: use nodes action \"status\".",
    "2. If a target Arm is missing/offline, ask the user to pair or reconnect it in OpenArm Hub (Pair PIN + approval).",
    "3. Run tasks: use nodes action \"run\" (system.run).",
    "4. If command availability is uncertain, probe first with nodes action \"which\" (system.which).",
    "5. Use nodes action \"invoke\" for OpenArm extensions (openarm.file.* / openarm.wol.wake) when gateway allowlisting permits it.",
    "",
    "Examples",
    "",
    "List nodes:",
    "",
    "```json",
    "{ \"action\": \"status\" }",
    "```",
    "",
    "Run a command on a node:",
    "",
    "```json",
    "{ \"action\": \"run\", \"node\": \"<node-id-or-name>\", \"command\": [\"powershell\", \"-NoProfile\", \"-Command\", \"Get-ChildItem\"] }",
    "```",
    "",
    "Check if a binary is available on a node:",
    "",
    "```json",
    "{ \"action\": \"which\", \"node\": \"<node-id-or-name>\", \"binary\": \"python\" }",
    "```",
    "",
    "Read a file via OpenArm (requires gateway.nodes.allowCommands includes openarm.file.read):",
    "",
    "```json",
    "{ \"action\": \"invoke\", \"node\": \"<node-id-or-name>\", \"invokeCommand\": \"openarm.file.read\", \"invokeParamsJson\": \"{\\\"path\\\":\\\"C:\\\\\\\\Users\\\\\\\\...\\\\\\\\file.txt\\\"}\" }",
    "```",
    "",
    "Wake a sleeping device (Wake-on-LAN) from an online node on the same network:",
    "",
    "```json",
    "{ \"action\": \"invoke\", \"node\": \"<online-node-id-or-name>\", \"invokeCommand\": \"openarm.wol.wake\", \"invokeParamsJson\": \"{\\\"mac\\\":\\\"AA:BB:CC:DD:EE:FF\\\",\\\"address\\\":\\\"192.168.1.255\\\",\\\"port\\\":9}\" }",
    "```",
    "",
  ].join("\n");
}

function openArmToolsMdIntegrationBlock() {
  const body = `
## OpenArm: Connect to Arms (OpenArm Integration)

OpenArm is the bridge between OpenClaw and Arm devices.  
When a task must run on another computer, use the **nodes** tool and target the right Arm.

Connection workflow
- Discover paired/connected Arms first: nodes action \\\"status\\\"
- Execute commands: nodes action \\\"run\\\"
- Check command availability when uncertain: nodes action \\\"which\\\"
- Use OpenArm extensions with nodes action \\\"invoke\\\": \\\"openarm.file.*\\\" and \\\"openarm.wol.wake\\\"

Notes
- If the target Arm is missing/offline, instruct the user to pair/connect it from OpenArm Hub first.
- If \\\"openarm.file.*\\\" is unavailable, use nodes \\\"run\\\" with shell commands instead.
- Prefer the Arm OS that matches the task.
`.trim();

  return `${OPENARM_TOOLS_MD_BLOCK_START}\n${body}\n${OPENARM_TOOLS_MD_BLOCK_END}`;
}

function normalizeIntegrationVersion(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
}

function currentIntegrationGatewayKey() {
  return sanitizeText(state.settings?.gatewayUrl, 512).trim().toLowerCase();
}

function shouldAutoEnableOpenArmAgentIntegration() {
  if (state.settings?.mode !== "hub") {
    return false;
  }
  if (state.settings?.autoEnableAgentIntegration === false) {
    return false;
  }
  const gatewayKey = currentIntegrationGatewayKey();
  if (!gatewayKey) {
    return false;
  }
  const doneVersion = normalizeIntegrationVersion(state.settings?.agentIntegrationVersion);
  const doneGateway = sanitizeText(state.settings?.agentIntegrationGateway, 512).trim().toLowerCase();
  return doneVersion < OPENARM_AGENT_INTEGRATION_VERSION || doneGateway !== gatewayKey;
}

async function installOpenArmSkillWindowsBestEffort() {
  const home = os.homedir();
  const override = sanitizeText(process.env.OPENCLAW_STATE_DIR, 2000) || sanitizeText(process.env.CLAWDBOT_STATE_DIR, 2000);
  const openclawDir = path.join(home, ".openclaw");
  const clawdbotDir = path.join(home, ".clawdbot");
  const roots = override
    ? [path.resolve(override)]
    : await (async () => {
        const list = [openclawDir];
        try {
          const stat = await fs.stat(clawdbotDir);
          if (stat.isDirectory()) {
            list.push(clawdbotDir);
          }
        } catch {
          // Skip legacy dir unless it already exists.
        }
        return list;
      })();

  const filePaths = [];
  try {
    const content = `${openArmSkillMarkdown().replace(/\r/g, "")}\n`;
    for (const root of roots) {
      const skillDir = path.join(root, "skills", "openarm");
      const filePath = path.join(skillDir, "SKILL.md");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(filePath, content, "utf8");
      filePaths.push(filePath);
    }
    return { ok: true, filePaths };
  } catch (error) {
    return { ok: false, filePaths, error: makeErrorMessage(error) };
  }
}

async function installOpenArmSkillWslBestEffort() {
  if (process.platform !== "win32") {
    return { ok: false, skipped: true, reason: "not_windows" };
  }
  const probe = await probeWslOpenClawCli();
  if (!probe?.cliPath) {
    return { ok: false, skipped: true, reason: "no_wsl_openclaw" };
  }
  const content = openArmSkillMarkdown().replace(/\r/g, "");
  const script = `
set -e
paths=""
write_skill() {
  local root="$1"
  mkdir -p "$root/skills/openarm"
  cat > "$root/skills/openarm/SKILL.md" <<'OPENARM_EOF'
${content}
OPENARM_EOF
  paths="\${paths}\${paths:+;}$root/skills/openarm/SKILL.md"
}
write_skill "$HOME/.openclaw"
if [ -d "$HOME/.clawdbot" ]; then
  write_skill "$HOME/.clawdbot"
fi
echo "OPENARM_SKILL_PATHS=\${paths}"
`;
  const result = await runWslBash(script, probe.distro, 25_000);
  const installedPathsRaw = parseTaggedOutputLine(result.stdout, "OPENARM_SKILL_PATHS");
  const filePaths = installedPathsRaw
    ? installedPathsRaw.split(";").map((entry) => entry.trim()).filter(Boolean)
    : [];
  if (result.code === 0 && filePaths.length > 0) {
    return { ok: true, distro: probe.distro, filePaths };
  }
  return {
    ok: false,
    distro: probe.distro,
    filePaths: filePaths.length ? filePaths : ["~/.openclaw/skills/openarm/SKILL.md"],
    error: sanitizeText(result.stderr, 600) || sanitizeText(result.error?.message, 600) || "Failed to write skill file in WSL."
  };
}

async function enableOpenArmAgentIntegration() {
  if (!operatorClient || !operatorClient.isConnected()) {
    throw new Error("Controller link is not connected");
  }

  const operations = [];
  const warnings = [];

  const snapshot = await operatorClient.request("config.get", {});
  const config = snapshot?.config && typeof snapshot.config === "object" ? snapshot.config : {};
  const baseHash = sanitizeText(snapshot?.hash, 300) || sanitizeText(snapshot?.baseHash, 300) || "";

  const { patch, operations: patchOps, defaultAgentId } = buildOpenArmConfigPatch(config);
  operations.push(...patchOps);

  // Update agent TOOLS.md so the OpenClaw agent has explicit instructions for remote device control.
  try {
    const toolsBlock = openArmToolsMdIntegrationBlock();
    const toolsRes = await operatorClient.request("agents.files.get", {
      agentId: defaultAgentId,
      name: "TOOLS.md"
    });
    const current = toolsRes?.file?.missing ? "" : String(toolsRes?.file?.content ?? "");
    const next = upsertMarkedBlock(current, toolsBlock);
    if (next !== current) {
      await operatorClient.request("agents.files.set", {
        agentId: defaultAgentId,
        name: "TOOLS.md",
        content: next
      });
      operations.push(`Updated ${defaultAgentId} TOOLS.md with OpenArm integration instructions.`);
    } else {
      operations.push(`TOOLS.md already contains OpenArm integration instructions (agent ${defaultAgentId}).`);
    }
  } catch (error) {
    warnings.push(`Could not update TOOLS.md instructions: ${makeErrorMessage(error)}`);
  }

  // Best-effort: install a real OpenClaw skill file locally (Windows and/or WSL).
  const winSkill = await installOpenArmSkillWindowsBestEffort();
  if (winSkill.ok && Array.isArray(winSkill.filePaths) && winSkill.filePaths.length > 0) {
    operations.push(`Installed OpenArm skill file (Windows): ${winSkill.filePaths.join(" , ")}`);
  } else {
    warnings.push(`Windows skill install skipped/failed: ${winSkill.error || "unknown error"}`);
  }
  const wslSkill = await installOpenArmSkillWslBestEffort();
  if (wslSkill.ok && Array.isArray(wslSkill.filePaths) && wslSkill.filePaths.length > 0) {
    operations.push(
      `Installed OpenArm skill file (WSL${wslSkill.distro ? `:${wslSkill.distro}` : ""}): ${wslSkill.filePaths.join(" , ")}`
    );
  } else if (!wslSkill.skipped) {
    warnings.push(`WSL skill install skipped/failed: ${wslSkill.error || "unknown error"}`);
  }

  // If we installed skills, confirm visibility from the gateway host (best effort).
  try {
    const status = await operatorClient.request("skills.status", {});
    const skills = Array.isArray(status?.skills) ? status.skills : [];
    const seen = skills.some((entry) => String(entry?.name || "").trim().toLowerCase() === "openarm");
    if (seen) {
      operations.push("Verified: OpenClaw sees the \"openarm\" skill.");
    } else {
      warnings.push("OpenClaw skill \"openarm\" not visible yet (may require restart or remote gateway host).");
    }
  } catch (error) {
    warnings.push(`Could not verify skills.status: ${makeErrorMessage(error)}`);
  }

  const patchKeys = patch && typeof patch === "object" ? Object.keys(patch) : [];
  if (patchKeys.length === 0) {
    return {
      applied: false,
      operations: operations.length ? operations : ["No config changes required."],
      warnings
    };
  }

  if (!baseHash && snapshot?.exists) {
    throw new Error("Gateway config is present but base hash was unavailable. Reconnect and retry.");
  }

  const response = await operatorClient.request("config.patch", {
    raw: JSON.stringify(patch),
    baseHash: baseHash || undefined,
    note: "OpenArm: enable remote device control (nodes + OpenArm file ops)",
    restartDelayMs: 800
  });

  operations.push("Applied OpenClaw config patch. Gateway will restart briefly to apply changes.");

  return {
    applied: true,
    operations,
    warnings,
    restart: response?.restart || null
  };
}

async function persistOpenArmAgentIntegrationState() {
  await saveSettingsPatch({
    agentIntegrationVersion: OPENARM_AGENT_INTEGRATION_VERSION,
    agentIntegrationGateway: currentIntegrationGatewayKey(),
    agentIntegrationLastSyncedAt: nowIso()
  });
}

async function runOpenArmAgentIntegration({ trigger = "manual" } = {}) {
  if (openArmAgentIntegrationPromise) {
    return await openArmAgentIntegrationPromise;
  }
  openArmAgentIntegrationPromise = (async () => {
    const result = await enableOpenArmAgentIntegration();
    await persistOpenArmAgentIntegrationState();
    return result;
  })().finally(() => {
    openArmAgentIntegrationPromise = null;
  });
  try {
    const result = await openArmAgentIntegrationPromise;
    const warningCount = Array.isArray(result?.warnings) ? result.warnings.length : 0;
    log("info", "OpenArm agent integration completed", {
      trigger,
      applied: Boolean(result?.applied),
      warnings: warningCount
    });
    if (warningCount > 0) {
      log("warn", "OpenArm agent integration warnings", {
        trigger,
        warning: sanitizeText(result.warnings[0], 500)
      });
    }
    return result;
  } catch (error) {
    log("warn", "OpenArm agent integration failed", {
      trigger,
      message: makeErrorMessage(error)
    });
    throw error;
  }
}

async function maybeAutoEnableOpenArmAgentIntegration(trigger = "operator.connected") {
  if (!shouldAutoEnableOpenArmAgentIntegration()) {
    return { skipped: true, reason: "not_required" };
  }
  if (!operatorClient || !operatorClient.isConnected()) {
    return { skipped: true, reason: "not_connected" };
  }
  try {
    const result = await runOpenArmAgentIntegration({ trigger: `auto:${trigger}` });
    return {
      skipped: false,
      applied: Boolean(result?.applied),
      warnings: Array.isArray(result?.warnings) ? result.warnings : []
    };
  } catch (error) {
    return {
      skipped: false,
      error: makeErrorMessage(error)
    };
  }
}

function detectInstallerRole() {
  if (process.platform !== "win32") {
    return "";
  }
  try {
    const output = execFileSync(
      "reg.exe",
      ["query", "HKCU\\Software\\OpenArm", "/v", "InstallRole"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const match = output.match(/InstallRole\s+REG_SZ\s+([^\r\n]+)/i);
    if (!match) {
      return "";
    }
    return normalizeRole(match[1]);
  } catch {
    return "";
  }
}

function currentNodeCommands() {
  return getNodeCommands(state.settings.enableExtendedCommands);
}

function log(level, message, meta = {}) {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send("log:entry", {
    id: crypto.randomUUID(),
    level,
    message,
    meta,
    timestamp: nowIso()
  });
}

function publishState() {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send("state:update", {
    settings: state.settings,
    bootstrap: state.bootstrap,
    nodeConnection: state.nodeConnection,
    operatorConnection: state.operatorConnection,
    nodes: state.nodes,
    devicePairing: state.devicePairing,
    pairPin: state.pairPin
  });
}

function publishChatEvent(payload) {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send("chat:event", payload);
}

function publishGatewayEvent(payload) {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send("gateway:event", payload);
}

function getAppIconPath() {
  if (process.platform === "darwin") return path.join(__dirname, "assets", "openarm.icns");
  if (process.platform === "linux") return path.join(__dirname, "assets", "openarm.png");
  return path.join(__dirname, "assets", "openarm.ico");
}

function ensureTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(getAppIconPath());
  tray = new Tray(icon);
  tray.setToolTip("OpenArm");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show OpenArm", click: () => { if (!mainWindow) createWindow(); mainWindow.show(); mainWindow.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => { if (!mainWindow) createWindow(); mainWindow.show(); mainWindow.focus(); });
}

function syncAppBehaviorSettings() {
  const settings = state.settings || {};
  if (process.platform === "win32" || process.platform === "darwin") {
    app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup !== false });
  }
  if ((settings.minimizeToTray !== false) || (settings.closeToTray !== false)) {
    ensureTray();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    autoHideMenuBar: true,
    // Light theme background to avoid a dark flash while the renderer loads.
    backgroundColor: "#dbe6ff",
    icon: process.platform === "win32" ? getAppIconPath() : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("minimize", (event) => {
    if (state.settings?.minimizeToTray !== false) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting && state.settings?.closeToTray !== false) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function ensureIdentity() {
  if (!identity) {
    identity = await loadOrCreateDeviceIdentity(identityPath());
    state.nodeConnection.nodeId = identity.deviceId;
  }
  return identity;
}

async function sendNodeEvent(event, payload) {
  if (!nodeClient || !nodeClient.isConnected()) {
    return;
  }
  try {
    await nodeClient.request("node.event", {
      event,
      payloadJSON: payload ? JSON.stringify(payload) : null
    });
  } catch {
    // Best effort.
  }
}

async function handleNodeInvokeRequest(payload) {
  const frame = coerceNodeInvokePayload(payload);
  if (!frame) {
    return;
  }
  let result;
  try {
    result = await executeNodeCommand({
      frame,
      approvalsStore,
      sendNodeEvent
    });
  } catch (error) {
    result = {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: makeErrorMessage(error)
      }
    };
  }

  if (!nodeClient || !nodeClient.isConnected()) {
    return;
  }
  try {
    await nodeClient.request("node.invoke.result", buildNodeInvokeResultParams(frame, result));
  } catch (error) {
    log("warn", "Failed to send node.invoke.result", {
      invokeId: frame.id,
      error: makeErrorMessage(error)
    });
  }
}

async function refreshNodesFromGateway() {
  if (!operatorClient || !operatorClient.isConnected()) {
    throw new Error("Controller link is not connected");
  }
  const result = await operatorClient.request("node.list", {});
  state.nodes = Array.isArray(result?.nodes) ? result.nodes : [];
  publishState();
  return state.nodes;
}

async function refreshDevicePairing() {
  if (!operatorClient || !operatorClient.isConnected()) {
    throw new Error("Controller link is not connected");
  }
  const result = await operatorClient.request("device.pair.list", {});
  state.devicePairing = {
    pending: Array.isArray(result?.pending) ? result.pending : [],
    paired: Array.isArray(result?.paired) ? result.paired : [],
    fetchedAt: nowIso()
  };
  publishState();
  return state.devicePairing;
}

async function connectNode() {
  const url = state.settings.gatewayUrl || "";
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    throw new Error("Gateway URL must start with ws:// or wss://");
  }
  const reachability = await checkGatewayReachability(url, 3000);
  if (!reachability.ok) {
    throw new Error(reachability.message);
  }
  const id = await ensureIdentity();
  if (nodeClient) {
    nodeClient.stop();
    nodeClient = null;
  }
  state.nodeConnection.reconnectAttempt = 0;

  nodeClient = new GatewayRpcClient({
    url: state.settings.gatewayUrl,
    token: state.settings.gatewayToken,
    password: state.settings.gatewayPassword,
    tlsFingerprint: state.settings.gatewayTlsFingerprint,
    deviceAuthStorePath: deviceAuthPath(),
    deviceIdentity: id,
    clientId: NODE_CLIENT.id,
    clientMode: NODE_CLIENT.mode,
    role: NODE_CLIENT.role,
    scopes: [],
    clientDisplayName: state.settings.nodeDisplayName,
    clientVersion: app.getVersion(),
    platform: process.platform,
    instanceId: state.settings.nodeInstanceId,
    caps: NODE_CLIENT.caps,
    commands: currentNodeCommands(),
    pathEnv: process.env.PATH || "",
    onStatus: (status) => {
      if (status.status === "connecting" && state.nodeConnection.status !== "connected") {
        state.nodeConnection.reconnectAttempt++;
      }
      if (status.status === "connected") {
        state.nodeConnection.reconnectAttempt = 0;
      }
      state.nodeConnection = {
        ...state.nodeConnection,
        ...status,
        nodeId: id.deviceId
      };
      publishState();
    },
    onEvent: (event) => {
      if (event.event === "node.invoke.request") {
        void handleNodeInvokeRequest(event.payload);
      }
    },
    onConnectError: (error) => {
      log("error", "Arm connection failed", { message: error.message });
    },
    onClose: (code, reason) => {
      log("warn", "Arm disconnected", { code, reason });
    },
    onHello: (hello) => {
      log("info", "Arm connected", {
        protocol: hello?.protocol,
        connId: hello?.server?.connId
      });
    }
  });

  nodeClient.start();
}

function disconnectNode() {
  if (nodeClient) {
    nodeClient.stop();
    nodeClient = null;
  }
  state.nodeConnection = {
    ...state.nodeConnection,
    status: "disconnected",
    lastError: "",
    connectedAt: null,
    reconnectAttempt: 0
  };
  publishState();
}

async function connectOperator() {
  const url = state.settings.gatewayUrl || "";
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    throw new Error("Gateway URL must start with ws:// or wss://");
  }
  const reachability = await checkGatewayReachability(url, 3000);
  if (!reachability.ok) {
    throw new Error(reachability.message);
  }
  const id = await ensureIdentity();
  if (operatorClient) {
    operatorClient.stop();
    operatorClient = null;
  }
  state.operatorConnection.reconnectAttempt = 0;

  operatorClient = new GatewayRpcClient({
    url: state.settings.gatewayUrl,
    token: state.settings.gatewayToken,
    password: state.settings.gatewayPassword,
    tlsFingerprint: state.settings.gatewayTlsFingerprint,
    deviceAuthStorePath: deviceAuthPath(),
    deviceIdentity: id,
    clientId: OPERATOR_CLIENT.id,
    clientMode: OPERATOR_CLIENT.mode,
    role: OPERATOR_CLIENT.role,
    scopes: ["operator.admin", "operator.pairing", "operator.approvals"],
    clientDisplayName: "OpenArm Controller Station",
    clientVersion: app.getVersion(),
    platform: process.platform,
    instanceId: randomId("openarm-hub-ui"),
    caps: OPERATOR_CLIENT.caps,
    commands: [],
    pathEnv: process.env.PATH || "",
    onStatus: (status) => {
      if (status.status === "connecting" && state.operatorConnection.status !== "connected") {
        state.operatorConnection.reconnectAttempt++;
      }
      if (status.status === "connected") {
        state.operatorConnection.reconnectAttempt = 0;
      }
      state.operatorConnection = {
        ...state.operatorConnection,
        ...status
      };
      publishState();
      if (status.status === "connected") {
        void maybeAutoEnableOpenArmAgentIntegration("operator.status.connected");
      }
    },
    onEvent: (event) => {
      if (event.event === "chat") {
        publishChatEvent(event.payload);
      }
      if (
        event.event === "device.pair.requested" ||
        event.event === "device.pair.resolved" ||
        event.event === "node.pair.requested" ||
        event.event === "node.pair.resolved" ||
        event.event === "node.connected" ||
        event.event === "node.status" ||
        event.event === "node.metadata" ||
        event.event === "node.presence" ||
        event.event === "node.state"
      ) {
        publishGatewayEvent(event);
        void refreshDevicePairing().catch(() => { });
        void refreshNodesFromGateway().catch(() => { });
      }
    },
    onConnectError: (error) => {
      log("error", "Controller connection failed", { message: error.message });
    },
    onClose: (code, reason) => {
      log("warn", "Controller disconnected", { code, reason });
    },
    onHello: async () => {
      log("info", "Controller connected");
      await refreshNodesFromGateway().catch(() => { });
      await refreshDevicePairing().catch(() => { });
    }
  });

  operatorClient.start();
}

function disconnectOperator() {
  if (operatorClient) {
    operatorClient.stop();
    operatorClient = null;
  }
  state.operatorConnection = {
    ...state.operatorConnection,
    status: "disconnected",
    lastError: "",
    connectedAt: null,
    reconnectAttempt: 0
  };
  publishState();
}

function decodeInvokeResponse(response) {
  if (!response) {
    return null;
  }
  if (typeof response.payloadJSON === "string") {
    return safeJsonParse(response.payloadJSON, null);
  }
  return response.payload ?? null;
}

function ok(data = {}) {
  return { ok: true, ...data };
}

function fail(error) {
  return {
    ok: false,
    error: {
      message: makeErrorMessage(error)
    }
  };
}

async function saveSettingsPatch(patch) {
  state.settings = normalizeSettings({
    ...state.settings,
    ...(patch && typeof patch === "object" ? patch : {})
  });
  state.settings = await saveSettings(configPath(), state.settings);
  syncAppBehaviorSettings();
  publishState();
  return state.settings;
}

ipcMain.handle("state:get", async () =>
  ok({
    settings: state.settings,
    bootstrap: state.bootstrap,
    nodeConnection: state.nodeConnection,
    operatorConnection: state.operatorConnection,
    nodes: state.nodes,
    devicePairing: state.devicePairing,
    pairPin: state.pairPin
  })
);

ipcMain.handle("settings:save", async (_event, patch) => {
  try {
    const settings = await saveSettingsPatch(patch);
    return ok({ settings });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("wol:send", async (_event, payload) => {
  try {
    const mac = sanitizeText(payload?.mac, 64);
    if (!mac) {
      throw new Error("mac is required");
    }
    const address = sanitizeText(payload?.address || payload?.broadcast || payload?.broadcastAddress, 120) || "";
    const port = Number(payload?.port) > 0 ? Number(payload.port) : 9;
    const result = await sendWakeOnLan({ mac, address, port });
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("mode:set", async (_event, payload) => {
  try {
    const mode = normalizeRole(payload?.mode);
    if (!mode) {
      throw new Error("mode must be arm or controller");
    }
    const settings = await saveSettingsPatch({
      mode,
      onboardingComplete:
        payload?.onboardingComplete !== undefined ? Boolean(payload.onboardingComplete) : true
    });
    return ok({ settings });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("pairpin:generate", async (_event, payload) => {
  try {
    if (!pairPinService) {
      throw new Error("Pair PIN service is not ready.");
    }
    const expiresMinutes =
      Number(payload?.expiresMinutes) > 0
        ? Number(payload.expiresMinutes)
        : state.settings.pairPinExpiryMinutes;
    const gateway = normalizePairGateway({
      url: state.settings.gatewayUrl,
      token: state.settings.gatewayToken || undefined,
      password: state.settings.gatewayPassword || undefined,
      tlsFingerprint: state.settings.gatewayTlsFingerprint || undefined
    });
    const generated = await pairPinService.generate({
      expiresMinutes,
      gateway,
      hubDisplayName: state.settings.nodeDisplayName
    });
    await saveSettingsPatch({ pairPinExpiryMinutes: generated.expiresMinutes });
    return ok({
      generated
    });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("pairpin:redeem", async (_event, payload) => {
  try {
    const pin = sanitizeText(payload?.pin, 8);
    if (!/^\d{4}$/.test(pin)) {
      throw new Error("Pair PIN must be exactly 4 digits.");
    }
    const explicitHost = normalizePairHost(payload?.hubHost);
    const hostCandidates = [];
    if (explicitHost) {
      hostCandidates.push({
        host: explicitHost,
        redeemPort: Number(payload?.redeemPort) || null
      });
    }
    const discovered = await discoverPairPinHubs({
      timeoutMs: Number(payload?.discoveryTimeoutMs) || 3200
    });
    for (const entry of discovered) {
      hostCandidates.push({
        host: entry.host,
        redeemPort: entry.redeemPort
      });
    }
    const deduped = [];
    const seen = new Set();
    for (const entry of hostCandidates) {
      const host = normalizePairHost(entry?.host);
      const port =
        Number(entry?.redeemPort) > 0 ? Number(entry.redeemPort) : undefined;
      if (!host) {
        continue;
      }
      const key = `${host}:${port || "default"}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push({ host, port });
    }
    let candidates = deduped;
    if (!explicitHost) {
      const nonLoopback = candidates.filter((entry) => !isLoopbackLikeHost(entry.host));
      if (nonLoopback.length) {
        candidates = nonLoopback;
      }
    }
    if (!candidates.length) {
      throw new Error("No Controller Station discovered. Enter the Controller IP manually and retry.");
    }

    let lastError = "No Controller Station accepted this Pair PIN.";
    const invalidHosts = [];
    for (const candidate of candidates) {
      try {
        const response = await redeemPairPin({
          host: candidate.host,
          port: candidate.port,
          pin,
          timeoutMs: Number(payload?.redeemTimeoutMs) || 5000
        });
        const gateway = normalizePairGateway(response?.payload?.gateway);
        const rewrite = rewriteGatewayUrlForArm(gateway.url, candidate.host);
        const effectiveGateway = rewrite.rewritten ? { ...gateway, url: rewrite.url } : gateway;
        if (rewrite.rewritten) {
          log("info", "Rewrote paired gateway URL for remote arm", {
            from: gateway.url,
            to: rewrite.url,
            controllerHost: candidate.host
          });
        }
        const reachability = await checkGatewayReachability(effectiveGateway.url, 3500);
        if (!reachability.ok) {
          throw new Error(
            `${reachability.message} PIN was redeemed but Arm cannot reach the gateway from this device.`
          );
        }
        const settings = await saveSettingsPatch({
          gatewayUrl: effectiveGateway.url,
          gatewayToken: effectiveGateway.token || "",
          gatewayPassword: effectiveGateway.password || "",
          gatewayTlsFingerprint: effectiveGateway.tlsFingerprint || ""
        });
        return ok({
          paired: {
            host: candidate.host,
            port: candidate.port || null,
            gateway: effectiveGateway,
            meta: {
              ...(response?.payload?.meta || {}),
              gatewayUrlRewritten: rewrite.rewritten,
              originalGatewayUrl: gateway.url
            }
          },
          settings
        });
      } catch (error) {
        lastError = makeErrorMessage(error);
        if (lastError.toLowerCase().includes("pair_pin_invalid")) {
          invalidHosts.push(candidate.host);
        }
      }
    }
    if (invalidHosts.length === candidates.length) {
      const uniqueHosts = [...new Set(invalidHosts)].slice(0, 4).join(", ");
      throw new Error(
        `PIN was rejected by discovered controller addresses (${uniqueHosts || "unknown"}). ` +
        "Generate a new PIN and enter the Controller IP manually to ensure the right Controller is targeted."
      );
    }
    throw new Error(lastError);
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("node:connect", async () => {
  try {
    await connectNode();
    return ok();
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("node:disconnect", async () => {
  disconnectNode();
  return ok();
});

ipcMain.handle("operator:connect", async () => {
  try {
    await connectOperator();
    return ok();
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("operator:disconnect", async () => {
  disconnectOperator();
  return ok();
});

ipcMain.handle("connections:connectForMode", async () => {
  try {
    if (state.settings.mode === "arm") {
      await connectNode();
      return ok({ mode: "arm" });
    }
    if (state.settings.mode === "hub") {
      await connectOperator();
      return ok({ mode: "hub" });
    }
    throw new Error("mode not selected");
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("connections:disconnectForMode", async () => {
  if (state.settings.mode === "arm") {
    disconnectNode();
  }
  if (state.settings.mode === "hub") {
    disconnectOperator();
  }
  return ok();
});

ipcMain.handle("gateway:nodesList", async () => {
  try {
    const nodes = await refreshNodesFromGateway();
    return ok({ nodes });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:devicePairList", async () => {
  try {
    const pairing = await refreshDevicePairing();
    return ok({ pairing });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:devicePairApprove", async (_event, payload) => {
  try {
    if (!operatorClient || !operatorClient.isConnected()) {
      throw new Error("Controller link is not connected");
    }
    const requestId = sanitizeText(payload?.requestId, 200);
    if (!requestId) {
      throw new Error("requestId is required");
    }
    const response = await operatorClient.request("device.pair.approve", { requestId });
    await refreshDevicePairing().catch(() => { });
    await refreshNodesFromGateway().catch(() => { });
    return ok({ response });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:devicePairReject", async (_event, payload) => {
  try {
    if (!operatorClient || !operatorClient.isConnected()) {
      throw new Error("Controller link is not connected");
    }
    const requestId = sanitizeText(payload?.requestId, 200);
    if (!requestId) {
      throw new Error("requestId is required");
    }
    const response = await operatorClient.request("device.pair.reject", { requestId });
    await refreshDevicePairing().catch(() => { });
    await refreshNodesFromGateway().catch(() => { });
    return ok({ response });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:autoFix", async (_event, payload) => {
  try {
    const result = await runGatewayAutoFix(payload);
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:agentIntegrationEnable", async () => {
  try {
    const result = await runOpenArmAgentIntegration({ trigger: "ipc:gateway:agentIntegrationEnable" });
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:nodeInvoke", async (_event, payload) => {
  try {
    if (!operatorClient || !operatorClient.isConnected()) {
      throw new Error("Controller link is not connected");
    }
    const nodeId = sanitizeText(payload?.nodeId, 160);
    const command = sanitizeText(payload?.command, 160);
    if (!nodeId || !command) {
      throw new Error("nodeId and command are required");
    }
    const response = await operatorClient.request(
      "node.invoke",
      {
        nodeId,
        command,
        params: payload?.params ?? {},
        timeoutMs: typeof payload?.timeoutMs === "number" ? payload.timeoutMs : undefined,
        idempotencyKey: crypto.randomUUID()
      },
      { expectFinal: true }
    );
    return ok({
      response,
      decodedPayload: decodeInvokeResponse(response)
    });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:chatSend", async (_event, payload) => {
  try {
    if (!operatorClient || !operatorClient.isConnected()) {
      throw new Error("Controller link is not connected");
    }
    const sessionKey = sanitizeText(payload?.sessionKey, 160) || state.settings.sessionKey;
    const message = (payload?.message ?? "").toString();
    if (!message.trim()) {
      throw new Error("message is required");
    }
    const response = await operatorClient.request("chat.send", {
      sessionKey,
      message,
      idempotencyKey: crypto.randomUUID()
    });
    return ok({ response });
  } catch (error) {
    return fail(error);
  }
});

ipcMain.handle("gateway:chatHistory", async (_event, payload) => {
  try {
    if (!operatorClient || !operatorClient.isConnected()) {
      throw new Error("Controller link is not connected");
    }
    const sessionKey = sanitizeText(payload?.sessionKey, 160) || state.settings.sessionKey;
    const limit = typeof payload?.limit === "number" ? Math.max(1, Math.min(1000, payload.limit)) : 120;
    const response = await operatorClient.request("chat.history", {
      sessionKey,
      limit
    });
    return ok({ response });
  } catch (error) {
    return fail(error);
  }
});

app.whenReady().then(async () => {
  state.settings = await loadSettings(configPath());
  pairPinService = createHubPairPinService({
    onStateChange: (payload) => {
      state.pairPin = {
        active: payload?.active || null,
        lastEvent: payload?.lastEvent || state.pairPin.lastEvent || null,
        relay: payload?.relay || state.pairPin.relay
      };
      publishState();
    },
    onLog: log
  });
  state.pairPin = pairPinService.getState();
  state.bootstrap = {
    installerRole: detectInstallerRole(),
    openclaw: detectOpenClawEnvironment()
  };
  if (!state.settings.mode && state.bootstrap.installerRole) {
    state.settings.mode = state.bootstrap.installerRole;
  }
  state.settings = await saveSettings(configPath(), state.settings);
  syncAppBehaviorSettings();
  approvalsStore = createExecApprovalsStore(approvalsPath());
  createWindow();
  publishState();

  if (state.settings.onboardingComplete) {
    if (state.settings.mode === "arm" && state.settings.autoConnectArm) {
      await connectNode().catch((error) => {
        log("error", "Arm auto-connect failed", { message: makeErrorMessage(error) });
      });
    }
    if (state.settings.mode === "hub" && state.settings.autoConnectHub) {
      await connectOperator().catch((error) => {
        log("error", "Controller auto-connect failed", { message: makeErrorMessage(error) });
      });
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      publishState();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  disconnectNode();
  disconnectOperator();
  pairPinService?.stop();
  void stopGatewayRelay();
});
