const crypto = require("node:crypto");
const dgram = require("node:dgram");
const http = require("node:http");
const os = require("node:os");
const { sanitizeText, safeJsonParse } = require("./util");

const PAIR_DISCOVERY_PORT = 28776;
const PAIR_REDEEM_PORT = 28777;
const PAIR_DISCOVERY_MAGIC = "OPENARM_DISCOVER_PIN_V1";
const PAIR_DISCOVERY_RESPONSE = "OPENARM_DISCOVERY_RESULT_V1";

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function generatePin() {
  return crypto.randomInt(0, 10_000).toString().padStart(4, "0");
}

function normalizePairGateway(gateway) {
  if (!gateway || typeof gateway !== "object") {
    throw new Error("Pairing gateway details are missing.");
  }
  const url = sanitizeText(gateway.url, 1024);
  const token = sanitizeText(gateway.token, 4096) || "";
  const password = sanitizeText(gateway.password, 4096) || "";
  const tlsFingerprint = sanitizeText(gateway.tlsFingerprint, 400) || "";
  if (!url) {
    throw new Error("Gateway URL is required.");
  }
  if (!token && !password) {
    throw new Error("Gateway token or password is required.");
  }
  return {
    url,
    token,
    password,
    tlsFingerprint
  };
}

function parseRemoteIp(remoteAddress) {
  const raw = sanitizeText(remoteAddress, 200);
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

function isLocalAddress(address) {
  const ip = parseRemoteIp(address);
  if (!ip) {
    return false;
  }
  const lower = ip.toLowerCase();
  if (ip === "127.0.0.1") {
    return true;
  }
  if (lower === "::1") {
    return true;
  }
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  if (ip.startsWith("10.")) {
    return true;
  }
  if (ip.startsWith("192.168.")) {
    return true;
  }
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      return true;
    }
  }
  if (ip.startsWith("169.254.")) {
    return true;
  }
  return false;
}

function listHubHostHints() {
  const interfaces = os.networkInterfaces();
  const hints = [];
  const seen = new Set();
  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") {
        continue;
      }
      if (entry.address) {
        if (!seen.has(entry.address)) {
          seen.add(entry.address);
          hints.push(entry.address);
        }
      }
    }
  }
  if (!seen.has("127.0.0.1")) {
    hints.push("127.0.0.1");
  }
  return hints;
}

function parseIpv4Parts(value) {
  const text = sanitizeText(value, 64);
  if (!text) {
    return null;
  }
  const parts = text.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const numbers = parts.map((part) => Number(part));
  if (
    numbers.some((number) => !Number.isInteger(number) || number < 0 || number > 255)
  ) {
    return null;
  }
  return numbers;
}

function ipv4PartsToInt(parts) {
  return (
    (((parts[0] << 24) >>> 0) |
      ((parts[1] << 16) >>> 0) |
      ((parts[2] << 8) >>> 0) |
      (parts[3] >>> 0)) >>>
    0
  );
}

function intToIpv4(value) {
  const unsigned = value >>> 0;
  return [
    (unsigned >>> 24) & 0xff,
    (unsigned >>> 16) & 0xff,
    (unsigned >>> 8) & 0xff,
    unsigned & 0xff
  ].join(".");
}

function computeBroadcastAddress(address, netmask) {
  const addressParts = parseIpv4Parts(address);
  const maskParts = parseIpv4Parts(netmask);
  if (!addressParts || !maskParts) {
    return "";
  }
  const addressInt = ipv4PartsToInt(addressParts);
  const maskInt = ipv4PartsToInt(maskParts);
  const broadcast = (addressInt & maskInt) | (~maskInt >>> 0);
  return intToIpv4(broadcast);
}

function listDiscoveryTargets() {
  const targets = new Set(["255.255.255.255", "127.0.0.1"]);
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") {
        continue;
      }
      const broadcast = computeBroadcastAddress(entry.address, entry.netmask);
      if (broadcast) {
        targets.add(broadcast);
        continue;
      }
      const parts = parseIpv4Parts(entry.address);
      if (parts) {
        targets.add(`${parts[0]}.${parts[1]}.${parts[2]}.255`);
      }
    }
  }
  return [...targets];
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJsonBody(req, limitBytes = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let text = "";
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("Request body is too large."));
        return;
      }
      text += chunk.toString("utf8");
    });
    req.on("error", reject);
    req.on("end", () => {
      resolve(safeJsonParse(text, null));
    });
  });
}

function createHubPairPinService(options = {}) {
  let httpServer = null;
  let httpServerReady = null;
  let discoverySocket = null;
  let activePair = null;
  let expireTimer = null;
  let lastEvent = null;

  const notifyStateChange = options.onStateChange || (() => {});
  const redeemPort = clampInt(options.redeemPort, 1024, 65535, PAIR_REDEEM_PORT);
  const discoveryPort = clampInt(options.discoveryPort, 1024, 65535, PAIR_DISCOVERY_PORT);

  function setLastEvent(reason, details = {}) {
    lastEvent = {
      reason: sanitizeText(reason, 120) || "unknown",
      atMs: Date.now(),
      details: details && typeof details === "object" ? details : {}
    };
    return lastEvent;
  }

  function clearPair(reason, details = {}) {
    const event = setLastEvent(reason, details);
    activePair = null;
    if (expireTimer) {
      clearTimeout(expireTimer);
      expireTimer = null;
    }
    notifyStateChange({
      active: null,
      lastEvent: event,
      relay: {
        discoveryPort,
        redeemPort,
        hostHints: listHubHostHints()
      }
    });
  }

  function scheduleExpire(expiresAtMs) {
    if (expireTimer) {
      clearTimeout(expireTimer);
      expireTimer = null;
    }
    const waitMs = Math.max(250, expiresAtMs - Date.now());
    expireTimer = setTimeout(() => {
      clearPair("expired", { expiresAtMs });
    }, waitMs);
    expireTimer.unref?.();
  }

  async function ensureHttpServer() {
    if (httpServer?.listening) {
      return;
    }
    if (!httpServer) {
      httpServer = http.createServer(async (req, res) => {
        if (req.method !== "POST" || req.url !== "/v1/pair/redeem") {
          jsonResponse(res, 404, { ok: false, error: "not_found" });
          return;
        }

        if (!isLocalAddress(req.socket.remoteAddress)) {
          jsonResponse(res, 403, { ok: false, error: "forbidden_remote_address" });
          return;
        }

        if (!activePair) {
          jsonResponse(res, 404, { ok: false, error: "no_active_pair_pin" });
          return;
        }

        if (Date.now() > activePair.expiresAtMs) {
          clearPair("expired", { expiresAtMs: activePair.expiresAtMs });
          jsonResponse(res, 410, { ok: false, error: "pair_pin_expired" });
          return;
        }

        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          jsonResponse(res, 400, { ok: false, error: "invalid_request_body" });
          return;
        }
        const pin = sanitizeText(body?.pin, 8);
        if (!/^\d{4}$/.test(pin || "")) {
          jsonResponse(res, 400, { ok: false, error: "pair_pin_must_be_4_digits" });
          return;
        }
        if (!activePair) {
          jsonResponse(res, 404, { ok: false, error: "no_active_pair_pin" });
          return;
        }
        if (pin !== activePair.pin) {
          activePair.failedAttempts += 1;
          if (activePair.failedAttempts >= activePair.maxFailedAttempts) {
            clearPair("too_many_attempts", {
              attempts: activePair.failedAttempts
            });
          }
          jsonResponse(res, 401, { ok: false, error: "pair_pin_invalid" });
          return;
        }

        const redeemedByHost = parseRemoteIp(req.socket.remoteAddress);
        const active = activePair;
        const payload = {
          ok: true,
          payload: {
            gateway: active.gateway,
            meta: {
              hubDisplayName: active.hubDisplayName,
              issuedAtMs: active.issuedAtMs,
              expiresAtMs: active.expiresAtMs,
              redeemedByHost,
              redeemedAtMs: Date.now()
            }
          }
        };
        clearPair("redeemed", {
          redeemedByHost,
          hubDisplayName: active.hubDisplayName
        });
        jsonResponse(res, 200, payload);
      });
      httpServer.on("clientError", (error, socket) => {
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        options.onLog?.("warn", "Pair PIN HTTP client error", {
          message: error?.message || String(error)
        });
      });
      httpServer.on("error", (error) => {
        httpServerReady = null;
        options.onLog?.("error", "Pair PIN HTTP server error", {
          message: error?.message || String(error)
        });
      });
    }
    if (!httpServerReady) {
      httpServerReady = new Promise((resolve, reject) => {
        const handleListening = () => {
          cleanup();
          resolve();
        };
        const handleError = (error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          httpServer?.off("listening", handleListening);
          httpServer?.off("error", handleError);
        };
        httpServer.once("listening", handleListening);
        httpServer.once("error", handleError);
        try {
          httpServer.listen(redeemPort, "0.0.0.0");
        } catch (error) {
          handleError(error);
        }
      });
    }
    try {
      await httpServerReady;
    } catch (error) {
      const message = error?.message || String(error);
      options.onLog?.("error", "Pair PIN HTTP server failed to start", {
        message,
        redeemPort
      });
      if (httpServer) {
        try {
          httpServer.close();
        } catch {
          // Ignore close failures.
        }
      }
      httpServer = null;
      httpServerReady = null;
      throw error;
    }
  }

  function ensureDiscoverySocket() {
    if (discoverySocket) {
      return;
    }
    discoverySocket = dgram.createSocket("udp4");
    discoverySocket.on("error", (error) => {
      options.onLog?.("warn", "Pair PIN discovery error", { message: error.message });
    });
    discoverySocket.on("message", (message, remote) => {
      if (!activePair || Date.now() > activePair.expiresAtMs) {
        return;
      }
      const parsed = safeJsonParse(message.toString("utf8"), null);
      if (!parsed || parsed.type !== PAIR_DISCOVERY_MAGIC) {
        return;
      }
      const nonce = sanitizeText(parsed.nonce, 120) || "";
      const response = Buffer.from(
        JSON.stringify({
          type: PAIR_DISCOVERY_RESPONSE,
          nonce,
          hubDisplayName: activePair.hubDisplayName,
          redeemPort
        }),
        "utf8"
      );
      discoverySocket.send(response, remote.port, remote.address);
    });
    discoverySocket.bind(discoveryPort, () => {
      discoverySocket.setBroadcast(true);
    });
  }

  async function ensureStarted() {
    await ensureHttpServer();
    ensureDiscoverySocket();
  }

  function stop() {
    if (expireTimer) {
      clearTimeout(expireTimer);
      expireTimer = null;
    }
    activePair = null;
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
    httpServerReady = null;
    if (discoverySocket) {
      try {
        discoverySocket.close();
      } catch {
        // Ignore close failures.
      }
      discoverySocket = null;
    }
  }

  async function generate(payload = {}) {
    await ensureStarted();
    const gateway = normalizePairGateway(payload.gateway);
    const expiresMinutes = clampInt(payload.expiresMinutes, 1, 30, 5);
    const issuedAtMs = Date.now();
    const expiresAtMs = issuedAtMs + expiresMinutes * 60 * 1000;
    activePair = {
      pin: generatePin(),
      issuedAtMs,
      expiresAtMs,
      expiresMinutes,
      gateway,
      hubDisplayName: sanitizeText(payload.hubDisplayName, 120) || os.hostname(),
      failedAttempts: 0,
      maxFailedAttempts: 12
    };
    scheduleExpire(expiresAtMs);
    const event = setLastEvent("generated", {
      expiresAtMs,
      hubDisplayName: activePair.hubDisplayName
    });
    notifyStateChange({
      active: {
        pin: activePair.pin,
        issuedAtMs,
        expiresAtMs,
        expiresMinutes,
        hubDisplayName: activePair.hubDisplayName
      },
      lastEvent: event,
      relay: {
        discoveryPort,
        redeemPort,
        hostHints: listHubHostHints()
      }
    });
    return {
      pin: activePair.pin,
      issuedAtMs,
      expiresAtMs,
      expiresMinutes,
      hubDisplayName: activePair.hubDisplayName,
      relay: {
        discoveryPort,
        redeemPort,
        hostHints: listHubHostHints()
      },
      lastEvent
    };
  }

  function getState() {
    return {
      active: activePair
        ? {
            pin: activePair.pin,
            issuedAtMs: activePair.issuedAtMs,
            expiresAtMs: activePair.expiresAtMs,
            expiresMinutes: activePair.expiresMinutes,
            hubDisplayName: activePair.hubDisplayName
          }
        : null,
      lastEvent: lastEvent || null,
      relay: {
        discoveryPort,
        redeemPort,
        hostHints: listHubHostHints()
      }
    };
  }

  return {
    generate,
    clear: clearPair,
    getState,
    stop
  };
}

async function discoverPairPinHubs(params = {}) {
  const timeoutMs = clampInt(params.timeoutMs, 500, 12_000, 3200);
  const attempts = clampInt(params.attempts, 1, 10, 5);
  const intervalMs = clampInt(params.intervalMs, 120, 2000, 420);
  const discoveryPort = clampInt(params.discoveryPort, 1024, 65535, PAIR_DISCOVERY_PORT);
  const nonce = crypto.randomUUID();
  const payload = Buffer.from(
    JSON.stringify({
      type: PAIR_DISCOVERY_MAGIC,
      nonce
    }),
    "utf8"
  );

  return await new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const results = new Map();
    let settled = false;
    let sendTimer = null;

    const sendProbe = () => {
      const targets = listDiscoveryTargets();
      for (const target of targets) {
        socket.send(payload, discoveryPort, target, () => {});
      }
    };

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (sendTimer) {
        clearInterval(sendTimer);
        sendTimer = null;
      }
      try {
        socket.close();
      } catch {
        // Ignore close failures.
      }
      resolve([...results.values()]);
    };

    socket.on("error", () => {
      finish();
    });

    socket.on("message", (message, remote) => {
      const parsed = safeJsonParse(message.toString("utf8"), null);
      if (!parsed || parsed.type !== PAIR_DISCOVERY_RESPONSE || parsed.nonce !== nonce) {
        return;
      }
      const key = `${remote.address}:${parsed.redeemPort || PAIR_REDEEM_PORT}`;
      results.set(key, {
        host: remote.address,
        redeemPort: clampInt(parsed.redeemPort, 1024, 65535, PAIR_REDEEM_PORT),
        hubDisplayName: sanitizeText(parsed.hubDisplayName, 120) || "",
        discoveredAtMs: Date.now()
      });
    });

    socket.bind(0, () => {
      socket.setBroadcast(true);
      let sent = 0;
      sendProbe();
      sent += 1;
      sendTimer = setInterval(() => {
        if (sent >= attempts) {
          if (sendTimer) {
            clearInterval(sendTimer);
            sendTimer = null;
          }
          return;
        }
        sendProbe();
        sent += 1;
      }, intervalMs);
      sendTimer.unref?.();
    });

    setTimeout(finish, timeoutMs).unref?.();
  });
}

function redeemPairPin(params = {}) {
  const host = sanitizeText(params.host, 200);
  const pin = sanitizeText(params.pin, 8);
  const timeoutMs = clampInt(params.timeoutMs, 500, 12_000, 5000);
  const port = clampInt(params.port, 1024, 65535, PAIR_REDEEM_PORT);
  if (!host) {
    throw new Error("Controller host is required.");
  }
  if (!/^\d{4}$/.test(pin || "")) {
    throw new Error("Pair PIN must be exactly 4 digits.");
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ pin });
    const req = http.request(
      {
        method: "POST",
        host,
        port,
        path: "/v1/pair/redeem",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk.toString("utf8");
        });
        res.on("end", () => {
          const parsed = safeJsonParse(text, null);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && parsed?.ok) {
            resolve(parsed);
            return;
          }
          const message =
            sanitizeText(parsed?.error, 200) ||
            sanitizeText(parsed?.message, 200) ||
            `Controller rejected pairing (${res.statusCode || "unknown"})`;
          reject(new Error(message));
        });
      }
    );
    req.on("error", (error) => {
      reject(error);
    });
    req.on("timeout", () => {
      req.destroy(new Error("Pairing request timed out."));
    });
    req.write(body);
    req.end();
  });
}

module.exports = {
  PAIR_DISCOVERY_PORT,
  PAIR_REDEEM_PORT,
  createHubPairPinService,
  normalizePairGateway,
  discoverPairPinHubs,
  redeemPairPin
};
