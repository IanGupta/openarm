const fs = require("node:fs");
const path = require("node:path");
const { safeJsonParse, sanitizeText } = require("./util");

const STORE_VERSION = 1;

function normalizeRole(role) {
  const normalized = sanitizeText(role, 80).toLowerCase();
  return normalized || "operator";
}

function emptyStore() {
  return {
    version: STORE_VERSION,
    devices: {}
  };
}

function readStore(storePath) {
  try {
    if (!storePath || !fs.existsSync(storePath)) {
      return emptyStore();
    }
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = safeJsonParse(raw, null);
    if (
      parsed &&
      parsed.version === STORE_VERSION &&
      parsed.devices &&
      typeof parsed.devices === "object"
    ) {
      return parsed;
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
}

function writeStore(storePath, store) {
  if (!storePath) {
    return;
  }
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function loadDeviceAuthToken({ storePath, deviceId, role }) {
  const normalizedDeviceId = sanitizeText(deviceId, 200);
  if (!normalizedDeviceId) {
    return null;
  }
  const store = readStore(storePath);
  const byDevice = store.devices?.[normalizedDeviceId];
  if (!byDevice || typeof byDevice !== "object") {
    return null;
  }
  const record = byDevice[normalizeRole(role)];
  if (!record || typeof record !== "object") {
    return null;
  }
  const token = sanitizeText(record.token, 4096);
  if (!token) {
    return null;
  }
  const scopes = Array.isArray(record.scopes)
    ? record.scopes.map((value) => sanitizeText(value, 200)).filter(Boolean)
    : [];
  return {
    token,
    scopes
  };
}

function storeDeviceAuthToken({ storePath, deviceId, role, token, scopes }) {
  const normalizedDeviceId = sanitizeText(deviceId, 200);
  const normalizedToken = sanitizeText(token, 4096);
  if (!normalizedDeviceId || !normalizedToken || !storePath) {
    return;
  }
  const store = readStore(storePath);
  if (!store.devices[normalizedDeviceId] || typeof store.devices[normalizedDeviceId] !== "object") {
    store.devices[normalizedDeviceId] = {};
  }
  store.devices[normalizedDeviceId][normalizeRole(role)] = {
    token: normalizedToken,
    scopes: Array.isArray(scopes)
      ? scopes.map((value) => sanitizeText(value, 200)).filter(Boolean)
      : [],
    updatedAtMs: Date.now()
  };
  writeStore(storePath, store);
}

module.exports = {
  loadDeviceAuthToken,
  storeDeviceAuthToken
};
