const crypto = require("node:crypto");
const WebSocket = require("ws");
const { PROTOCOL_VERSION } = require("./constants");
const {
  normalizeFingerprint,
  sanitizeText,
  safeJsonParse
} = require("./util");
const {
  loadDeviceAuthToken,
  storeDeviceAuthToken
} = require("./device-auth-store");
const {
  buildDeviceAuthPayload,
  signDevicePayload,
  publicKeyRawBase64UrlFromPem
} = require("./device-identity");

class GatewayRpcClient {
  constructor(options) {
    this.options = options;
    this.socket = null;
    this.pending = new Map();
    this.backoffMs = 1000;
    this.closed = false;
    this.connectNonce = null;
    this.connectSent = false;
    this.connectTimer = null;
    this.lastTick = null;
    this.tickIntervalMs = 30_000;
    this.tickTimer = null;
  }

  start() {
    this.closed = false;
    if (this.options.tlsFingerprint && !this.options.url.startsWith("wss://")) {
      const error = new Error("gateway tls fingerprint requires wss:// gateway url");
      this.options.onConnectError?.(error);
      this.options.onStatus?.({
        status: "error",
        lastError: error.message,
        connectedAt: null
      });
      return;
    }
    this.connect();
  }

  stop() {
    this.closed = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.stopTickWatch();
    this.flushPendingErrors(new Error("gateway client stopped"));
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Ignore close failures.
      }
      this.socket = null;
    }
  }

  isConnected() {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN && this.connectSent);
  }

  async request(method, params, opts = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("gateway not connected");
    }
    const configuredTimeoutMs = Number(this.options.requestTimeoutMs);
    const baseTimeoutMs =
      Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
        ? Math.floor(configuredTimeoutMs)
        : 45_000;
    const configuredFinalTimeoutMs = Number(this.options.finalRequestTimeoutMs);
    const finalTimeoutMs =
      Number.isFinite(configuredFinalTimeoutMs) && configuredFinalTimeoutMs > 0
        ? Math.floor(configuredFinalTimeoutMs)
        : Math.max(baseTimeoutMs * 3, 120_000);
    const overrideTimeoutMs = Number(opts.timeoutMs);
    const timeoutMs =
      Number.isFinite(overrideTimeoutMs) && overrideTimeoutMs > 0
        ? Math.floor(overrideTimeoutMs)
        : opts.expectFinal
          ? finalTimeoutMs
          : baseTimeoutMs;

    const id = crypto.randomUUID();
    const frame = {
      type: "req",
      id,
      method,
      params
    };
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(id);
        if (!pending) {
          return;
        }
        this.pending.delete(id);
        pending.reject(new Error(`gateway request timed out after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      timeout.unref?.();
      this.pending.set(id, {
        resolve,
        reject,
        expectFinal: Boolean(opts.expectFinal),
        timeout
      });
      try {
        this.socket.send(JSON.stringify(frame));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  connect() {
    if (this.closed) {
      return;
    }

    const wsOptions = {
      maxPayload: 25 * 1024 * 1024
    };

    const expectedFingerprint = normalizeFingerprint(this.options.tlsFingerprint);
    if (this.options.url.startsWith("wss://") && expectedFingerprint) {
      wsOptions.rejectUnauthorized = false;
      wsOptions.checkServerIdentity = (_host, cert) => {
        const actual = normalizeFingerprint(cert?.fingerprint256 || "");
        if (!actual) {
          return new Error("gateway tls fingerprint unavailable");
        }
        if (actual !== expectedFingerprint) {
          return new Error("gateway tls fingerprint mismatch");
        }
        return undefined;
      };
    }

    this.options.onStatus?.({
      status: "connecting",
      lastError: "",
      connectedAt: null
    });

    this.socket = new WebSocket(this.options.url, wsOptions);

    this.socket.on("open", () => {
      this.queueConnect();
    });

    this.socket.on("message", (data) => {
      this.handleMessage(data.toString("utf8"));
    });

    this.socket.on("close", (code, reasonRaw) => {
      const reason = reasonRaw?.toString("utf8") || "";
      this.stopTickWatch();
      this.flushPendingErrors(new Error(`gateway closed (${code}): ${reason}`));
      this.socket = null;
      this.options.onStatus?.({
        status: "disconnected",
        lastError: reason || `closed (${code})`,
        connectedAt: null
      });
      this.options.onClose?.(code, reason);
      if (!this.closed) {
        this.scheduleReconnect();
      }
    });

    this.socket.on("error", (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onConnectError?.(err);
      this.options.onStatus?.({
        status: "error",
        lastError: err.message,
        connectedAt: null
      });
    });
  }

  queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }

  async sendConnect() {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const signedAtMs = Date.now();
    const nonce = this.connectNonce || undefined;
    const role = this.options.role;
    const explicitToken = sanitizeText(this.options.token, 4096) || null;
    const persistedToken = explicitToken
      ? null
      : loadDeviceAuthToken({
          storePath: this.options.deviceAuthStorePath,
          deviceId: this.options.deviceIdentity.deviceId,
          role
        })?.token || null;
    const authToken = explicitToken || persistedToken || undefined;
    const authPassword = sanitizeText(this.options.password, 4096) || undefined;
    const auth =
      authToken || authPassword
        ? {
            token: authToken,
            password: authPassword
          }
        : undefined;
    const scopes =
      Array.isArray(this.options.scopes) && this.options.scopes.length > 0
        ? this.options.scopes
        : role === "node"
          ? []
          : ["operator.admin"];

    const signaturePayload = buildDeviceAuthPayload({
      deviceId: this.options.deviceIdentity.deviceId,
      clientId: this.options.clientId,
      clientMode: this.options.clientMode,
      role,
      scopes,
      signedAtMs,
      token: authToken || null,
      nonce: nonce || null
    });

    const params = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.options.clientId,
        displayName: this.options.clientDisplayName || undefined,
        version: this.options.clientVersion,
        platform: this.options.platform,
        mode: this.options.clientMode,
        instanceId: this.options.instanceId || undefined
      },
      caps: this.options.caps || [],
      commands: this.options.commands || undefined,
      pathEnv: this.options.pathEnv || undefined,
      role,
      scopes,
      auth,
      device: {
        id: this.options.deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(this.options.deviceIdentity.publicKeyPem),
        signature: signDevicePayload(this.options.deviceIdentity.privateKeyPem, signaturePayload),
        signedAt: signedAtMs,
        nonce
      }
    };

    try {
      const hello = await this.request("connect", params);
      const policyTick = Number(hello?.policy?.tickIntervalMs);
      this.tickIntervalMs =
        Number.isFinite(policyTick) && policyTick > 0 ? Math.max(policyTick, 1000) : 30_000;
      this.lastTick = Date.now();
      this.startTickWatch();
      const issuedDeviceToken = sanitizeText(hello?.auth?.deviceToken, 4096);
      if (issuedDeviceToken) {
        storeDeviceAuthToken({
          storePath: this.options.deviceAuthStorePath,
          deviceId: this.options.deviceIdentity.deviceId,
          role: sanitizeText(hello?.auth?.role, 80) || role,
          token: issuedDeviceToken,
          scopes: Array.isArray(hello?.auth?.scopes) ? hello.auth.scopes : []
        });
      }
      this.backoffMs = 1000;
      this.options.onStatus?.({
        status: "connected",
        lastError: "",
        connectedAt: new Date().toISOString(),
        hello
      });
      this.options.onHello?.(hello);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onConnectError?.(err);
      if (this.socket) {
        try {
          const reason = sanitizeText(err.message, 120) || "connect failed";
          this.socket.close(1008, reason);
        } catch {
          // Ignore close failures.
        }
      }
    }
  }

  handleMessage(raw) {
    const frame = safeJsonParse(raw, null);
    if (!frame || typeof frame !== "object") {
      return;
    }
    if (frame.type === "event") {
      if (frame.event === "connect.challenge") {
        const nonce = typeof frame?.payload?.nonce === "string" ? frame.payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }
      if (frame.event === "tick") {
        this.lastTick = Date.now();
      }
      this.options.onEvent?.(frame);
      return;
    }
    if (frame.type === "res" && typeof frame.id === "string") {
      const pending = this.pending.get(frame.id);
      if (!pending) {
        return;
      }
      if (pending.expectFinal && frame?.payload?.status === "accepted") {
        return;
      }
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      this.pending.delete(frame.id);
      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(new Error(frame?.error?.message || "gateway request failed"));
      }
    }
  }

  flushPendingErrors(error) {
    for (const [, pending] of this.pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    }
    this.pending.clear();
  }

  scheduleReconnect() {
    this.stopTickWatch();
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 30_000);
    setTimeout(() => {
      if (!this.closed) {
        this.connect();
      }
    }, delay).unref();
  }

  startTickWatch() {
    this.stopTickWatch();
    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (this.closed || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }
      if (!this.lastTick) {
        return;
      }
      const gapMs = Date.now() - this.lastTick;
      if (gapMs > this.tickIntervalMs * 2) {
        try {
          this.socket.close(4000, "tick timeout");
        } catch {
          // Ignore close failures.
        }
      }
    }, interval);
    this.tickTimer.unref?.();
  }

  stopTickWatch() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.lastTick = null;
  }
}

module.exports = {
  GatewayRpcClient
};
