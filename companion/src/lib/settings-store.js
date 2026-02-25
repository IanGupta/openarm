const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DEFAULT_SESSION_KEY } = require("./constants");
const { randomId, sanitizeText, safeJsonParse } = require("./util");

function normalizeMode(value) {
  const mode = sanitizeText(value, 20).toLowerCase();
  if (mode === "arm" || mode === "hub") {
    return mode;
  }
  return "";
}

function createDefaultSettings() {
  return {
    mode: "",
    onboardingComplete: false,
    gatewayUrl: "ws://127.0.0.1:18789",
    gatewayToken: "",
    gatewayPassword: "",
    gatewayTlsFingerprint: "",
    nodeDisplayName: os.hostname(),
    nodeInstanceId: randomId("openarm-node"),
    sessionKey: DEFAULT_SESSION_KEY,
    enableExtendedCommands: true,
    // Hub dashboard feature toggles (UI-only; enforced client-side).
    hubFileTransferEnabled: true,
    hubRemoteControlEnabled: true,
    autoConnectArm: true,
    autoConnectHub: true,
    autoEnableAgentIntegration: true,
    agentIntegrationVersion: 0,
    agentIntegrationGateway: "",
    agentIntegrationLastSyncedAt: "",
    pairPinExpiryMinutes: 5,
    pairedDeviceAliases: {},
    hiddenPairedDevices: [],
    wolDevices: {},
    launchOnStartup: true,
    minimizeToTray: true,
    closeToTray: true,
    updateChecksEnabled: true,
    updatePromptEnabled: true,
    updateCheckIntervalHours: 24,
    lastUpdateCheckAt: ""
  };
}

function normalizeSettings(input) {
  const base = createDefaultSettings();
  const raw = input && typeof input === "object" ? input : {};
  const legacyAutoConnectNode = raw.autoConnectNode;
  const legacyAutoConnectOperator = raw.autoConnectOperator;
  const merged = {
    ...base,
    ...raw
  };
  merged.gatewayUrl = sanitizeText(merged.gatewayUrl, 512) || base.gatewayUrl;
  merged.gatewayToken = sanitizeText(merged.gatewayToken, 4096);
  merged.gatewayPassword = sanitizeText(merged.gatewayPassword, 4096);
  merged.gatewayTlsFingerprint = sanitizeText(merged.gatewayTlsFingerprint, 400);
  merged.nodeDisplayName = sanitizeText(merged.nodeDisplayName, 120) || base.nodeDisplayName;
  merged.nodeInstanceId = sanitizeText(merged.nodeInstanceId, 120) || randomId("openarm-node");
  merged.sessionKey = sanitizeText(merged.sessionKey, 120) || DEFAULT_SESSION_KEY;
  merged.enableExtendedCommands = Boolean(merged.enableExtendedCommands);
  merged.hubFileTransferEnabled =
    merged.hubFileTransferEnabled !== undefined ? Boolean(merged.hubFileTransferEnabled) : true;
  merged.hubRemoteControlEnabled =
    merged.hubRemoteControlEnabled !== undefined ? Boolean(merged.hubRemoteControlEnabled) : true;
  merged.mode = normalizeMode(merged.mode);
  merged.onboardingComplete = Boolean(merged.onboardingComplete);
  merged.autoConnectArm =
    merged.autoConnectArm !== undefined ? Boolean(merged.autoConnectArm) : Boolean(legacyAutoConnectNode);
  merged.autoConnectHub =
    merged.autoConnectHub !== undefined
      ? Boolean(merged.autoConnectHub)
      : Boolean(legacyAutoConnectOperator);
  merged.autoEnableAgentIntegration =
    merged.autoEnableAgentIntegration !== undefined ? Boolean(merged.autoEnableAgentIntegration) : true;
  merged.agentIntegrationVersion = Math.max(0, Math.floor(Number(merged.agentIntegrationVersion) || 0));
  merged.agentIntegrationGateway = sanitizeText(merged.agentIntegrationGateway, 512);
  merged.agentIntegrationLastSyncedAt = sanitizeText(merged.agentIntegrationLastSyncedAt, 64);
  const legacyPairCodeExpiryMinutes =
    Number(raw.pairCodeExpiryMinutes) > 0 ? Number(raw.pairCodeExpiryMinutes) : 0;
  merged.pairPinExpiryMinutes = Math.max(
    1,
    Math.min(
      30,
      Number(merged.pairPinExpiryMinutes) || legacyPairCodeExpiryMinutes || base.pairPinExpiryMinutes
    )
  );

  // Paired device UI metadata (stored locally in OpenArm).
  const aliasRaw = merged.pairedDeviceAliases && typeof merged.pairedDeviceAliases === "object"
    ? merged.pairedDeviceAliases
    : {};
  const normalizedAliases = {};
  for (const [key, value] of Object.entries(aliasRaw)) {
    const deviceId = sanitizeText(key, 220);
    const name = sanitizeText(value, 64);
    if (!deviceId || !name) {
      continue;
    }
    normalizedAliases[deviceId] = name;
  }
  merged.pairedDeviceAliases = normalizedAliases;
  merged.hiddenPairedDevices = Array.isArray(merged.hiddenPairedDevices)
    ? merged.hiddenPairedDevices
        .map((entry) => sanitizeText(entry, 220))
        .filter(Boolean)
        .slice(0, 2000)
    : [];

  const wolRaw = merged.wolDevices && typeof merged.wolDevices === "object" ? merged.wolDevices : {};
  const normalizedWol = {};
  for (const [key, value] of Object.entries(wolRaw)) {
    const deviceId = sanitizeText(key, 220);
    if (!deviceId || !value || typeof value !== "object") {
      continue;
    }
    const mac = sanitizeText(value.mac, 64);
    if (!mac) {
      continue;
    }
    const address = sanitizeText(value.address || value.broadcast || value.broadcastAddress, 120) || "";
    const port =
      Number(value.port) > 0 && Number(value.port) <= 65535
        ? Number(value.port)
        : 9;
    normalizedWol[deviceId] = {
      mac,
      address,
      port
    };
  }
  merged.wolDevices = normalizedWol;
  merged.launchOnStartup = merged.launchOnStartup !== undefined ? Boolean(merged.launchOnStartup) : true;
  merged.minimizeToTray = merged.minimizeToTray !== undefined ? Boolean(merged.minimizeToTray) : true;
  merged.closeToTray = merged.closeToTray !== undefined ? Boolean(merged.closeToTray) : true;
  merged.updateChecksEnabled = merged.updateChecksEnabled !== undefined ? Boolean(merged.updateChecksEnabled) : true;
  merged.updatePromptEnabled = merged.updatePromptEnabled !== undefined ? Boolean(merged.updatePromptEnabled) : true;
  merged.updateCheckIntervalHours = Math.max(6, Math.min(168, Number(merged.updateCheckIntervalHours) || 24));
  merged.lastUpdateCheckAt = sanitizeText(merged.lastUpdateCheckAt, 64);

  return merged;
}

async function loadSettings(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeSettings(safeJsonParse(raw, {}));
  } catch {
    return createDefaultSettings();
  }
}

async function saveSettings(filePath, settings) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const normalized = normalizeSettings(settings);
  await fs.writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

module.exports = {
  createDefaultSettings,
  normalizeSettings,
  loadSettings,
  saveSettings
};
