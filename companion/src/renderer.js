/* ──────────────────────────────────────────────────────────────
   OpenArm – Renderer
   ────────────────────────────────────────────────────────────── */

const state = {
  settings: null,
  bootstrap: null,
  nodeConnection: null,
  operatorConnection: null,
  nodes: [],
  devicePairing: {
    pending: [],
    paired: [],
    fetchedAt: null,
  },
  selectedRole: "",
  stepIndex: 0,
  redeemedPair: null,
  generatedPair: null,
  pairPin: {
    active: null,
    lastEvent: null,
    relay: null,
  },
  guidedSetup: {
    role: "",
    inProgress: false,
    title: "Ready to verify setup",
    subtitle: "OpenArm will validate each connection step before finishing.",
    pinText: "",
    items: [],
  },
  addArmWizard: {
    open: false,
    inProgress: false,
    pin: "",
    issuedAtMs: 0,
    redeemedAtMs: 0,
    redeemedByHost: "",
    approvedRequestId: "",
    approvedDeviceId: "",
    title: "Ready",
    subtitle: "Waiting to generate a PIN.",
    items: [],
  },
  selectedNodeId: "",
  logs: [],
  pairingTimer: null,
  pairingTimerMs: 0,
  activeTab: "pairing",
  devicesTab: "paired",
  fileTransfer: {
    file: null,
    name: "",
    size: 0,
    targetNodeId: "",
    destPath: "",
  },
  nodeLastConnectedAtMs: {},
};

/* ── Element references ── */
const elements = {
  modePill: document.querySelector("#modePill"),
  rerunSetupBtn: document.querySelector("#rerunSetupBtn"),
  onboardingView: document.querySelector("#onboardingView"),
  runtimeView: document.querySelector("#runtimeView"),
  steps: [...document.querySelectorAll(".step")],
  stepLines: [...document.querySelectorAll(".step-line")],
  slides: [...document.querySelectorAll(".slide")],
  roleArmCard: document.querySelector("#roleArmCard"),
  roleHubCard: document.querySelector("#roleHubCard"),
  step1Next: document.querySelector("#step1Next"),
  step2Title: document.querySelector("#step2Title"),
  step2Description: document.querySelector("#step2Description"),
  step2Back: document.querySelector("#step2Back"),
  step2Next: document.querySelector("#step2Next"),
  step3Back: document.querySelector("#step3Back"),
  finishSetupBtn: document.querySelector("#finishSetupBtn"),
  setupSummary: document.querySelector("#setupSummary"),
  finishStatus: document.querySelector("#finishStatus"),
  guidedSetupPanel: document.querySelector("#guidedSetupPanel"),
  guidedSpinner: document.querySelector("#guidedSpinner"),
  guidedTitle: document.querySelector("#guidedTitle"),
  guidedSubtitle: document.querySelector("#guidedSubtitle"),
  guidedProgressBar: document.querySelector("#guidedProgressBar"),
  guidedPinBadge: document.querySelector("#guidedPinBadge"),
  guidedChecklist: document.querySelector("#guidedChecklist"),
  armPairFields: document.querySelector("#armPairFields"),
  armPairPinInput: document.querySelector("#armPairPinInput"),
  armPairHostInput: document.querySelector("#armPairHostInput"),
  redeemPairPinBtn: document.querySelector("#redeemPairPinBtn"),
  armPairDecodeResult: document.querySelector("#armPairDecodeResult"),
  hubGatewayFields: document.querySelector("#hubGatewayFields"),
  gatewayUrlInput: document.querySelector("#gatewayUrlInput"),
  gatewayTokenInput: document.querySelector("#gatewayTokenInput"),
  gatewayPasswordInput: document.querySelector("#gatewayPasswordInput"),
  gatewayTlsInput: document.querySelector("#gatewayTlsInput"),
  runAutoFixBtn: document.querySelector("#runAutoFixBtn"),
  autoFixStatus: document.querySelector("#autoFixStatus"),
  openclawDetection: document.querySelector("#openclawDetection"),
  nodeStatusBadge: document.querySelector("#nodeStatusBadge"),
  operatorStatusBadge: document.querySelector("#operatorStatusBadge"),
  connectionMeta: document.querySelector("#connectionMeta"),
  armWorkspace: document.querySelector("#armWorkspace"),
  armConnectBtn: document.querySelector("#armConnectBtn"),
  armDisconnectBtn: document.querySelector("#armDisconnectBtn"),
  armGatewaySummary: document.querySelector("#armGatewaySummary"),
  armLogFeed: document.querySelector("#armLogFeed"),
  hubWorkspace: document.querySelector("#hubWorkspace"),
  hubConnectBtn: document.querySelector("#hubConnectBtn"),
  hubDisconnectBtn: document.querySelector("#hubDisconnectBtn"),
  refreshPairingBtn: document.querySelector("#refreshPairingBtn"),
  generatePairBtn: document.querySelector("#generatePairBtn"),
  pairCodeValue: document.querySelector("#pairCodeValue"),
  copyPairCodeBtn: document.querySelector("#copyPairCodeBtn"),
  pairCodeMeta: document.querySelector("#pairCodeMeta"),
  pairingStatus: document.querySelector("#pairingStatus"),
  pendingCount: document.querySelector("#pendingCount"),
  pairedCount: document.querySelector("#pairedCount"),
  manageHiddenBtn: document.querySelector("#manageHiddenBtn"),
  pendingHeader: document.querySelector("#pendingHeader"),
  pendingPairs: document.querySelector("#pendingPairs"),
  pairedHeader: document.querySelector("#pairedHeader"),
  pairedArms: document.querySelector("#pairedArms"),
  refreshNodesBtn: document.querySelector("#refreshNodesBtn"),
  targetNode: document.querySelector("#targetNode"),
  commandInput: document.querySelector("#commandInput"),
  commandRunBtn: document.querySelector("#commandRunBtn"),
  commandOutputBody: document.querySelector("#commandOutputBody"),
  loadHistoryBtn: document.querySelector("#loadHistoryBtn"),
  chatList: document.querySelector("#chatList"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  clearLogsBtn: document.querySelector("#clearLogsBtn"),
  logList: document.querySelector("#logList"),
  hubTabBar: document.querySelector("#hubTabBar"),
  toasts: document.querySelector("#toasts"),
  successOverlay: document.querySelector("#successOverlay"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmOk: document.querySelector("#confirmOk"),
  confirmCancel: document.querySelector("#confirmCancel"),
  renameDialog: document.querySelector("#renameDialog"),
  renameTitle: document.querySelector("#renameTitle"),
  renameInput: document.querySelector("#renameInput"),
  renameCancel: document.querySelector("#renameCancel"),
  renameSave: document.querySelector("#renameSave"),
  wolDialog: document.querySelector("#wolDialog"),
  wolTitle: document.querySelector("#wolTitle"),
  wolSubtitle: document.querySelector("#wolSubtitle"),
  wolMacInput: document.querySelector("#wolMacInput"),
  wolAddressInput: document.querySelector("#wolAddressInput"),
  wolPortInput: document.querySelector("#wolPortInput"),
  wolCancel: document.querySelector("#wolCancel"),
  wolRemove: document.querySelector("#wolRemove"),
  wolSave: document.querySelector("#wolSave"),
  addArmDialog: document.querySelector("#addArmDialog"),
  addArmTitle: document.querySelector("#addArmTitle"),
  addArmSubtitle: document.querySelector("#addArmSubtitle"),
  addArmPinValue: document.querySelector("#addArmPinValue"),
  addArmCopyPinBtn: document.querySelector("#addArmCopyPinBtn"),
  addArmRegenerateBtn: document.querySelector("#addArmRegenerateBtn"),
  addArmPinMeta: document.querySelector("#addArmPinMeta"),
  addArmGuidedPanel: document.querySelector("#addArmGuidedPanel"),
  addArmSpinner: document.querySelector("#addArmSpinner"),
  addArmStatusTitle: document.querySelector("#addArmStatusTitle"),
  addArmStatusSubtitle: document.querySelector("#addArmStatusSubtitle"),
  addArmProgressBar: document.querySelector("#addArmProgressBar"),
  addArmChecklist: document.querySelector("#addArmChecklist"),
  addArmClose: document.querySelector("#addArmClose"),
  // Devices dialog (manage paired/pending/hidden)
  devicesDialog: document.querySelector("#devicesDialog"),
  devicesDialogClose: document.querySelector("#devicesDialogClose"),
  devicesTabBar: document.querySelector("#devicesTabBar"),
  devicesTabButtons: [
    ...document.querySelectorAll("#devicesTabBar [data-devices-tab]"),
  ],
  devicesTabContents: [
    ...document.querySelectorAll("#devicesDialog [data-devices-tab-content]"),
  ],
  hiddenDevicesList: document.querySelector("#hiddenDevicesList"),
  // Onboarding-specific gateway inputs
  obGatewayUrlInput: document.querySelector("#obGatewayUrlInput"),
  obGatewayTokenInput: document.querySelector("#obGatewayTokenInput"),
  obGatewayPasswordInput: document.querySelector("#obGatewayPasswordInput"),
  obGatewayTlsInput: document.querySelector("#obGatewayTlsInput"),
  obRunAutoFixBtn: document.querySelector("#obRunAutoFixBtn"),
  obAutoFixStatus: document.querySelector("#obAutoFixStatus"),
  obOpenclawDetection: document.querySelector("#obOpenclawDetection"),
  // Advanced settings dialog
  advancedDialog: document.querySelector("#advancedDialog"),
  advancedClose: document.querySelector("#advancedClose"),
  advancedSave: document.querySelector("#advancedSave"),
  launchOnStartupInput: document.querySelector("#launchOnStartupInput"),
  minimizeToTrayInput: document.querySelector("#minimizeToTrayInput"),
  closeToTrayInput: document.querySelector("#closeToTrayInput"),
  updateChecksEnabledInput: document.querySelector("#updateChecksEnabledInput"),
  updatePromptEnabledInput: document.querySelector("#updatePromptEnabledInput"),
  checkUpdatesNowBtn: document.querySelector("#checkUpdatesNowBtn"),
  updateStatusText: document.querySelector("#updateStatusText"),
  // Command dialog
  commandDialog: document.querySelector("#commandDialog"),
  commandDialogClose: document.querySelector("#commandDialogClose"),
  // Chat dialog
  chatDialog: document.querySelector("#chatDialog"),
  chatDialogClose: document.querySelector("#chatDialogClose"),
  // Logs dialog
  logsDialog: document.querySelector("#logsDialog"),
  logsDialogClose: document.querySelector("#logsDialogClose"),
  // File transfer dialog
  fileTransferDialog: document.querySelector("#fileTransferDialog"),
  fileTargetNode: document.querySelector("#fileTargetNode"),
  fileRefreshNodesBtn: document.querySelector("#fileRefreshNodesBtn"),
  fileDestPathInput: document.querySelector("#fileDestPathInput"),
  filePickInput: document.querySelector("#filePickInput"),
  fileTransferStatus: document.querySelector("#fileTransferStatus"),
  fileTransferClose: document.querySelector("#fileTransferClose"),
  fileTransferSend: document.querySelector("#fileTransferSend"),
  // Topology
  armStationNodes: document.querySelector("#armStationNodes"),
  connectionLinesEl: document.querySelector("#connectionLines"),
  hubCenter: document.querySelector(".hub-center"),
  // Footer and panel buttons
  advancedSettingsBtn: document.querySelector("#advancedSettingsBtn"),
  removeDeviceBtn: document.querySelector("#removeDeviceBtn"),
  disconnectAllBtn: document.querySelector("#disconnectAllBtn"),
  sendFileBtn: document.querySelector("#sendFileBtn"),
  sendTaskBtn: document.querySelector("#sendTaskBtn"),
  // Group settings panel
  fileTransferCheck: document.querySelector("#fileTransferCheck"),
  fileTransferToggle: document.querySelector("#fileTransferToggle"),
  remoteControlCheck: document.querySelector("#remoteControlCheck"),
  remoteControlToggle: document.querySelector("#remoteControlToggle"),
  // Comm status panel
  reconnectBtn: document.querySelector("#reconnectBtn"),
  // Comm status
  armToArmStatus: document.querySelector("#armToArmStatus"),
  clawToArmsStatus: document.querySelector("#clawToArmsStatus"),
  armToArmIndicator: document.querySelector("#armToArmIndicator"),
  clawToArmsIndicator: document.querySelector("#clawToArmsIndicator"),
  // Advanced Settings utilities
  utilitiesQuickCommandBtn: document.querySelector("#utilitiesQuickCommandBtn"),
  utilitiesViewLogsBtn: document.querySelector("#utilitiesViewLogsBtn"),
  utilitiesRerunSetupBtn: document.querySelector("#utilitiesRerunSetupBtn"),
};

let syncingGroupSettings = false;

/* ── Utilities ── */

function asTime(value) {
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return "--";
  }
}

function relativeTime(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function statusText(status) {
  const text = status || "disconnected";
  return text[0].toUpperCase() + text.slice(1);
}

function statusDotClass(status) {
  const s = (status || "").toLowerCase();
  if (s === "connected") return "connected";
  if (s === "connecting" || s === "reconnecting") return "connecting";
  return "disconnected";
}

/* ── Toast system ── */

function showToast(message, type = "error") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "error" ? "✕" : type === "success" ? "✓" : "ℹ";
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toast.addEventListener("click", () => removeToast(toast));
  elements.toasts.appendChild(toast);
  const duration = type === "error" ? 8000 : 5000;
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add("removing");
  setTimeout(() => toast.remove(), 300);
}

/* ── Loading states ── */

function setLoading(button, loading) {
  if (!button) return;
  if (loading) {
    if (button.dataset.loadingActive === "1") {
      return;
    }
    button.dataset.loadingActive = "1";
    button.dataset.originalHtml = button.innerHTML;
    const labelText = button.textContent?.trim() || button.getAttribute("aria-label") || "Working";
    const spinner = document.createElement("span");
    spinner.className = "btn-spinner";
    spinner.setAttribute("aria-hidden", "true");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "";
    button.appendChild(spinner);
    const label = document.createElement("span");
    label.textContent = labelText;
    button.appendChild(label);
    return;
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.loadingActive === "1") {
    delete button.dataset.loadingActive;
    if (Object.prototype.hasOwnProperty.call(button.dataset, "originalHtml")) {
      button.innerHTML = button.dataset.originalHtml || "";
      delete button.dataset.originalHtml;
    }
  }
}

async function withLoading(button, fn) {
  setLoading(button, true);
  try {
    return await fn();
  } finally {
    setLoading(button, false);
  }
}

/* ── Confirmation dialog ── */

function confirm(title, message) {
  return new Promise((resolve) => {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    const handleOk = () => {
      cleanup();
      resolve(true);
    };
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      elements.confirmOk.removeEventListener("click", handleOk);
      elements.confirmCancel.removeEventListener("click", handleCancel);
      elements.confirmDialog.close();
    };
    elements.confirmOk.addEventListener("click", handleOk);
    elements.confirmCancel.addEventListener("click", handleCancel);
    elements.confirmDialog.showModal();
  });
}

function promptRename({ title, currentValue } = {}) {
  return new Promise((resolve) => {
    elements.renameTitle.textContent = title || "Rename Device";
    elements.renameInput.value = currentValue || "";
    elements.renameInput.selectionStart = 0;
    elements.renameInput.selectionEnd = elements.renameInput.value.length;

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };
    const handleSave = () => {
      const value = (elements.renameInput.value || "").trim();
      cleanup();
      resolve(value || "");
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        handleSave();
      }
    };
    const cleanup = () => {
      elements.renameCancel.removeEventListener("click", handleCancel);
      elements.renameSave.removeEventListener("click", handleSave);
      elements.renameDialog.removeEventListener("keydown", handleKeydown);
      elements.renameDialog.close();
    };

    elements.renameCancel.addEventListener("click", handleCancel);
    elements.renameSave.addEventListener("click", handleSave);
    elements.renameDialog.addEventListener("keydown", handleKeydown);
    elements.renameDialog.showModal();
    setTimeout(() => elements.renameInput?.focus(), 60);
  });
}

function normalizeMac(value) {
  const hex = (value || "")
    .toString()
    .trim()
    .replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) {
    return "";
  }
  return hex.match(/.{2}/g).join(":").toUpperCase();
}

function promptWakeOnLan({ title, subtitle, currentValue } = {}) {
  return new Promise((resolve) => {
    elements.wolTitle.textContent = title || "Wake-on-LAN";
    elements.wolSubtitle.textContent =
      subtitle ||
      "Send a Wake-on-LAN packet to this device. Works only if the device supports WOL and is on the same LAN as the sender.";

    elements.wolMacInput.value = (currentValue?.mac || "").toString();
    elements.wolAddressInput.value = (currentValue?.address || "").toString();
    elements.wolPortInput.value = String(
      Number(currentValue?.port) > 0 ? Number(currentValue.port) : 9,
    );
    elements.wolRemove.disabled = !currentValue?.mac;

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleRemove = () => {
      cleanup();
      resolve({ remove: true });
    };

    const handleSave = () => {
      const mac = normalizeMac(elements.wolMacInput.value);
      if (!mac) {
        showToast(
          "Enter a valid MAC address (example: AA:BB:CC:DD:EE:FF).",
          "error",
        );
        setTimeout(() => elements.wolMacInput?.focus(), 20);
        return;
      }
      const address = (elements.wolAddressInput.value || "").trim();
      const port =
        Number(elements.wolPortInput.value) > 0
          ? Number(elements.wolPortInput.value)
          : 9;
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        showToast("UDP port must be between 1 and 65535.", "error");
        setTimeout(() => elements.wolPortInput?.focus(), 20);
        return;
      }
      cleanup();
      resolve({
        mac,
        address,
        port,
      });
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        handleSave();
      }
    };

    const cleanup = () => {
      elements.wolCancel.removeEventListener("click", handleCancel);
      elements.wolRemove.removeEventListener("click", handleRemove);
      elements.wolSave.removeEventListener("click", handleSave);
      elements.wolDialog.removeEventListener("keydown", handleKeydown);
      elements.wolDialog.close();
    };

    elements.wolCancel.addEventListener("click", handleCancel);
    elements.wolRemove.addEventListener("click", handleRemove);
    elements.wolSave.addEventListener("click", handleSave);
    elements.wolDialog.addEventListener("keydown", handleKeydown);
    elements.wolDialog.showModal();
    setTimeout(() => elements.wolMacInput?.focus(), 60);
  });
}

function deviceKey(entry) {
  return firstNonEmpty([entry?.deviceId, entry?.nodeId, entry?.requestId], "");
}

function aliasForDevice(deviceId) {
  const map = state.settings?.pairedDeviceAliases;
  if (!deviceId || !map || typeof map !== "object") {
    return "";
  }
  return (map[deviceId] || "").toString().trim();
}

function hiddenDeviceSet() {
  const list = Array.isArray(state.settings?.hiddenPairedDevices)
    ? state.settings.hiddenPairedDevices
    : [];
  return new Set(list.filter(Boolean));
}

async function setDeviceAlias(deviceId, alias) {
  const safeId = (deviceId || "").trim();
  if (!safeId) {
    throw new Error("Missing device id.");
  }
  const existing =
    state.settings?.pairedDeviceAliases &&
    typeof state.settings.pairedDeviceAliases === "object"
      ? state.settings.pairedDeviceAliases
      : {};
  const next = { ...existing };
  const name = (alias || "").trim();
  if (!name) {
    delete next[safeId];
  } else {
    next[safeId] = name;
  }
  await callOk(
    window.openArm.saveSettings({ pairedDeviceAliases: next }),
    "Failed to save device name.",
  );
}

async function hideDevice(deviceId) {
  const safeId = (deviceId || "").trim();
  if (!safeId) {
    throw new Error("Missing device id.");
  }
  const next = hiddenDeviceSet();
  next.add(safeId);
  await callOk(
    window.openArm.saveSettings({ hiddenPairedDevices: [...next] }),
    "Failed to remove device.",
  );
}

async function unhideDevice(deviceId) {
  const safeId = (deviceId || "").trim();
  if (!safeId) {
    return;
  }
  const next = hiddenDeviceSet();
  next.delete(safeId);
  await callOk(
    window.openArm.saveSettings({ hiddenPairedDevices: [...next] }),
    "Failed to restore device.",
  );
}

function wolConfigForDevice(deviceId) {
  const map = state.settings?.wolDevices;
  if (!deviceId || !map || typeof map !== "object") {
    return null;
  }
  const entry = map[deviceId];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const mac = (entry.mac || "").toString().trim();
  if (!mac) {
    return null;
  }
  return {
    mac,
    address: (entry.address || "").toString().trim(),
    port: Number(entry.port) > 0 ? Number(entry.port) : 9,
  };
}

async function setWolConfig(deviceId, configOrNull) {
  const safeId = (deviceId || "").trim();
  if (!safeId) {
    throw new Error("Missing device id.");
  }
  const existing =
    state.settings?.wolDevices && typeof state.settings.wolDevices === "object"
      ? state.settings.wolDevices
      : {};
  const next = { ...existing };
  if (!configOrNull) {
    delete next[safeId];
  } else {
    next[safeId] = {
      mac: configOrNull.mac,
      address: (configOrNull.address || "").trim(),
      port: Number(configOrNull.port) > 0 ? Number(configOrNull.port) : 9,
    };
  }
  await callOk(
    window.openArm.saveSettings({ wolDevices: next }),
    "Failed to save Wake-on-LAN settings.",
  );
}

function formatAgeFromMs(valueMs) {
  const ms = Number(valueMs);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000)
    return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
}

function updateNodePresence(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  for (const node of list) {
    const nodeId = (node?.nodeId || "").toString().trim();
    if (!nodeId) continue;
    if (node?.connected) {
      const connectedAtMs =
        Number(node?.connectedAtMs) > 0
          ? Number(node.connectedAtMs)
          : Date.now();
      const prev = Number(state.nodeLastConnectedAtMs?.[nodeId]) || 0;
      if (connectedAtMs > prev) {
        state.nodeLastConnectedAtMs[nodeId] = connectedAtMs;
      }
    }
  }
}

function presenceForDevice(deviceId) {
  const node = (Array.isArray(state.nodes) ? state.nodes : []).find(
    (entry) => entry?.nodeId === deviceId,
  );
  if (node?.connected) {
    return { kind: "connected", label: "Connected", detail: "" };
  }
  const last = Number(state.nodeLastConnectedAtMs?.[deviceId]) || 0;
  if (last > 0) {
    const recentMs = 10 * 60_000;
    const age = Date.now() - last;
    if (age <= recentMs) {
      return {
        kind: "recent",
        label: "Connected recently",
        detail: `last online ${formatAgeFromMs(last)}`,
      };
    }
    return {
      kind: "offline",
      label: "Disconnected",
      detail: `last online ${formatAgeFromMs(last)}`,
    };
  }
  return { kind: "offline", label: "Disconnected", detail: "" };
}

/* ── Badge renderer ── */

function setBadgeStatus(element, text, status) {
  const dot = element.querySelector(".status-dot");
  if (dot) {
    dot.className = `status-dot ${statusDotClass(status)}`;
  }
  // Set text content after the dot
  const spans = element.querySelectorAll(":scope > span:not(.status-dot)");
  if (spans.length) {
    spans[0].textContent = text;
  } else {
    // Preserve dot, update text
    const dotEl = element.querySelector(".status-dot");
    element.textContent = "";
    if (dotEl) element.appendChild(dotEl);
    element.appendChild(document.createTextNode(text));
  }
}

/* ── Logs ── */

function pushLog(entry) {
  state.logs.unshift(entry);
  state.logs = state.logs.slice(0, 300);
  renderLogs();
}

function renderLogs() {
  if (elements.logList) elements.logList.innerHTML = "";
  if (elements.armLogFeed) elements.armLogFeed.innerHTML = "";
  if (!state.logs.length) {
    const empty = createEmptyState(
      "📋",
      "No log entries yet. Activity will appear here.",
    );
    if (elements.logList) elements.logList.appendChild(empty.cloneNode(true));
    if (elements.armLogFeed) elements.armLogFeed.appendChild(empty);
    return;
  }
  for (const entry of state.logs) {
    const row = document.createElement("article");
    row.className = "log-line";
    const levelColor =
      entry.level === "error"
        ? "color: #f85149"
        : entry.level === "warn"
          ? "color: #d29922"
          : "";
    row.innerHTML = `<div><strong style="${levelColor}">${(entry.level || "info").toUpperCase()}</strong> ${escapeHtml(entry.message)}</div><div class="meta">${asTime(entry.timestamp)}</div>`;
    if (elements.logList) elements.logList.appendChild(row.cloneNode(true));
    if (elements.armLogFeed) elements.armLogFeed.appendChild(row);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function createEmptyState(icon, text) {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.innerHTML = `<div class="empty-icon">${icon}</div><p>${text}</p>`;
  return el;
}

/* ── Detection ── */

function renderDetection() {
  const targets = [
    elements.openclawDetection,
    elements.obOpenclawDetection,
  ].filter(Boolean);
  for (const target of targets) target.innerHTML = "";
  const detection = state.bootstrap?.openclaw;
  if (!detection) {
    for (const target of targets)
      target.innerHTML = "<li>No OpenClaw detection data available.</li>";
    return;
  }
  const lines = [];
  if (detection.detectedCliPath) {
    lines.push(`CLI found: ${detection.detectedCliPath}`);
  } else {
    lines.push("CLI not found on PATH (openclaw/clawdbot).");
  }
  if (detection.detectedConfigPath) {
    lines.push(`Config found: ${detection.detectedConfigPath}`);
  } else {
    lines.push(
      "Config not auto-detected. You can still enter Gateway URL/token manually.",
    );
  }
  if (Array.isArray(detection.configCandidates)) {
    const existing = detection.configCandidates
      .filter((item) => item.exists)
      .slice(0, 3);
    for (const candidate of existing) {
      lines.push(`Detected candidate: ${candidate.path}`);
    }
  }
  for (const line of lines) {
    for (const target of targets) {
      const li = document.createElement("li");
      li.textContent = line;
      target.appendChild(li);
    }
  }
}

/* ── Pair PIN state ── */

function mergePairPinState(next, previous = state.pairPin) {
  if (!next || typeof next !== "object") {
    return previous || { active: null, lastEvent: null, relay: null };
  }
  return {
    active: next.active || null,
    lastEvent: next.lastEvent || previous?.lastEvent || null,
    relay: next.relay || previous?.relay || null,
  };
}

function pairEventKey(event) {
  if (!event || typeof event !== "object") return "";
  return `${event.reason || "unknown"}:${Number(event.atMs) || 0}`;
}

function firstNonEmpty(values, fallback = "") {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function describePairEntity(entry) {
  const name = firstNonEmpty(
    [
      entry?.displayName,
      entry?.deviceDisplayName,
      entry?.name,
      entry?.nodeDisplayName,
      entry?.nodeName,
      entry?.nodeId,
      entry?.deviceId,
      entry?.requestId,
    ],
    "Unnamed arm",
  );
  const platform = firstNonEmpty(
    [entry?.platform, entry?.devicePlatform, entry?.nodePlatform],
    "unknown platform",
  );
  const timestamp =
    entry?.ts ||
    entry?.timestamp ||
    entry?.requestedAt ||
    entry?.pairedAt ||
    entry?.createdAt ||
    null;
  return { name, platform, timestamp };
}

function pairPinEventMessage(event) {
  if (!event || typeof event !== "object") return "";
  const reason = (event.reason || "").toLowerCase();
  const at = event.atMs ? asTime(event.atMs) : "recently";
  if (reason === "generated") return `Pair PIN generated at ${at}.`;
  if (reason === "redeemed") {
    const host = firstNonEmpty(
      [event.details?.redeemedByHost],
      "unknown device",
    );
    return `Pair PIN redeemed at ${at} by ${host}. Ask the Arm user to click Finish and Connect, then approve below.`;
  }
  if (reason === "expired")
    return `Last Pair PIN expired at ${at}. Generate a new PIN to pair another Arm.`;
  if (reason === "too_many_attempts")
    return "Pair PIN was locked after too many invalid attempts. Generate a new PIN.";
  return `Pair PIN update: ${reason} (${at}).`;
}

function createGuidedPlan(role) {
  if (role === "arm") {
    return [
      {
        id: "save",
        label: "Save gateway settings",
        status: "pending",
        detail: "",
      },
      {
        id: "connect",
        label: "Connect Arm to Gateway",
        status: "pending",
        detail: "",
      },
      {
        id: "approve",
        label: "Wait for Controller Station approval",
        status: "pending",
        detail: "",
      },
      {
        id: "verify",
        label: "Verify stable Arm connection",
        status: "pending",
        detail: "",
      },
    ];
  }
  if (role === "hub") {
    return [
      {
        id: "save",
        label: "Save gateway settings",
        status: "pending",
        detail: "",
      },
      {
        id: "connect",
        label: "Connect Controller Station",
        status: "pending",
        detail: "",
      },
      {
        id: "autofix",
        label: "Expose gateway to LAN (auto-fix)",
        status: "pending",
        detail: "",
      },
      { id: "pin", label: "Generate Pair PIN", status: "pending", detail: "" },
      {
        id: "redeem",
        label: "Wait for Arm PIN redemption",
        status: "pending",
        detail: "",
      },
      {
        id: "approve",
        label: "Approve Arm request",
        status: "pending",
        detail: "",
      },
      {
        id: "paired",
        label: "Confirm Arm is paired and connected",
        status: "pending",
        detail: "",
      },
      {
        id: "agent",
        label: "Enable OpenArm tool access for agent",
        status: "pending",
        detail: "",
      },
    ];
  }
  return [];
}

function guidedIconForStatus(status) {
  if (status === "success") return "✓";
  if (status === "error") return "!";
  if (status === "running") return "•";
  return "○";
}

function guidedSummaryForRole(role) {
  if (role === "arm") {
    return {
      title: "Arm verification pending",
      subtitle:
        "We will connect this Arm, wait for Controller approval if needed, and verify a stable link.",
    };
  }
  if (role === "hub") {
    return {
      title: "Controller handshake pending",
      subtitle:
        "We will guide pairing end-to-end, verify the Arm appears, and enable the OpenClaw agent to use OpenArm (nodes tool) for Arm connections.",
    };
  }
  return {
    title: "Ready to verify setup",
    subtitle: "OpenArm will validate each connection step before finishing.",
  };
}

function createAddArmPlan() {
  return [
    { id: "pin", label: "Generate PIN", status: "pending", detail: "" },
    { id: "redeem", label: "Arm redeems PIN", status: "pending", detail: "" },
    { id: "approve", label: "Approve request", status: "pending", detail: "" },
    { id: "connect", label: "Arm connects", status: "pending", detail: "" },
  ];
}

function resetAddArmWizard() {
  state.addArmWizard = {
    open: state.addArmWizard?.open || false,
    inProgress: false,
    pin: "",
    issuedAtMs: 0,
    redeemedAtMs: 0,
    redeemedByHost: "",
    approvedRequestId: "",
    approvedDeviceId: "",
    approving: false,
    baselineNodeIds: [],
    title: "Ready",
    subtitle: "Waiting to generate a PIN.",
    items: createAddArmPlan(),
  };
  renderAddArmWizard();
}

function updateAddArmStep(stepId, status, detail = "") {
  const step = state.addArmWizard.items.find((item) => item.id === stepId);
  if (!step) return;
  step.status = status;
  if (detail) {
    step.detail = detail;
  }
  renderAddArmWizard();
}

function addArmProgressPercent(items) {
  return guidedProgressPercent(items);
}

function renderAddArmWizard() {
  if (!elements.addArmDialog) return;
  const wizard = state.addArmWizard || {};
  const items = Array.isArray(wizard.items) ? wizard.items : [];

  elements.addArmPinValue.value = wizard.pin || "";
  elements.addArmPinMeta.textContent = wizard.pin
    ? `Enter PIN ${wizard.pin} on the Arm device.`
    : "Generate a PIN to begin.";

  elements.addArmStatusTitle.textContent = wizard.title || "Add an Arm";
  elements.addArmStatusSubtitle.textContent = wizard.subtitle || "";

  const hasError = items.some((item) => item.status === "error");
  const allDone =
    items.length > 0 && items.every((item) => item.status === "success");
  elements.addArmSpinner.classList.remove("idle", "done", "error");
  if (hasError) {
    elements.addArmSpinner.classList.add("error");
  } else if (allDone && !wizard.inProgress) {
    elements.addArmSpinner.classList.add("done");
  } else if (!wizard.inProgress) {
    elements.addArmSpinner.classList.add("idle");
  }

  elements.addArmProgressBar.style.width = `${addArmProgressPercent(items)}%`;
  elements.addArmChecklist.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("article");
    row.className = `guided-item ${item.status || "pending"}`;
    row.innerHTML = `
      <span class="guided-icon">${guidedIconForStatus(item.status)}</span>
      <div class="guided-item-main">
        <div class="guided-item-label">${escapeHtml(item.label)}</div>
        <div class="guided-item-detail">${escapeHtml(item.detail || "Waiting...")}</div>
      </div>
    `;
    elements.addArmChecklist.appendChild(row);
  }
}

async function openAddArmWizard({ regenerate = false } = {}) {
  if (state.settings?.mode !== "hub") {
    showToast("Switch this device to Controller Station mode first.", "error");
    return;
  }
  if (state.operatorConnection?.status !== "connected") {
    const attempt = await window.openArm.connectForMode().catch(() => null);
    if (!attempt?.ok) {
      showToast(
        attempt?.error?.message ||
          "Controller is not connected to the gateway.",
        "error",
      );
      return;
    }
    const connected = await waitForCondition({
      timeoutMs: 10_000,
      intervalMs: 400,
      check: () => state.operatorConnection?.status === "connected",
    });
    if (!connected) {
      showToast(
        "Controller could not connect to the gateway in time.",
        "error",
      );
      return;
    }
  }

  if (!state.addArmWizard?.open || regenerate) {
    resetAddArmWizard();
  }

  state.addArmWizard.open = true;
  state.addArmWizard.inProgress = true;
  state.addArmWizard.baselineNodeIds = (
    Array.isArray(state.nodes) ? state.nodes : []
  )
    .map((node) => node?.nodeId)
    .filter(Boolean);
  state.addArmWizard.title = "Generating PIN...";
  state.addArmWizard.subtitle = "One moment.";
  renderAddArmWizard();

  if (!elements.addArmDialog.open) {
    elements.addArmDialog.showModal();
  }

  const response = await window.openArm.generatePairPin({});
  if (!response?.ok) {
    state.addArmWizard.inProgress = false;
    state.addArmWizard.title = "PIN failed";
    state.addArmWizard.subtitle =
      response?.error?.message || "Failed to generate a PIN.";
    updateAddArmStep("pin", "error", state.addArmWizard.subtitle);
    return;
  }

  const generated = response.generated;
  state.addArmWizard.pin = generated?.pin || "";
  state.addArmWizard.issuedAtMs = Number(generated?.issuedAtMs || Date.now());
  state.addArmWizard.redeemedAtMs = 0;
  state.addArmWizard.redeemedByHost = "";
  state.addArmWizard.approvedRequestId = "";
  state.addArmWizard.approvedDeviceId = "";
  state.addArmWizard.approving = false;
  state.addArmWizard.items = createAddArmPlan();

  state.addArmWizard.title = "PIN ready";
  state.addArmWizard.subtitle =
    "Ask the Arm user to enter the PIN. OpenArm will handle the rest.";
  updateAddArmStep(
    "pin",
    "success",
    `PIN ${state.addArmWizard.pin} generated.`,
  );
  updateAddArmStep(
    "redeem",
    "running",
    "Waiting for the Arm to redeem the PIN...",
  );

  // Keep the main Pairing tab in sync.
  state.generatedPair = generated;
  if (elements.pairCodeValue) {
    elements.pairCodeValue.value = state.addArmWizard.pin;
  }
  if (elements.pairCodeMeta) {
    const expiresAt = generated?.expiresAtMs
      ? new Date(generated.expiresAtMs).toLocaleString()
      : "unknown";
    elements.pairCodeMeta.textContent = `PIN valid until ${expiresAt}. Enter this 4-digit PIN on the Arm.`;
  }

  // Kick an immediate refresh so the UI feels instant.
  void window.openArm.listDevicePairing().catch(() => {});
  void window.openArm.listNodes().catch(() => {});
  maybeStartPairingRefresh();
  renderAddArmWizard();
}

function selectPendingRequestForWizard({ redeemedByHost, redeemedAtMs } = {}) {
  const pending = Array.isArray(state.devicePairing?.pending)
    ? state.devicePairing.pending
    : [];
  if (!pending.length) {
    return null;
  }

  // Normalize an IP string: strip the IPv6-mapped IPv4 prefix (::ffff:) and
  // surrounding brackets so "::ffff:192.168.7.175" compares equal to "192.168.7.175".
  const normalizeIp = (raw) =>
    String(raw || "")
      .trim()
      .replace(/^::ffff:/i, "")
      .replace(/^\[|\]$/g, "");

  // Extract an IP from a pending request object, trying every field name the
  // OpenClaw gateway may use.
  const ipFromItem = (item) =>
    normalizeIp(
      item?.remoteIp ||
        item?.remoteAddress ||
        item?.ip ||
        item?.host ||
        item?.sourceIp ||
        item?.clientIp ||
        "",
    );

  if (redeemedByHost) {
    const normalizedHost = normalizeIp(redeemedByHost);
    const byHost = pending.find((item) => ipFromItem(item) === normalizedHost);
    if (byHost) {
      return byHost;
    }
  }

  // Timestamp-based fallback: accept requests that arrived within the 30-second
  // window before (or any time after) PIN redemption.  Try every field name the
  // gateway may use for the request timestamp.
  const recentThreshold =
    Number(redeemedAtMs) > 0 ? Number(redeemedAtMs) - 30_000 : 0;
  const tsFromItem = (item) => {
    const raw =
      item?.ts ||
      item?.timestamp ||
      item?.requestedAt ||
      item?.createdAt ||
      item?.at ||
      0;
    return Number(new Date(raw));
  };
  const recent = pending.filter((item) => {
    const ts = tsFromItem(item);
    return ts && ts >= recentThreshold;
  });
  if (recent.length === 1) {
    return recent[0];
  }

  // Last-resort: if only one request exists at all, it must be ours.
  if (pending.length === 1) {
    return pending[0];
  }
  return null;
}

async function maybeAdvanceAddArmWizard() {
  const wizard = state.addArmWizard;
  if (!wizard?.open || !wizard.inProgress) {
    return;
  }

  // If controller disconnects mid-wizard, show it immediately.
  if (state.operatorConnection?.status !== "connected") {
    wizard.title = "Controller disconnected";
    wizard.subtitle = "Reconnect the Controller Station to continue pairing.";
    updateAddArmStep("approve", "error", "Controller link is not connected.");
    wizard.inProgress = false;
    renderAddArmWizard();
    return;
  }

  // Redeem step.
  const event = state.pairPin?.lastEvent;
  if (
    wizard.issuedAtMs > 0 &&
    wizard.redeemedAtMs === 0 &&
    event?.reason === "redeemed" &&
    Number(event.atMs || 0) >= wizard.issuedAtMs
  ) {
    wizard.redeemedAtMs = Number(event.atMs || Date.now());
    wizard.redeemedByHost = String(event?.details?.redeemedByHost || "").trim();
    wizard.title = "PIN redeemed";
    wizard.subtitle = "Looking for an approval request...";
    updateAddArmStep(
      "redeem",
      "success",
      wizard.redeemedByHost
        ? `Redeemed by ${wizard.redeemedByHost}.`
        : "Redeemed.",
    );
    updateAddArmStep(
      "approve",
      "running",
      "Waiting for the Arm to request approval...",
    );
    renderAddArmWizard();
  }

  // Approve step (auto-approve when we can safely identify the request).
  if (
    wizard.redeemedAtMs > 0 &&
    !wizard.approvedRequestId &&
    !wizard.approving
  ) {
    const request = selectPendingRequestForWizard({
      redeemedByHost: wizard.redeemedByHost,
      redeemedAtMs: wizard.redeemedAtMs,
    });

    if (request?.requestId) {
      const requestId = String(request.requestId);
      wizard.approvedRequestId = requestId;
      wizard.approving = true;
      wizard.title = "Approving request...";
      wizard.subtitle = "One moment.";
      updateAddArmStep(
        "approve",
        "running",
        `Approving request ${requestId}...`,
      );

      try {
        const approved = await window.openArm.approveDevicePair({ requestId });
        if (!approved?.ok) {
          throw new Error(approved?.error?.message || "Approve failed.");
        }
        const deviceId = (approved?.response?.device?.deviceId || "")
          .toString()
          .trim();
        wizard.approvedDeviceId = deviceId;
        wizard.title = "Approved";
        wizard.subtitle = "Waiting for the Arm to connect...";
        updateAddArmStep(
          "approve",
          "success",
          deviceId
            ? `Approved device ${deviceId.slice(0, 14)}...`
            : "Approved.",
        );
        updateAddArmStep(
          "connect",
          "running",
          "Waiting for the Arm to connect...",
        );
      } catch (error) {
        const message = error?.message || "Approve failed.";
        wizard.title = "Approval failed";
        wizard.subtitle = message;
        updateAddArmStep("approve", "error", message);
        wizard.inProgress = false;
      } finally {
        wizard.approving = false;
        renderAddArmWizard();
      }
    } else {
      // No pending request found yet.  Check whether the Arm already connected
      // without raising a pairing request at all — this happens when the gateway
      // accepts the PIN-issued token directly (no separate approval step).
      //
      // IMPORTANT: do NOT filter by baselineNodeIds here.  If the same physical
      // device is being re-paired it will already exist in the gateway's node list
      // (as disconnected) so its nodeId IS in the baseline.  Instead we check
      // whether the node reconnected AFTER the PIN was redeemed, using the
      // per-node last-connected timestamp that updateNodePresence() maintains.
      const nodes = Array.isArray(state.nodes) ? state.nodes : [];
      const redeemThreshold = wizard.redeemedAtMs || wizard.issuedAtMs || 0;
      const nodeConnectedAfterRedeem = (node) => {
        const nodeId = (node?.nodeId || "").toString();
        if (!nodeId) return false;
        if (!Boolean(node?.connected) && !Boolean(node?.connectedAt))
          return false;
        // Check our locally-tracked last-connected timestamp first.
        const trackedMs = Number(state.nodeLastConnectedAtMs?.[nodeId]) || 0;
        if (trackedMs > 0) return trackedMs >= redeemThreshold;
        // Fall back to timestamps the gateway may include on the node object.
        const gwMs =
          Number(node?.connectedAtMs) ||
          Number(node?.connectedAt_ms) ||
          Number(new Date(node?.connectedAt || 0)) ||
          0;
        if (gwMs > 0) return gwMs >= redeemThreshold;
        // Last resort: any currently-connected node that wasn't in the baseline.
        return !(wizard.baselineNodeIds || []).includes(nodeId);
      };
      const autoNode = nodes.find(nodeConnectedAfterRedeem);
      if (autoNode) {
        // Gateway auto-paired — skip manual approval and jump straight to "connected".
        wizard.approvedRequestId = "__auto__";
        wizard.approvedDeviceId = autoNode.nodeId || "";
        wizard.title = "Arm connected";
        wizard.subtitle = "This Arm is ready.";
        updateAddArmStep(
          "approve",
          "success",
          "Paired automatically by the gateway.",
        );
        const nodeId = wizard.approvedDeviceId;
        updateAddArmStep(
          "connect",
          "success",
          nodeId ? `Connected: ${nodeId.slice(0, 14)}...` : "Connected.",
        );
        wizard.inProgress = false;
        renderAddArmWizard();
        setTimeout(() => {
          if (wizard.open) {
            elements.addArmDialog.close();
            wizard.open = false;
          }
        }, 1100);
        return;
      }

      // Still genuinely waiting.
      const pendingCount = Array.isArray(state.devicePairing?.pending)
        ? state.devicePairing.pending.length
        : 0;
      if (pendingCount > 1) {
        updateAddArmStep(
          "approve",
          "running",
          "Multiple pending requests detected. Approve the correct Arm in the main list below, or try again with a new PIN.",
        );
      }
    }
  }

  // Connect step.
  if (wizard.approvedRequestId) {
    const nodes = Array.isArray(state.nodes) ? state.nodes : [];
    const approvedNode = wizard.approvedDeviceId
      ? nodes.find((node) => node?.nodeId === wizard.approvedDeviceId)
      : null;
    // Same post-redeem timestamp logic: a re-pairing device keeps its nodeId so
    // we cannot rely on "not in baseline".  Check connection time instead.
    const redeemThreshold2 = wizard.redeemedAtMs || wizard.issuedAtMs || 0;
    const newConnected = nodes.find((node) => {
      const nodeId = (node?.nodeId || "").toString();
      if (!nodeId) return false;
      const isLive =
        Boolean(node?.connected) ||
        Boolean(node?.connectedAt) ||
        Boolean(node?.paired);
      if (!isLive) return false;
      // Prefer timestamp-based detection.
      const trackedMs = Number(state.nodeLastConnectedAtMs?.[nodeId]) || 0;
      if (trackedMs > 0) return trackedMs >= redeemThreshold2;
      const gwMs =
        Number(node?.connectedAtMs) ||
        Number(node?.connectedAt_ms) ||
        Number(new Date(node?.connectedAt || 0)) ||
        0;
      if (gwMs > 0) return gwMs >= redeemThreshold2;
      // Last resort: not in baseline.
      return !(wizard.baselineNodeIds || []).includes(nodeId);
    });

    if (
      (approvedNode &&
        (approvedNode.connected ||
          approvedNode.connectedAt ||
          approvedNode.paired)) ||
      newConnected
    ) {
      const nodeId = approvedNode?.nodeId || newConnected?.nodeId || "";
      wizard.title = "Arm connected";
      wizard.subtitle = "This Arm is ready.";
      updateAddArmStep(
        "connect",
        "success",
        nodeId ? `Connected: ${nodeId.slice(0, 14)}...` : "Connected.",
      );
      wizard.inProgress = false;
      renderAddArmWizard();
      setTimeout(() => {
        if (wizard.open) {
          elements.addArmDialog.close();
          wizard.open = false;
        }
      }, 1100);
    }
  }
}

function resetGuidedSetup(role = state.selectedRole) {
  const summary = guidedSummaryForRole(role);
  state.guidedSetup = {
    role: role || "",
    inProgress: false,
    title: summary.title,
    subtitle: summary.subtitle,
    pinText: "",
    items: createGuidedPlan(role),
  };
  renderGuidedSetup();
}

function setGuidedMeta({ title, subtitle, pinText } = {}) {
  if (typeof title === "string") {
    state.guidedSetup.title = title;
  }
  if (typeof subtitle === "string") {
    state.guidedSetup.subtitle = subtitle;
  }
  if (typeof pinText === "string") {
    state.guidedSetup.pinText = pinText;
  }
  renderGuidedSetup();
}

function updateGuidedStep(stepId, status, detail = "") {
  const step = state.guidedSetup.items.find((item) => item.id === stepId);
  if (!step) {
    return;
  }
  step.status = status;
  if (detail) {
    step.detail = detail;
  }
  renderGuidedSetup();
}

function guidedProgressPercent(items) {
  if (!items.length) {
    return 0;
  }
  const done = items.filter((item) => item.status === "success").length;
  const running = items.some((item) => item.status === "running") ? 0.35 : 0;
  const raw = (done + running) / items.length;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

function renderGuidedSetup() {
  const guided = state.guidedSetup || {};
  const items = Array.isArray(guided.items) ? guided.items : [];
  elements.guidedTitle.textContent = guided.title || "Ready to verify setup";
  elements.guidedSubtitle.textContent =
    guided.subtitle ||
    "OpenArm will validate each connection step before finishing.";
  const pinText = (guided.pinText || "").trim();
  elements.guidedPinBadge.classList.toggle("hidden", !pinText);
  elements.guidedPinBadge.textContent = pinText || "";

  const hasError = items.some((item) => item.status === "error");
  const allDone =
    items.length > 0 && items.every((item) => item.status === "success");
  elements.guidedSpinner.classList.remove("idle", "done", "error");
  if (hasError) {
    elements.guidedSpinner.classList.add("error");
  } else if (allDone && !guided.inProgress) {
    elements.guidedSpinner.classList.add("done");
  } else if (!guided.inProgress) {
    elements.guidedSpinner.classList.add("idle");
  }

  elements.guidedProgressBar.style.width = `${guidedProgressPercent(items)}%`;
  elements.guidedChecklist.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("article");
    row.className = `guided-item ${item.status || "pending"}`;
    row.innerHTML = `
      <span class="guided-icon">${guidedIconForStatus(item.status)}</span>
      <div class="guided-item-main">
        <div class="guided-item-label">${escapeHtml(item.label)}</div>
        <div class="guided-item-detail">${escapeHtml(item.detail || "Waiting...")}</div>
      </div>
    `;
    elements.guidedChecklist.appendChild(row);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOk(promise, fallbackMessage) {
  const response = await promise;
  if (!response?.ok) {
    throw new Error(
      response?.error?.message || fallbackMessage || "Operation failed.",
    );
  }
  return response;
}

async function waitForCondition({
  check,
  timeoutMs,
  intervalMs = 500,
  onTick,
}) {
  const startedAt = Date.now();
  let iteration = 0;
  while (Date.now() - startedAt <= timeoutMs) {
    if (check()) {
      return true;
    }
    if (typeof onTick === "function") {
      await onTick({
        elapsedMs: Date.now() - startedAt,
        iteration,
      });
    }
    iteration += 1;
    await sleep(intervalMs);
  }
  return false;
}

async function refreshPairingAndNodes() {
  await callOk(
    window.openArm.listDevicePairing(),
    "Failed to refresh device pairing.",
  );
  await callOk(window.openArm.listNodes(), "Failed to refresh node list.");
}

function newestPendingRequest() {
  const pending = Array.isArray(state.devicePairing?.pending)
    ? state.devicePairing.pending
    : [];
  if (!pending.length) {
    return null;
  }
  return [...pending].sort((a, b) => {
    const aTs = Number(new Date(a?.ts || a?.timestamp || 0));
    const bTs = Number(new Date(b?.ts || b?.timestamp || 0));
    return bTs - aTs;
  })[0];
}

/* ── Role selection ── */

function setRole(role) {
  state.selectedRole = role;
  state.redeemedPair = null;
  if (elements.armPairDecodeResult)
    elements.armPairDecodeResult.textContent = "";
  elements.roleArmCard.classList.toggle("active", role === "arm");
  elements.roleHubCard.classList.toggle("active", role === "hub");
  elements.step1Next.disabled = !role;
  elements.finishSetupBtn.textContent =
    role === "arm" ? "Verify Arm and Finish" : "Run Guided Pairing";
  const isArm = role === "arm";
  elements.armPairFields.classList.toggle("hidden", !isArm);
  elements.hubGatewayFields.classList.toggle("hidden", isArm);
  if (isArm) {
    elements.step2Title.textContent = "Pair to Controller Station";
    elements.step2Description.textContent =
      "Generate a 4-digit Pair PIN on your Controller, redeem it here, then run verification.";
  } else {
    elements.step2Title.textContent = "Connect OpenClaw Gateway";
    elements.step2Description.textContent =
      "Set gateway credentials once. OpenArm will verify connectivity, pairing, and agent integration.";
  }
  resetGuidedSetup(role);
}

/* ── Stepper ── */

function setStep(index) {
  state.stepIndex = Math.max(0, Math.min(2, index));
  for (const step of elements.steps) {
    const idx = Number(step.dataset.stepIndex);
    step.classList.remove("active", "completed");
    if (idx === state.stepIndex) step.classList.add("active");
    else if (idx < state.stepIndex) step.classList.add("completed");
  }
  for (const line of elements.stepLines) {
    const lineIdx = Number(line.dataset.line);
    line.classList.toggle("done", lineIdx < state.stepIndex);
  }
  for (const slide of elements.slides) {
    slide.classList.toggle(
      "active",
      Number(slide.dataset.slide) === state.stepIndex,
    );
  }
  // Auto-focus PIN input
  if (state.stepIndex === 1 && state.selectedRole === "arm") {
    setTimeout(() => elements.armPairPinInput?.focus(), 100);
  }
}

/* ── Status rendering ── */

function renderStatus() {
  const mode = state.settings?.mode || "unset";
  elements.modePill.textContent = `Mode: ${mode === "unset" ? "Not set" : mode === "arm" ? "Arm Device" : "Controller Station"}`;

  const isArmMode = mode === "arm";
  const isControllerMode = mode === "hub";
  elements.nodeStatusBadge.classList.toggle("hidden", isControllerMode);
  elements.operatorStatusBadge.classList.toggle("hidden", isArmMode);

  const nodeStatus = state.nodeConnection?.status || "disconnected";
  const nodeDot = elements.nodeStatusBadge.querySelector(".status-dot");
  if (nodeDot) nodeDot.className = `status-dot ${statusDotClass(nodeStatus)}`;
  // Update text node
  updateBadgeText(elements.nodeStatusBadge, `Arm: ${statusText(nodeStatus)}`);

  const opStatus = state.operatorConnection?.status || "disconnected";
  const opDot = elements.operatorStatusBadge.querySelector(".status-dot");
  if (opDot) opDot.className = `status-dot ${statusDotClass(opStatus)}`;
  updateBadgeText(
    elements.operatorStatusBadge,
    `Controller: ${statusText(opStatus)}`,
  );

  const gatewayUrl = state.settings?.gatewayUrl || "(gateway not set)";
  const setConnectionMeta = (text, title) => {
    if (!elements.connectionMeta) return;
    elements.connectionMeta.textContent = text || "";
    elements.connectionMeta.title = title || "";
  };
  if (isArmMode) {
    const nodeId = state.nodeConnection?.nodeId;
    const nodeText = nodeId
      ? `Arm ID ${nodeId.slice(0, 14)}…`
      : "Arm not identified";
    const statusDetail =
      state.nodeConnection?.status === "connected"
        ? "Connected to gateway"
        : state.nodeConnection?.lastError
          ? `Arm error: ${state.nodeConnection.lastError}`
          : "Arm disconnected";
    const detailed = `${nodeText} · ${statusDetail} · ${gatewayUrl}`;
    const nodeConnected = state.nodeConnection?.status === "connected";
    setConnectionMeta(
      nodeConnected ? "Gateway Connected" : "Gateway Disconnected",
      detailed,
    );
    return;
  }
  if (isControllerMode) {
    const controllerText = state.operatorConnection?.connectedAt
      ? `Controller connected ${relativeTime(state.operatorConnection.connectedAt)}`
      : state.operatorConnection?.lastError
        ? `Controller error: ${state.operatorConnection.lastError}`
        : "Controller disconnected";
    const nodesOnline = (Array.isArray(state.nodes) ? state.nodes : []).filter(
      (node) => Boolean(node?.connected),
    ).length;
    const pairedCount = Array.isArray(state.devicePairing?.paired)
      ? state.devicePairing.paired.length
      : 0;
    const pendingCount = Array.isArray(state.devicePairing?.pending)
      ? state.devicePairing.pending.length
      : 0;
    const detailed = `${controllerText} · Nodes online: ${nodesOnline} · Paired: ${pairedCount} · Pending: ${pendingCount} · ${gatewayUrl}`;
    const opConnected = state.operatorConnection?.status === "connected";
    setConnectionMeta(
      opConnected ? "Connected Devices in Sync" : "Controller Disconnected",
      detailed,
    );
    return;
  }
  setConnectionMeta(gatewayUrl, gatewayUrl);
}

function updateBadgeText(badge, text) {
  const dot = badge.querySelector(".status-dot");
  badge.textContent = "";
  if (dot) {
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(" "));
  }
  badge.appendChild(document.createTextNode(text));
}

function renderRuntimeVisibility() {
  const completed = Boolean(state.settings?.onboardingComplete);
  elements.onboardingView.classList.toggle("hidden", completed);
  elements.runtimeView.classList.toggle("hidden", !completed);
  elements.rerunSetupBtn.classList.toggle("hidden", !completed);
  if (!completed) return;
  const mode = state.settings?.mode || "";
  elements.runtimeView.classList.toggle("mode-arm", mode === "arm");
  elements.runtimeView.classList.toggle("mode-hub", mode === "hub");

  // Keep legacy workspaces hidden; the dashboard handles runtime actions now.
  elements.armWorkspace?.classList.add("hidden");
  elements.hubWorkspace?.classList.add("hidden");
}

/* ── Tab navigation ── */

function setTab(tabName) {
  state.activeTab = tabName;
  const bar = elements.hubTabBar;
  if (!bar) return;
  for (const btn of bar.querySelectorAll("[data-tab]")) {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  }
  const scope = bar.closest("#hubWorkspace") || document;
  for (const content of scope.querySelectorAll("[data-tab-content]")) {
    content.classList.toggle("active", content.dataset.tabContent === tabName);
  }
}

/* ── Node select ── */

function renderNodeSelect() {
  const selects = [elements.targetNode, elements.fileTargetNode].filter(
    Boolean,
  );
  for (const sel of selects) {
    sel.innerHTML = "";
  }
  const hidden = hiddenDeviceSet();
  const visibleNodes = (Array.isArray(state.nodes) ? state.nodes : []).filter(
    (node) => {
      const id = (node?.nodeId || "").toString();
      return !id || !hidden.has(id);
    },
  );
  if (!visibleNodes.length) {
    for (const sel of selects) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No nodes available";
      sel.appendChild(option);
    }
    state.selectedNodeId = "";
    state.fileTransfer.targetNodeId = "";
    return;
  }
  if (!visibleNodes.some((node) => node.nodeId === state.selectedNodeId)) {
    state.selectedNodeId = visibleNodes[0].nodeId;
  }
  if (
    !visibleNodes.some(
      (node) => node.nodeId === state.fileTransfer.targetNodeId,
    )
  ) {
    state.fileTransfer.targetNodeId =
      state.selectedNodeId || visibleNodes[0].nodeId;
  }
  for (const node of visibleNodes) {
    const alias = aliasForDevice(node.nodeId);
    const display = alias || node.displayName || node.nodeId;
    const label = `${display} (${node.platform || "unknown"})`;

    if (elements.targetNode) {
      const option = document.createElement("option");
      option.value = node.nodeId;
      option.textContent = label;
      if (node.nodeId === state.selectedNodeId) option.selected = true;
      elements.targetNode.appendChild(option);
    }

    if (elements.fileTargetNode) {
      const option = document.createElement("option");
      option.value = node.nodeId;
      option.textContent = label;
      if (node.nodeId === state.fileTransfer.targetNodeId)
        option.selected = true;
      elements.fileTargetNode.appendChild(option);
    }
  }
}

/* ── Pairing list ── */

function renderPairingList() {
  elements.pendingPairs.innerHTML = "";
  elements.pairedArms.innerHTML = "";
  const pending = Array.isArray(state.devicePairing?.pending)
    ? state.devicePairing.pending
    : [];
  const paired = Array.isArray(state.devicePairing?.paired)
    ? state.devicePairing.paired
    : [];
  elements.pendingHeader?.classList.toggle("hidden", pending.length === 0);
  elements.pairedHeader?.classList.toggle("hidden", paired.length === 0);
  const hidden = hiddenDeviceSet();
  const visiblePaired = paired.filter((entry) => {
    const id = deviceKey(entry);
    return !id || !hidden.has(id);
  });
  const hiddenCount = Math.max(0, paired.length - visiblePaired.length);
  elements.pendingCount.textContent = `Pending: ${pending.length}`;
  elements.pairedCount.textContent = `Paired: ${visiblePaired.length}${hiddenCount ? ` (${hiddenCount} hidden)` : ""}`;
  if (elements.manageHiddenBtn) {
    elements.manageHiddenBtn.textContent = `Hidden: ${hidden.size}`;
    elements.manageHiddenBtn.disabled = hidden.size === 0;
  }

  if (pending.length) {
    for (const request of pending) {
      const details = describePairEntity(request);
      const requestId = firstNonEmpty([request.requestId], "");
      const timestampText = details.timestamp
        ? asTime(details.timestamp)
        : "just now";
      const actionHtml = requestId
        ? `<div class="inline-actions">
            <button class="primary pair-approve" data-request-id="${requestId}" type="button">Approve</button>
            <button class="danger-ghost pair-reject" data-request-id="${requestId}" type="button">Reject</button>
          </div>`
        : `<div class="meta">No request ID available</div>`;
      const row = document.createElement("article");
      row.className = "list-item";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(details.name)}</strong>
          <div class="meta">${requestId ? `Request ${requestId} · ` : ""}${escapeHtml(details.platform)} · received ${timestampText}</div>
        </div>
        ${actionHtml}
      `;
      elements.pendingPairs.appendChild(row);
    }
  } else {
    elements.pendingPairs.appendChild(
      createEmptyState("✓", "No pending approvals."),
    );
  }

  if (!visiblePaired.length) {
    elements.pairedArms.appendChild(
      createEmptyState(
        "🔗",
        hiddenCount
          ? "No visible paired devices. Open hidden devices to restore."
          : "No paired arms yet. After you approve a request, connected arms appear here.",
      ),
    );
  } else {
    for (const entry of visiblePaired) {
      const details = describePairEntity(entry);
      const pairedId = firstNonEmpty(
        [entry.nodeId, entry.deviceId, entry.requestId],
        "unknown",
      );
      const timestampText = details.timestamp
        ? asTime(details.timestamp)
        : "recently";
      const alias = aliasForDevice(pairedId);
      const displayName = alias || details.name;
      const presence = presenceForDevice(pairedId);
      const presenceHtml =
        pairedId && pairedId !== "unknown"
          ? `<span class="presence ${presence.kind}">
              <span class="presence-dot"></span>
              ${escapeHtml(presence.label)}
            </span>`
          : "";
      const presenceDetail = presence.detail
        ? ` · ${escapeHtml(presence.detail)}`
        : "";
      const wol = wolConfigForDevice(pairedId);
      const wakeLabel = wol ? "Wake" : "Set up Wake";
      const actions =
        pairedId && pairedId !== "unknown"
          ? `<div class="inline-actions">
            <button class="ghost pair-wake" data-device-id="${escapeHtml(pairedId)}" type="button" title="Wake this device (Shift-click to edit settings)">${wakeLabel}</button>
            <button class="ghost pair-rename" data-device-id="${escapeHtml(pairedId)}" type="button">Rename</button>
            <button class="danger-ghost pair-remove" data-device-id="${escapeHtml(pairedId)}" type="button">Remove</button>
          </div>`
          : "";
      const row = document.createElement("article");
      row.className = "list-item";
      if (pairedId && pairedId !== "unknown") {
        row.dataset.deviceId = pairedId;
      }
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(displayName)}</strong>
          <div class="meta">${presenceHtml}${presenceHtml ? " · " : ""}ID ${escapeHtml(pairedId)} · ${escapeHtml(details.platform)} · paired ${timestampText}${presenceDetail}</div>
        </div>
        ${actions}
      `;
      elements.pairedArms.appendChild(row);
    }
  }
}

/* ── Pair PIN state ── */

function renderPairPinState() {
  const active = state.pairPin?.active || null;
  const event = state.pairPin?.lastEvent || null;
  const eventMessage = pairPinEventMessage(event);
  const hints = Array.isArray(state.pairPin?.relay?.hostHints)
    ? state.pairPin.relay.hostHints.slice(0, 3)
    : [];
  const hintText = hints.length
    ? ` If auto-discovery fails, use Controller address: ${hints.join(", ")}`
    : "";

  if (!active) {
    elements.pairCodeValue.value = "";
    elements.pairCodeMeta.textContent =
      "Generate a 4-digit PIN to pair a new Arm.";
    elements.pairingStatus.textContent =
      eventMessage || "Waiting for the next pairing request.";
    return;
  }

  elements.pairCodeValue.value = active.pin || "";
  const expiresAt = active.expiresAtMs
    ? new Date(active.expiresAtMs).toLocaleTimeString()
    : "soon";
  elements.pairCodeMeta.textContent = `Active PIN expires at ${expiresAt}.${hintText}`;
  elements.pairingStatus.textContent =
    "PIN active. Ask the Arm user to enter this code now.";
}

/* ── Network topology rendering ── */

function renderTopology() {
  if (!elements.armStationNodes || !elements.connectionLinesEl) return;
  const mode = state.settings?.mode || "unset";
  const isArm = mode === "arm";

  elements.armStationNodes.innerHTML = "";
  elements.connectionLinesEl.innerHTML = "";

  const containerRect = elements.armStationNodes.getBoundingClientRect();
  const hubRect = elements.hubCenter?.getBoundingClientRect() || null;
  const hubX = hubRect
    ? hubRect.left - containerRect.left + hubRect.width / 2
    : containerRect.width / 2;
  const hubY = hubRect
    ? hubRect.top - containerRect.top + hubRect.height / 2 + 34
    : containerRect.height * 0.42;

  function looksLikeIp(value) {
    const text = (value || "").toString().trim();
    return /\d/.test(text) && (text.includes(".") || text.includes(":"));
  }

  function bestAddressForDevice(device) {
    const node = device?.node || null;
    const pair = device?.pairEntry || null;
    const candidates = [
      node?.ip,
      node?.host,
      node?.address,
      node?.remoteIp,
      node?.remoteAddress,
      node?.clientIp,
      node?.clientHost,
      pair?.remoteIp,
      pair?.ip,
      pair?.host,
    ];
    for (const raw of candidates) {
      const text = (raw || "").toString().trim();
      if (text) {
        return text;
      }
    }
    return "";
  }

  function deviceKind(device) {
    if (device?.connected) return "online";
    const status = (device?.node?.status || "").toString().toLowerCase();
    if (status.includes("connect")) return "connecting";
    return "offline";
  }

  function statusIconSvg(kind) {
    if (kind === "online") {
      return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="rgba(27, 160, 78, 0.20)"/><circle cx="8" cy="8" r="6" fill="#1BA04E"/><path d="M4.7 8.2l2.0 2.1 4.5-4.7" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    if (kind === "connecting") {
      return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="rgba(245, 158, 11, 0.18)"/><circle cx="8" cy="8" r="6" fill="#F59E0B"/><path d="M5 8h6" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`;
    }
    return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="rgba(148, 163, 184, 0.22)"/><circle cx="8" cy="8" r="6" fill="#94A3B8"/><path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  const robotArmSvg = `
    <svg class="robot-arm" viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="armBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#1f2a44"/>
          <stop offset="1" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="armTrim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#5b86ff"/>
          <stop offset="1" stop-color="#1d5cff"/>
        </linearGradient>
      </defs>
      <path d="M26 94c0-10 8-18 18-18h18c10 0 18 8 18 18v10H26V94z" fill="url(#armBody)" stroke="rgba(255,255,255,0.55)"/>
      <rect x="42" y="60" width="40" height="16" rx="8" fill="url(#armBody)" stroke="rgba(255,255,255,0.55)"/>
      <path d="M62 60c0-18 12-34 30-40l10-3c6-2 12 2 13 8l3 14c1 6-3 12-9 13l-10 2c-10 2-17 11-17 21v2H62v-17z" fill="url(#armBody)" stroke="rgba(255,255,255,0.55)"/>
      <circle cx="62" cy="68" r="10" fill="#e6eefc" stroke="rgba(15,23,42,0.35)"/>
      <circle cx="62" cy="68" r="4" fill="url(#armTrim)"/>
      <circle cx="106" cy="44" r="8" fill="#e6eefc" stroke="rgba(15,23,42,0.35)"/>
      <circle cx="106" cy="44" r="3" fill="url(#armTrim)"/>
      <path d="M121 52l18 10" stroke="url(#armTrim)" stroke-width="6" stroke-linecap="round"/>
      <path d="M141 63l10 8" stroke="url(#armTrim)" stroke-width="6" stroke-linecap="round"/>
      <path d="M141 63l10-10" stroke="url(#armTrim)" stroke-width="6" stroke-linecap="round"/>
      <path d="M54 104h46" stroke="rgba(255,255,255,0.65)" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `;

  const linesSvg = [];

  // For arm mode, show just this device.
  if (isArm) {
    const nodeId = state.nodeConnection?.nodeId || "This Arm";
    const nodeConnected = state.nodeConnection?.status === "connected";
    const kind = nodeConnected ? "online" : "offline";
    const x = containerRect.width * 0.5;
    const y = containerRect.height * 0.68;
    const meta = state.settings?.gatewayUrl
      ? `Gateway: ${state.settings.gatewayUrl}`
      : `ID: ${nodeId.slice(0, 14)}...`;
    const station = document.createElement("div");
    station.className = `arm-station station--${kind}`;
    station.style.left = `${x}px`;
    station.style.top = `${y}px`;
    station.style.transform = "translate(-50%, -50%)";
    station.innerHTML = `
      <div class="station-card">
        <div class="station-head">
          <span class="station-icon">${statusIconSvg(kind)}</span>
          <div class="station-copy">
            <div class="station-name">${escapeHtml(nodeId.slice(0, 18))}</div>
            <div class="station-state station-state--${kind}">${kind === "online" ? "Online" : "Offline"}</div>
            <div class="station-meta">${escapeHtml(meta)}</div>
          </div>
        </div>
      </div>
      <div class="station-robot">${robotArmSvg}</div>
    `;
    elements.armStationNodes.appendChild(station);
    linesSvg.push(
      `<line class="beam beam--${kind}" x1="${hubX}" y1="${hubY}" x2="${x}" y2="${y}" />`,
    );
    elements.connectionLinesEl.innerHTML = linesSvg.join("");
    return;
  }

  // Hub/controller mode: show paired arm nodes.
  const paired = Array.isArray(state.devicePairing?.paired)
    ? state.devicePairing.paired
    : [];
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const hidden = hiddenDeviceSet();

  const deviceMap = new Map();
  for (const entry of paired) {
    const id = deviceKey(entry);
    if (!id || hidden.has(id)) continue;
    deviceMap.set(id, {
      id,
      connected: false,
      pairEntry: entry,
      node: null,
    });
  }
  for (const node of nodes) {
    const id = (node?.nodeId || "").toString().trim();
    if (!id || hidden.has(id)) continue;
    const existing = deviceMap.get(id);
    if (existing) {
      existing.node = node;
      existing.connected = Boolean(node?.connected);
    } else if (node?.paired || node?.nodeId) {
      // If the node reports it is paired, or we have a nodeId from a successful connection,
      // ensure it shows up in the topology even if the local pairing list is lagging.
      deviceMap.set(id, {
        id,
        connected: Boolean(node?.connected),
        pairEntry: null,
        node,
      });
    }
  }

  const devices = [...deviceMap.values()];
  if (!devices.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "topology-empty";
    placeholder.textContent =
      'No paired Arm devices yet. Click "+ Add Device" to pair one.';
    elements.armStationNodes.appendChild(placeholder);
    return;
  }

  const anchors = [
    { x: containerRect.width * 0.22, y: containerRect.height * 0.22 },
    { x: containerRect.width * 0.78, y: containerRect.height * 0.22 },
    { x: containerRect.width * 0.28, y: containerRect.height * 0.68 },
    { x: containerRect.width * 0.72, y: containerRect.height * 0.68 },
  ];

  const extraCount = Math.max(0, devices.length - anchors.length);
  const cx = hubX;
  const cy = containerRect.height * 0.45;
  const radiusX = Math.min(containerRect.width * 0.42, 520);
  const radiusY = Math.min(containerRect.height * 0.34, 260);

  devices.forEach((device, index) => {
    const alias = aliasForDevice(device.id);
    const name = alias || `Arm Station ${index + 1}`;
    const kind = deviceKind(device);
    const statusText =
      kind === "online"
        ? "Online"
        : kind === "connecting"
          ? "Connecting"
          : "Offline";

    const addr = bestAddressForDevice(device);
    const meta = addr
      ? `${looksLikeIp(addr) ? "IP" : "Host"}: ${addr}`
      : `ID: ${device.id.slice(0, 14)}...`;

    let x;
    let y;
    if (index < anchors.length) {
      x = anchors[index].x;
      y = anchors[index].y;
    } else {
      const extraIndex = index - anchors.length;
      const t = extraCount <= 1 ? 0.5 : extraIndex / (extraCount - 1);
      const angle = Math.PI * 0.12 + Math.PI * 0.76 * t;
      x = cx - radiusX * Math.cos(angle);
      y = cy + radiusY * Math.sin(angle);
    }

    const station = document.createElement("div");
    station.className = `arm-station station--${kind}`;
    station.dataset.deviceId = device.id;
    station.style.left = `${x}px`;
    station.style.top = `${y}px`;
    station.style.transform = "translate(-50%, -50%)";
    station.innerHTML = `
      <div class="station-card">
        <div class="station-head">
          <span class="station-icon">${statusIconSvg(kind)}</span>
          <div class="station-copy">
            <div class="station-name">${escapeHtml(name)}</div>
            <div class="station-state station-state--${kind}">${escapeHtml(statusText)}</div>
            <div class="station-meta">${escapeHtml(meta)}</div>
          </div>
        </div>
      </div>
      <div class="station-robot">${robotArmSvg}</div>
    `;
    elements.armStationNodes.appendChild(station);

    linesSvg.push(
      `<line class="beam beam--${kind}" x1="${hubX}" y1="${hubY}" x2="${x}" y2="${y}" />`,
    );
  });

  elements.connectionLinesEl.innerHTML = linesSvg.join("");
}

/* ── Group settings panel ── */

function hubFileTransferEnabled() {
  return state.settings?.hubFileTransferEnabled !== false;
}

function hubRemoteControlEnabled() {
  return state.settings?.hubRemoteControlEnabled !== false;
}

function readGroupSettingValue(key) {
  if (key === "hubFileTransferEnabled") {
    return hubFileTransferEnabled();
  }
  if (key === "hubRemoteControlEnabled") {
    return hubRemoteControlEnabled();
  }
  return Boolean(state.settings?.[key]);
}

function applyGroupToggleInputs(key, value) {
  const checked = Boolean(value);
  if (key === "hubFileTransferEnabled") {
    if (elements.fileTransferCheck) {
      elements.fileTransferCheck.checked = checked;
    }
    if (elements.fileTransferToggle) {
      elements.fileTransferToggle.checked = checked;
    }
    return;
  }
  if (key === "hubRemoteControlEnabled") {
    if (elements.remoteControlCheck) {
      elements.remoteControlCheck.checked = checked;
    }
    if (elements.remoteControlToggle) {
      elements.remoteControlToggle.checked = checked;
    }
  }
}

function renderGroupSettings() {
  const mode = state.settings?.mode || "unset";
  const isHub = mode === "hub";

  const fileEnabled = hubFileTransferEnabled();
  const remoteEnabled = hubRemoteControlEnabled();

  // Keep any available controls (legacy checkbox and/or new switch) in sync.
  if (elements.fileTransferCheck) {
    elements.fileTransferCheck.checked = fileEnabled;
    elements.fileTransferCheck.disabled = !isHub;
  }
  if (elements.fileTransferToggle) {
    elements.fileTransferToggle.checked = fileEnabled;
    elements.fileTransferToggle.disabled = !isHub;
  }
  if (elements.remoteControlCheck) {
    elements.remoteControlCheck.checked = remoteEnabled;
    elements.remoteControlCheck.disabled = !isHub;
  }
  if (elements.remoteControlToggle) {
    elements.remoteControlToggle.checked = remoteEnabled;
    elements.remoteControlToggle.disabled = !isHub;
  }

  const controllerConnected = state.operatorConnection?.status === "connected";
  const canUseRemote = isHub && controllerConnected;

  // Gate entry points based on toggles.
  if (elements.sendFileBtn) {
    elements.sendFileBtn.disabled = !fileEnabled || !canUseRemote;
  }
  if (elements.sendTaskBtn) {
    elements.sendTaskBtn.disabled = !remoteEnabled || !canUseRemote;
  }
  if (elements.utilitiesQuickCommandBtn) {
    elements.utilitiesQuickCommandBtn.disabled =
      !remoteEnabled || !canUseRemote;
  }
}

function moveToGuidedSetup({ autoRun = false } = {}) {
  updateSummary();
  elements.finishStatus.textContent = "";
  resetGuidedSetup(state.selectedRole);
  setStep(2);
  if (autoRun) {
    setTimeout(() => {
      elements.finishSetupBtn?.click();
    }, 250);
  }
}

/* ── Communication status panel ── */

function renderCommStatus() {
  if (!elements.armToArmStatus || !elements.clawToArmsStatus) return;
  const mode = state.settings?.mode || "unset";
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const connectedCount = nodes.filter((n) => Boolean(n?.connected)).length;
  const opConnected = state.operatorConnection?.status === "connected";
  const nodeConnected = state.nodeConnection?.status === "connected";

  if (mode === "hub") {
    elements.armToArmStatus.textContent =
      connectedCount > 1
        ? "Active"
        : connectedCount === 1
          ? "1 Arm Online"
          : "No Arms";
    elements.clawToArmsStatus.textContent = opConnected
      ? "Connected"
      : "Disconnected";
    updateCommIndicator(elements.armToArmIndicator, connectedCount > 0);
    updateCommIndicator(elements.clawToArmsIndicator, opConnected);
  } else if (mode === "arm") {
    elements.armToArmStatus.textContent = nodeConnected ? "Active" : "Inactive";
    elements.clawToArmsStatus.textContent = nodeConnected
      ? "Connected"
      : "Disconnected";
    updateCommIndicator(elements.armToArmIndicator, nodeConnected);
    updateCommIndicator(elements.clawToArmsIndicator, nodeConnected);
  } else {
    elements.armToArmStatus.textContent = "N/A";
    elements.clawToArmsStatus.textContent = "N/A";
    updateCommIndicator(elements.armToArmIndicator, false);
    updateCommIndicator(elements.clawToArmsIndicator, false);
  }

  if (elements.reconnectBtn) {
    const show =
      (mode === "hub" && !opConnected) || (mode === "arm" && !nodeConnected);
    elements.reconnectBtn.classList.toggle("hidden", !show);
    elements.reconnectBtn.disabled = !show;
  }
}

function updateCommIndicator(el, connected) {
  if (!el) return;
  const color = connected ? "#16a34a" : "#ef4444";
  const icon = connected
    ? `<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="6" fill="${color}"/><path d="M5 8l2 2 4-4" stroke="#fff" stroke-width="1.5" fill="none"/></svg>`
    : `<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="6" fill="${color}"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-width="1.5" fill="none"/></svg>`;
  el.innerHTML = icon;
}

/* ── Render all ── */

function renderAll() {
  renderStatus();
  renderRuntimeVisibility();
  renderGroupSettings();
  renderNodeSelect();
  renderPairingList();
  renderHiddenDevicesTab();
  renderPairPinState();
  renderGuidedSetup();
  renderTopology();
  renderCommStatus();
}

/* ── Settings helpers ── */

function fillGatewayInputsFromSettings() {
  const settings = state.settings || {};
  // Advanced dialog inputs
  if (elements.gatewayUrlInput)
    elements.gatewayUrlInput.value = settings.gatewayUrl || "";
  if (elements.gatewayTokenInput)
    elements.gatewayTokenInput.value = settings.gatewayToken || "";
  if (elements.gatewayPasswordInput)
    elements.gatewayPasswordInput.value = settings.gatewayPassword || "";
  if (elements.gatewayTlsInput)
    elements.gatewayTlsInput.value = settings.gatewayTlsFingerprint || "";
  // Onboarding inputs
  if (elements.obGatewayUrlInput)
    elements.obGatewayUrlInput.value = settings.gatewayUrl || "";
  if (elements.obGatewayTokenInput)
    elements.obGatewayTokenInput.value = settings.gatewayToken || "";
  if (elements.obGatewayPasswordInput)
    elements.obGatewayPasswordInput.value = settings.gatewayPassword || "";
  if (elements.obGatewayTlsInput)
    elements.obGatewayTlsInput.value = settings.gatewayTlsFingerprint || "";
  if (elements.launchOnStartupInput) elements.launchOnStartupInput.checked = settings.launchOnStartup !== false;
  if (elements.minimizeToTrayInput) elements.minimizeToTrayInput.checked = settings.minimizeToTray !== false;
  if (elements.closeToTrayInput) elements.closeToTrayInput.checked = settings.closeToTray !== false;
  if (elements.updateChecksEnabledInput) elements.updateChecksEnabledInput.checked = settings.updateChecksEnabled !== false;
  if (elements.updatePromptEnabledInput) elements.updatePromptEnabledInput.checked = settings.updatePromptEnabled !== false;
  if (elements.updateStatusText) {
    const latest = settings.latestKnownVersion || "";
    const last = settings.lastUpdateCheckAt || "";
    elements.updateStatusText.textContent = latest
      ? `Last check: ${last ? new Date(last).toLocaleString() : "recent"} • Latest: ${latest}`
      : (last ? `Last check: ${new Date(last).toLocaleString()}` : "Not checked yet.");
  }
}

function updateSummary() {
  if (state.selectedRole === "arm") {
    const paired = state.redeemedPair;
    if (!paired) {
      elements.setupSummary.textContent =
        "Arm mode selected. Enter a valid 4-digit Pair PIN before finishing setup.";
      return;
    }
    const controller = paired.meta?.hubDisplayName
      ? ` via ${paired.meta.hubDisplayName}`
      : "";
    const rewritten = paired.meta?.gatewayUrlRewritten
      ? " (auto-adjusted for remote access)"
      : "";
    elements.setupSummary.textContent = `Arm will connect to ${paired.gateway.url}${controller}${rewritten}.`;
    return;
  }
  const url =
    (
      elements.obGatewayUrlInput?.value ||
      elements.gatewayUrlInput?.value ||
      ""
    ).trim() || "(missing gateway URL)";
  elements.setupSummary.textContent = `Controller Station will use gateway ${url}, generate a Pair PIN, approve the Arm request, and verify a live paired connection before setup completes.`;
}

function readGatewayInputs() {
  // During onboarding, read from onboarding inputs; otherwise from advanced dialog
  const completed = Boolean(state.settings?.onboardingComplete);
  if (!completed && elements.obGatewayUrlInput) {
    return {
      gatewayUrl: (elements.obGatewayUrlInput.value || "").trim(),
      gatewayToken: (elements.obGatewayTokenInput?.value || "").trim(),
      gatewayPassword: (elements.obGatewayPasswordInput?.value || "").trim(),
      gatewayTlsFingerprint: (elements.obGatewayTlsInput?.value || "").trim(),
    };
  }
  return {
    gatewayUrl: (elements.gatewayUrlInput?.value || "").trim(),
    gatewayToken: (elements.gatewayTokenInput?.value || "").trim(),
    gatewayPassword: (elements.gatewayPasswordInput?.value || "").trim(),
    gatewayTlsFingerprint: (elements.gatewayTlsInput?.value || "").trim(),
  };
}

function validateGatewayUrl(url) {
  if (!url) return "Gateway URL is required.";
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    return "Gateway URL must start with ws:// or wss://";
  }
  return null;
}

function isLikelyGatewayReachabilityFailure(message) {
  const text = (message || "").toLowerCase();
  return (
    text.includes("gateway is not reachable") ||
    text.includes("cannot reach the gateway") ||
    text.includes("wsl") ||
    text.includes("portproxy") ||
    text.includes("firewall") ||
    text.includes("timed out") ||
    text.includes("timeout") ||
    text.includes("econnrefused") ||
    text.includes("connect_error") ||
    text.includes("closed (1006)")
  );
}

function renderAutoFixResult(result) {
  if (!result || typeof result !== "object") {
    return "Auto-fix completed.";
  }
  const ops = Array.isArray(result.operations) ? result.operations : [];
  const warns = Array.isArray(result.warnings) ? result.warnings : [];
  const reachable = result.reachable
    ? "Gateway reachable."
    : "Gateway still not reachable.";
  const summary = ops.slice(0, 3).join(" ");
  const warningText = warns.length
    ? ` Warnings: ${warns.slice(0, 2).join(" ")}`
    : "";
  return `${reachable} ${summary}${warningText}`.trim();
}

async function runAutoFixFlow() {
  const gatewayPatch = readGatewayInputs();
  const urlErr = validateGatewayUrl(gatewayPatch.gatewayUrl);
  if (urlErr) {
    throw new Error(urlErr);
  }
  const statusEl = state.settings?.onboardingComplete
    ? elements.autoFixStatus
    : elements.obAutoFixStatus || elements.autoFixStatus;
  if (statusEl) {
    statusEl.textContent =
      "Running auto-fix: exposing gateway to LAN and starting relay if needed...";
  }
  const response = await window.openArm.autoFixGateway({
    gatewayUrl: gatewayPatch.gatewayUrl,
  });
  if (!response?.ok) {
    throw new Error(response?.error?.message || "Auto-fix failed.");
  }
  const result = response.result;
  if (statusEl) {
    statusEl.textContent = renderAutoFixResult(result);
  }
  if (result?.reachable) {
    showToast("Auto-fix succeeded: gateway is reachable.", "success");
  } else {
    showToast(
      "Auto-fix completed but gateway is still not reachable.",
      "error",
    );
  }
  return result;
}

/* ── Pairing refresh ── */

function maybeStartPairingRefresh() {
  const shouldRun =
    state.settings?.onboardingComplete &&
    state.settings?.mode === "hub" &&
    state.operatorConnection?.status === "connected";
  const pendingCount = Array.isArray(state.devicePairing?.pending)
    ? state.devicePairing.pending.length
    : 0;
  const hasActivePin = Boolean(state.pairPin?.active?.pin);
  const lastEvent = state.pairPin?.lastEvent;
  const redeemedRecently =
    lastEvent?.reason === "redeemed" &&
    Date.now() - Number(lastEvent.atMs || 0) < 60_000;
  const desiredMs =
    pendingCount > 0 || hasActivePin || redeemedRecently ? 1200 : 5000;

  if (
    shouldRun &&
    (!state.pairingTimer || state.pairingTimerMs !== desiredMs)
  ) {
    if (state.pairingTimer) {
      clearInterval(state.pairingTimer);
      state.pairingTimer = null;
    }
    state.pairingTimerMs = desiredMs;
    void window.openArm.listDevicePairing();
    void window.openArm.listNodes();
    state.pairingTimer = setInterval(() => {
      void window.openArm.listDevicePairing();
      void window.openArm.listNodes();
    }, desiredMs);
    return;
  }
  if (!shouldRun && state.pairingTimer) {
    clearInterval(state.pairingTimer);
    state.pairingTimer = null;
    state.pairingTimerMs = 0;
  }
}

/* ── Chat ── */

function appendChatLine({ role, text, meta }) {
  const line = document.createElement("article");
  line.className = "chat-line";
  line.innerHTML = `<div><strong>${escapeHtml(role)}</strong> ${escapeHtml(text)}</div><div class="meta">${meta}</div>`;
  elements.chatList.appendChild(line);
  elements.chatList.scrollTop = elements.chatList.scrollHeight;
}

function extractMessageText(message) {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  if (typeof message.text === "string") return message.text;
  if (Array.isArray(message.content)) {
    return message.content
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.text === "string") return entry.text;
        if (entry && entry.type === "text" && typeof entry.value === "string")
          return entry.value;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/* ── Node invoke ── */

async function runNodeInvoke(payload) {
  const response = await window.openArm.invokeNode(payload);
  if (!response.ok)
    throw new Error(response.error?.message || "Node invoke failed");
  return response.decodedPayload ?? response.response;
}

function selectedNodeOrThrow() {
  const nodeId = elements.targetNode.value || state.selectedNodeId;
  if (!nodeId) throw new Error("Select a node first");
  state.selectedNodeId = nodeId;
  return nodeId;
}

function selectedFileTargetNodeOrThrow() {
  const nodeId =
    elements.fileTargetNode?.value || state.fileTransfer.targetNodeId;
  if (!nodeId) throw new Error("Select a target Arm first");
  state.fileTransfer.targetNodeId = nodeId;
  return nodeId;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KiB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MiB`;
}

function fileTransferLimitBytes() {
  return 8 * 1024 * 1024;
}

function updateFileTransferSendState() {
  if (!elements.fileTransferSend) return;
  const file = state.fileTransfer.file;
  const destPath = (
    elements.fileDestPathInput?.value ||
    state.fileTransfer.destPath ||
    ""
  ).trim();
  const nodeId =
    elements.fileTargetNode?.value || state.fileTransfer.targetNodeId;
  state.fileTransfer.destPath = destPath;
  state.fileTransfer.targetNodeId = nodeId || "";
  elements.fileTransferSend.disabled = !(file && destPath && nodeId);
}

function setFileTransferStatus(text) {
  if (!elements.fileTransferStatus) return;
  elements.fileTransferStatus.textContent = text || "";
}

function resetFileTransferDialog() {
  state.fileTransfer.file = null;
  state.fileTransfer.name = "";
  state.fileTransfer.size = 0;
  if (elements.filePickInput) {
    elements.filePickInput.value = "";
  }
  if (elements.fileDestPathInput) {
    elements.fileDestPathInput.value = state.fileTransfer.destPath || "";
  }
  setFileTransferStatus("Pick a file and destination path, then send.");
  updateFileTransferSendState();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      if (comma === -1) {
        resolve("");
        return;
      }
      resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

function looksLikeAllowlistError(message) {
  const text = (message || "").toLowerCase();
  return (
    text.includes("allowcommands") ||
    text.includes("not allowed") ||
    text.includes("command not allowed") ||
    text.includes("not permitted")
  );
}

/* ── Auto-connect on runtime ── */

async function initializeRuntimeConnectIfNeeded() {
  if (!state.settings?.onboardingComplete) return;
  if (
    state.settings.mode === "arm" &&
    state.nodeConnection?.status === "disconnected"
  ) {
    await window.openArm.connectForMode();
  }
  if (
    state.settings.mode === "hub" &&
    state.operatorConnection?.status === "disconnected"
  ) {
    await window.openArm.connectForMode();
    await window.openArm.listDevicePairing();
    await window.openArm.listNodes();
  }
}

/* ── Success overlay ── */

function showSuccessOverlay() {
  elements.successOverlay.classList.add("show");
  setTimeout(() => {
    elements.successOverlay.classList.remove("show");
  }, 2200);
}

async function runGuidedSetupArm() {
  if (!state.redeemedPair?.gateway) {
    throw new Error("Arm mode needs a redeemed 4-digit Pair PIN.");
  }

  state.guidedSetup.inProgress = true;
  setGuidedMeta({
    title: "Verifying Arm setup",
    subtitle:
      "Saving settings, connecting to gateway, waiting for controller approval, and verifying the final link.",
    pinText: "",
  });

  updateGuidedStep("save", "running", "Saving paired gateway settings...");
  await callOk(
    window.openArm.saveSettings({
      gatewayUrl: state.redeemedPair.gateway.url,
      gatewayToken: state.redeemedPair.gateway.token || "",
      gatewayPassword: state.redeemedPair.gateway.password || "",
      gatewayTlsFingerprint: state.redeemedPair.gateway.tlsFingerprint || "",
      mode: "arm",
      onboardingComplete: false,
    }),
    "Failed to save Arm settings.",
  );
  updateGuidedStep("save", "success", "Gateway settings saved.");

  updateGuidedStep("connect", "running", "Connecting Arm to gateway...");
  await callOk(
    window.openArm.connectForMode(),
    "Failed to start Arm connection.",
  );
  const pairingRequiredText = (text) => {
    const t = (text || "").toLowerCase();
    return (
      t.includes("pairing required") ||
      t.includes("not_paired") ||
      t.includes("not paired")
    );
  };
  const reachedGateway = await waitForCondition({
    timeoutMs: 20_000,
    intervalMs: 500,
    check: () => {
      if (state.nodeConnection?.status === "connected") {
        return true;
      }
      if (pairingRequiredText(state.nodeConnection?.lastError)) {
        return true;
      }
      if (isLikelyGatewayReachabilityFailure(state.nodeConnection?.lastError)) {
        return true;
      }
      return false;
    },
  });
  if (!reachedGateway) {
    throw new Error(
      state.nodeConnection?.lastError
        ? `Arm could not reach gateway: ${state.nodeConnection.lastError}`
        : "Arm could not reach the gateway in time.",
    );
  }

  const nodeId = state.nodeConnection?.nodeId || "";
  if (state.nodeConnection?.status === "connected") {
    updateGuidedStep(
      "connect",
      "success",
      nodeId ? `Connected as ${nodeId.slice(0, 14)}...` : "Arm connected.",
    );
    updateGuidedStep(
      "approve",
      "success",
      "Already approved (no controller action needed).",
    );
  } else if (pairingRequiredText(state.nodeConnection?.lastError)) {
    updateGuidedStep(
      "connect",
      "success",
      "Gateway reachable. Waiting for Controller Station approval...",
    );
    updateGuidedStep(
      "approve",
      "running",
      "Ask the Controller Station user to approve this Arm now.",
    );
    const approved = await waitForCondition({
      timeoutMs: 240_000,
      intervalMs: 700,
      check: () => state.nodeConnection?.status === "connected",
      onTick: async ({ iteration }) => {
        if (
          iteration % 10 === 0 &&
          pairingRequiredText(state.nodeConnection?.lastError)
        ) {
          updateGuidedStep(
            "approve",
            "running",
            "Still waiting for approval... (Controller: open Pairing tab and approve the pending request)",
          );
        }
      },
    });
    if (!approved) {
      throw new Error(
        state.nodeConnection?.lastError
          ? `Arm was not approved in time: ${state.nodeConnection.lastError}`
          : "Arm was not approved in time.",
      );
    }
    updateGuidedStep("approve", "success", "Approved. Arm connected.");
  } else {
    throw new Error(
      state.nodeConnection?.lastError
        ? `Arm failed to connect: ${state.nodeConnection.lastError}`
        : "Arm failed to connect.",
    );
  }

  updateGuidedStep("verify", "running", "Checking stable connection...");
  const stable = await waitForCondition({
    timeoutMs: 18_000,
    intervalMs: 500,
    check: () => {
      if (state.nodeConnection?.status !== "connected") {
        return false;
      }
      const connectedAtMs = Number(
        new Date(state.nodeConnection?.connectedAt || 0),
      );
      if (!connectedAtMs || Number.isNaN(connectedAtMs)) {
        return false;
      }
      return Date.now() - connectedAtMs >= 3000;
    },
  });
  if (!stable) {
    throw new Error(
      state.nodeConnection?.lastError
        ? `Arm connection became unstable: ${state.nodeConnection.lastError}`
        : "Arm connection could not stay stable.",
    );
  }
  updateGuidedStep("verify", "success", "Arm connection is stable.");

  await callOk(
    window.openArm.saveSettings({
      mode: "arm",
      onboardingComplete: true,
    }),
    "Failed to finalize Arm setup.",
  );
  state.guidedSetup.inProgress = false;
  setGuidedMeta({
    title: "Arm setup verified",
    subtitle: "Handshake is complete. This Arm is ready for control.",
  });
}

async function runGuidedSetupController() {
  const gatewayPatch = readGatewayInputs();
  const urlErr = validateGatewayUrl(gatewayPatch.gatewayUrl);
  if (urlErr) {
    throw new Error(urlErr);
  }
  if (!gatewayPatch.gatewayToken && !gatewayPatch.gatewayPassword) {
    throw new Error("Controller mode needs either gateway token or password.");
  }

  state.guidedSetup.inProgress = true;
  setGuidedMeta({
    title: "Verifying controller handshake",
    subtitle:
      "Connecting controller, pairing arm, approving request, and confirming final link.",
    pinText: "",
  });

  let baselinePairedCount = 0;
  let baselineNodeIds = new Set();
  let approvedRequestId = "";
  let approvedDeviceId = "";

  updateGuidedStep("save", "running", "Saving controller gateway settings...");
  await callOk(
    window.openArm.saveSettings({
      ...gatewayPatch,
      mode: "hub",
      onboardingComplete: false,
    }),
    "Failed to save controller settings.",
  );
  updateGuidedStep("save", "success", "Gateway settings saved.");

  updateGuidedStep("connect", "running", "Connecting Controller Station...");
  await callOk(
    window.openArm.connectForMode(),
    "Failed to start controller connection.",
  );
  const controllerConnected = await waitForCondition({
    timeoutMs: 30_000,
    intervalMs: 600,
    check: () => state.operatorConnection?.status === "connected",
  });
  if (!controllerConnected) {
    throw new Error(
      state.operatorConnection?.lastError
        ? `Controller failed to connect: ${state.operatorConnection.lastError}`
        : "Controller could not connect to gateway in time.",
    );
  }
  updateGuidedStep("connect", "success", "Controller link is active.");
  await refreshPairingAndNodes();

  baselinePairedCount = Array.isArray(state.devicePairing?.paired)
    ? state.devicePairing.paired.length
    : 0;
  baselineNodeIds = new Set(
    (Array.isArray(state.nodes) ? state.nodes : [])
      .map((node) => node?.nodeId)
      .filter(Boolean),
  );

  updateGuidedStep(
    "autofix",
    "running",
    "Ensuring the gateway is reachable from your local network...",
  );
  let autoFixResult = null;
  try {
    const response = await window.openArm.autoFixGateway({
      gatewayUrl: gatewayPatch.gatewayUrl,
    });
    if (!response?.ok) {
      throw new Error(response?.error?.message || "Auto-fix failed.");
    }
    autoFixResult = response.result;
  } catch (error) {
    autoFixResult = null;
    updateGuidedStep("autofix", "error", error?.message || "Auto-fix failed.");
    throw error;
  }
  const suggested = autoFixResult?.suggestedGatewayUrl || "";
  if (!autoFixResult?.reachable) {
    const hint = suggested
      ? `Gateway is still not reachable for Arms at ${suggested}.`
      : "Gateway is still not reachable for Arms on your network.";
    updateGuidedStep("autofix", "error", hint);
    throw new Error(
      `${hint} If OpenClaw runs in WSL, keep OpenArm running so its LAN relay stays active, and allow it through Windows Firewall when prompted.`,
    );
  }
  updateGuidedStep(
    "autofix",
    "success",
    suggested
      ? `Arms can reach: ${suggested}`
      : "Gateway is reachable from LAN.",
  );

  updateGuidedStep("pin", "running", "Generating fresh 4-digit Pair PIN...");
  const pinResponse = await callOk(
    window.openArm.generatePairPin({}),
    "Failed to generate Pair PIN.",
  );
  state.generatedPair = pinResponse.generated;
  const pin = pinResponse.generated?.pin || "";
  const issuedAtMs = Number(pinResponse.generated?.issuedAtMs || Date.now());
  elements.pairCodeValue.value = pin;
  elements.pairCodeMeta.textContent = `PIN ${pin} generated. Enter it on the Arm setup screen now.`;
  setGuidedMeta({
    pinText: pin ? `Pair PIN: ${pin}` : "",
  });
  updateGuidedStep(
    "pin",
    "success",
    pin ? `PIN ${pin} is active.` : "Pair PIN is active.",
  );

  updateGuidedStep("redeem", "running", "Waiting for Arm to redeem the PIN...");
  const redeemed = await waitForCondition({
    timeoutMs: 240_000,
    intervalMs: 1000,
    check: () => {
      const event = state.pairPin?.lastEvent;
      return Boolean(
        event &&
        event.reason === "redeemed" &&
        Number(event.atMs || 0) >= issuedAtMs,
      );
    },
    onTick: async ({ iteration }) => {
      if (
        iteration % 2 === 0 &&
        state.operatorConnection?.status === "connected"
      ) {
        await window.openArm.listDevicePairing().catch(() => {});
      }
    },
  });
  if (!redeemed) {
    throw new Error("Timed out waiting for Arm PIN redemption.");
  }
  const redeemedHost =
    state.pairPin?.lastEvent?.details?.redeemedByHost || "arm device";
  updateGuidedStep("redeem", "success", `PIN redeemed by ${redeemedHost}.`);

  updateGuidedStep(
    "approve",
    "running",
    "Looking for an Arm request to approve...",
  );
  const findAndApproveRequest = async () => {
    await callOk(
      window.openArm.listDevicePairing(),
      "Failed to refresh pairing requests.",
    );
    const request = newestPendingRequest();
    if (!request?.requestId) {
      return { approved: false, reason: "no_pending" };
    }
    approvedRequestId = request.requestId;
    const approved = await callOk(
      window.openArm.approveDevicePair({ requestId: approvedRequestId }),
      "Failed to approve Arm request.",
    );
    approvedDeviceId = firstNonEmpty(
      [approved?.response?.device?.deviceId, request?.deviceId],
      "",
    );
    return { approved: true, reason: "approved" };
  };

  let approvalAttempt = await findAndApproveRequest();
  const approveDeadline = Date.now() + 60_000;
  while (!approvalAttempt.approved && Date.now() < approveDeadline) {
    await sleep(1200);
    approvalAttempt = await findAndApproveRequest();
  }

  if (approvalAttempt.approved) {
    updateGuidedStep(
      "approve",
      "success",
      approvedRequestId
        ? `Approved request ${approvedRequestId}.`
        : "Arm request approved.",
    );
  } else {
    // If no pending requests appear, the Arm may already be paired or the gateway may be unreachable from the Arm.
    updateGuidedStep(
      "approve",
      "success",
      "No approval request detected. Continuing to verify pairing visibility...",
    );
  }

  updateGuidedStep(
    "paired",
    "running",
    approvedDeviceId
      ? "Waiting for the approved Arm to connect..."
      : "Waiting for a paired Arm to be online...",
  );
  const pairedConnected = await waitForCondition({
    timeoutMs: 120_000,
    intervalMs: 1500,
    check: () => {
      const paired = Array.isArray(state.devicePairing?.paired)
        ? state.devicePairing.paired
        : [];
      const pending = Array.isArray(state.devicePairing?.pending)
        ? state.devicePairing.pending
        : [];
      const nodes = Array.isArray(state.nodes) ? state.nodes : [];
      const pairedIds = new Set(
        paired.map((entry) => deviceKey(entry)).filter(Boolean),
      );
      const connectedPairedNodes = nodes.filter((node) => {
        const nodeId = (node?.nodeId || "").toString();
        return (
          Boolean(node?.connected) &&
          (Boolean(node?.paired) || pairedIds.has(nodeId))
        );
      });

      if (approvedDeviceId) {
        return connectedPairedNodes.some(
          (node) => node?.nodeId === approvedDeviceId,
        );
      }

      // If we approved a request but couldn't capture the deviceId, require that pairing visibility changed
      // and at least one paired node is connected.
      if (approvalAttempt.approved) {
        const hasNewNode = nodes.some(
          (node) => node?.nodeId && !baselineNodeIds.has(node.nodeId),
        );
        if (paired.length > baselinePairedCount || hasNewNode) {
          return connectedPairedNodes.length >= 1;
        }
        if (approvedRequestId) {
          const stillPending = pending.some(
            (item) => item?.requestId === approvedRequestId,
          );
          return !stillPending && connectedPairedNodes.length >= 1;
        }
      }

      return connectedPairedNodes.length >= 1;
    },
    onTick: async ({ iteration }) => {
      if (iteration % 2 === 0) {
        await window.openArm.listDevicePairing().catch(() => {});
      }
      if (iteration % 2 === 0) {
        await window.openArm.listNodes().catch(() => {});
      }
    },
  });
  if (!pairedConnected) {
    const hint = approvedDeviceId
      ? `Approved Arm ${approvedDeviceId.slice(0, 14)}... did not connect in time.`
      : approvalAttempt.approved
        ? "Arm was approved, but it did not connect in time."
        : "No paired Arm connected in time.";
    throw new Error(
      `${hint} Ask the Arm user to keep OpenArm running and click Connect so OpenClaw can reach it through OpenArm. If OpenClaw is in WSL, use One-Click Auto-Fix to expose the gateway to LAN.`,
    );
  }
  await refreshPairingAndNodes();
  const pairedCount = Array.isArray(state.devicePairing?.paired)
    ? state.devicePairing.paired.length
    : 0;
  const connectedCount = (Array.isArray(state.nodes) ? state.nodes : []).filter(
    (node) => Boolean(node?.connected) && Boolean(node?.paired),
  ).length;
  const detail = approvedDeviceId
    ? `Arm connected: ${approvedDeviceId.slice(0, 14)}...`
    : `Connected arms: ${connectedCount}.`;
  updateGuidedStep("paired", "success", `${detail} Paired: ${pairedCount}.`);

  updateGuidedStep(
    "agent",
    "running",
    "Enabling OpenArm bridge for OpenClaw agent (nodes tool + OpenArm invoke ops). Gateway may restart briefly...",
  );
  const beforeConnectedAt = state.operatorConnection?.connectedAt || "";
  const agentRes = await callOk(
    window.openArm.enableAgentIntegration({}),
    "Failed to enable OpenArm hub/agent integration.",
  );
  const applied = Boolean(agentRes?.result?.applied);
  const operations = Array.isArray(agentRes?.result?.operations)
    ? agentRes.result.operations
    : [];
  const warnings = Array.isArray(agentRes?.result?.warnings)
    ? agentRes.result.warnings
    : [];
  const opText = operations.length
    ? operations.slice(-1)[0]
    : applied
      ? "Applied integration changes."
      : "Integration already enabled.";
  updateGuidedStep("agent", "running", opText);

  // If the gateway restarts, the operator link will briefly disconnect. Wait for it to come back.
  const reconnectedOk = await waitForCondition({
    timeoutMs: 60_000,
    intervalMs: 600,
    check: () => state.operatorConnection?.status === "connected",
  });
  if (!reconnectedOk) {
    throw new Error(
      state.operatorConnection?.lastError
        ? `Controller did not reconnect after integration: ${state.operatorConnection.lastError}`
        : "Controller did not reconnect after enabling agent integration.",
    );
  }
  const reconnectedAt = state.operatorConnection?.connectedAt || "";
  const reconnected = Boolean(
    reconnectedAt && reconnectedAt !== beforeConnectedAt,
  );
  const warnSuffix = warnings.length ? ` Warnings: ${warnings[0]}` : "";
  updateGuidedStep(
    "agent",
    "success",
    `${applied ? "Enabled" : "Verified"} OpenArm tool access for the agent.${reconnected ? " Gateway restarted and reconnected." : ""}${warnSuffix}`,
  );

  await callOk(
    window.openArm.saveSettings({
      mode: "hub",
      onboardingComplete: true,
    }),
    "Failed to finalize controller setup.",
  );
  state.guidedSetup.inProgress = false;
  setGuidedMeta({
    title: "Controller handshake complete",
    subtitle: "Arm pairing is verified and ready for OpenClaw agent tasks through OpenArm.",
  });
}

/* ═══════════════════════════════════════════════════════════════
   Event handlers
   ═══════════════════════════════════════════════════════════════ */

/* ── Role selection ── */
elements.roleArmCard.addEventListener("click", () => setRole("arm"));
elements.roleHubCard.addEventListener("click", () => setRole("hub"));

/* ── Stepper navigation ── */
elements.step1Next.addEventListener("click", () => {
  if (!state.selectedRole) return;
  setStep(1);
});

elements.step2Back.addEventListener("click", () => setStep(0));

elements.step2Next.addEventListener("click", () => {
  if (state.selectedRole === "arm" && !state.redeemedPair) {
    elements.armPairDecodeResult.textContent =
      "Enter and redeem a valid 4-digit Pair PIN first.";
    return;
  }
  if (state.selectedRole === "hub") {
    const gateway = readGatewayInputs();
    const urlErr = validateGatewayUrl(gateway.gatewayUrl);
    if (urlErr) {
      elements.finishStatus.textContent = urlErr;
      showToast(urlErr, "error");
      return;
    }
    if (!gateway.gatewayToken && !gateway.gatewayPassword) {
      elements.finishStatus.textContent =
        "Controller mode needs either gateway token or password.";
      return;
    }
  }
  moveToGuidedSetup({ autoRun: false });
});

elements.step3Back.addEventListener("click", () => setStep(1));

elements.armPairPinInput.addEventListener("input", () => {
  const cleaned = (elements.armPairPinInput.value || "")
    .replace(/\D+/g, "")
    .slice(0, 4);
  if (cleaned !== elements.armPairPinInput.value) {
    elements.armPairPinInput.value = cleaned;
  }
});

/* ── One-click auto-fix ── */
elements.runAutoFixBtn?.addEventListener("click", async () => {
  await withLoading(elements.runAutoFixBtn, async () => {
    try {
      await runAutoFixFlow();
    } catch (error) {
      const message = error?.message || "Auto-fix failed.";
      elements.autoFixStatus.textContent = message;
      showToast(message, "error");
    }
  });
});

/* ── Pair PIN redeem ── */
elements.redeemPairPinBtn.addEventListener("click", async () => {
  const pin = elements.armPairPinInput.value.trim();
  const controllerHost = elements.armPairHostInput.value.trim();
  if (!/^\d{4}$/.test(pin)) {
    elements.armPairDecodeResult.textContent = "Enter exactly 4 digits.";
    state.redeemedPair = null;
    return;
  }
  await withLoading(elements.redeemPairPinBtn, async () => {
    elements.armPairDecodeResult.textContent =
      "Pairing with Controller Station...";
    const response = await window.openArm.redeemPairPin({
      pin,
      hubHost: controllerHost || undefined,
    });
    if (!response.ok) {
      const message = response.error?.message || "unknown error";
      if (message.toLowerCase().includes("no controller station discovered")) {
        const helper =
          "Controller not found on network. Enter the Controller IP in the optional field and retry.";
        elements.armPairDecodeResult.textContent = helper;
        showToast(helper, "error");
      } else if (message.toLowerCase().includes("cannot reach the gateway")) {
        const helper =
          "PIN was redeemed, but the gateway is not reachable from this Arm. If OpenClaw is in WSL, expose the gateway to LAN (host 0.0.0.0 + portproxy/firewall).";
        elements.armPairDecodeResult.textContent = helper;
        showToast(helper, "error");
      } else if (
        message.toLowerCase().includes("pair_pin_invalid") ||
        message.toLowerCase().includes("pin was rejected")
      ) {
        const helper =
          "PIN did not match the discovered Controller address. Generate a fresh PIN and enter the Controller IP manually.";
        elements.armPairDecodeResult.textContent = helper;
        showToast(helper, "error");
      } else {
        elements.armPairDecodeResult.textContent = `Pairing failed: ${message}`;
        showToast(`Pairing failed: ${message}`, "error");
      }
      state.redeemedPair = null;
      return;
    }
    state.redeemedPair = response.paired;
    const hostText = response.paired?.host
      ? ` via ${response.paired.host}`
      : "";
    elements.armPairDecodeResult.textContent = `PIN accepted${hostText}. Starting guided setup...`;
    if (response.paired?.meta?.gatewayUrlRewritten) {
      showToast(
        "Gateway URL was adjusted to the Controller LAN address.",
        "success",
      );
    }
    showToast("PIN accepted. Connecting now...", "success");
    elements.finishStatus.textContent = "";

    // Trigger immediate refresh on the controller side if we can.
    void window.openArm.listDevicePairing().catch(() => {});

    // Make Arm setup fully guided: once the PIN redeems, immediately run the verification flow.
    moveToGuidedSetup({ autoRun: true });
  });
});

/* ── Finish setup ── */
elements.finishSetupBtn.addEventListener("click", async () => {
  await withLoading(elements.finishSetupBtn, async () => {
    try {
      if (!state.selectedRole)
        throw new Error("Choose Arm or Controller first.");
      elements.finishStatus.textContent = "Running guided setup checks...";
      state.guidedSetup.inProgress = true;
      renderGuidedSetup();

      if (state.selectedRole === "arm") {
        await runGuidedSetupArm();
      } else {
        await runGuidedSetupController();
      }

      elements.finishStatus.textContent = "Setup verified successfully.";
      showSuccessOverlay();
    } catch (error) {
      state.guidedSetup.inProgress = false;
      const runningStep = [...state.guidedSetup.items].find(
        (item) => item.status === "running",
      );
      if (runningStep) {
        updateGuidedStep(
          runningStep.id,
          "error",
          error.message || "Step failed.",
        );
      } else {
        renderGuidedSetup();
      }
      elements.finishStatus.textContent = error.message;
      showToast(error.message, "error");
    }
  });
});

/* ── Re-run setup ── */
async function rerunSetupWizard() {
  await window.openArm.disconnectForMode().catch(() => {});
  const saved = await window.openArm.saveSettings({
    onboardingComplete: false,
  });
  if (saved?.ok && saved.settings) {
    state.settings = saved.settings;
  }
  state.selectedRole = state.settings?.mode || "";
  if (state.selectedRole) setRole(state.selectedRole);
  setStep(0);
}

elements.rerunSetupBtn.addEventListener("click", async () => {
  await withLoading(elements.rerunSetupBtn, async () => {
    await rerunSetupWizard();
  });
});

/* ── Arm connect/disconnect ── */
elements.armConnectBtn.addEventListener("click", async () => {
  await withLoading(elements.armConnectBtn, async () => {
    const res = await window.openArm.connectNode();
    if (!res.ok)
      showToast(
        `Connection failed: ${res.error?.message || "unknown"}`,
        "error",
      );
  });
});
elements.armDisconnectBtn.addEventListener("click", async () => {
  const confirmed = await confirm(
    "Disconnect Arm",
    "Are you sure you want to disconnect this Arm from the gateway?",
  );
  if (!confirmed) return;
  await withLoading(elements.armDisconnectBtn, async () => {
    await window.openArm.disconnectNode();
  });
});

/* ── Hub connect/disconnect ── */
elements.hubConnectBtn.addEventListener("click", async () => {
  await withLoading(elements.hubConnectBtn, async () => {
    const res = await window.openArm.connectOperator();
    if (!res.ok)
      showToast(
        `Connection failed: ${res.error?.message || "unknown"}`,
        "error",
      );
    else {
      await window.openArm.listDevicePairing();
      await window.openArm.listNodes();
    }
  });
});
elements.hubDisconnectBtn.addEventListener("click", async () => {
  const confirmed = await confirm(
    "Disconnect Controller",
    "Are you sure you want to disconnect the Controller from the gateway?",
  );
  if (!confirmed) return;
  await withLoading(elements.hubDisconnectBtn, async () => {
    await window.openArm.disconnectOperator();
  });
});

/* ── Refresh pairing ── */
elements.refreshPairingBtn.addEventListener("click", async () => {
  await window.openArm.listDevicePairing();
});

/* ── Generate pair PIN ── */
elements.generatePairBtn.addEventListener("click", async () => {
  await withLoading(elements.generatePairBtn, async () => {
    await openAddArmWizard();
  });
});

/* ── Copy PIN ── */
elements.copyPairCodeBtn.addEventListener("click", async () => {
  const value = elements.pairCodeValue.value.trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    elements.pairCodeValue.select();
    document.execCommand("copy");
  }
  const original = elements.copyPairCodeBtn.textContent;
  elements.copyPairCodeBtn.textContent = "Copied!";
  setTimeout(() => {
    elements.copyPairCodeBtn.textContent = original;
  }, 1500);
});

/* ── Add Arm wizard dialog ── */
elements.addArmClose?.addEventListener("click", () => {
  state.addArmWizard.open = false;
  state.addArmWizard.inProgress = false;
  elements.addArmDialog.close();
});

elements.addArmDialog?.addEventListener("close", () => {
  state.addArmWizard.open = false;
  state.addArmWizard.inProgress = false;
});

elements.addArmCopyPinBtn?.addEventListener("click", async () => {
  const pin = (state.addArmWizard?.pin || "").trim();
  if (!pin) return;
  try {
    await navigator.clipboard.writeText(pin);
  } catch {
    elements.addArmPinValue.select();
    document.execCommand("copy");
  }
  const original = elements.addArmCopyPinBtn.textContent;
  elements.addArmCopyPinBtn.textContent = "Copied!";
  setTimeout(() => {
    elements.addArmCopyPinBtn.textContent = original;
  }, 1200);
});

elements.addArmRegenerateBtn?.addEventListener("click", async () => {
  await withLoading(elements.addArmRegenerateBtn, async () => {
    await openAddArmWizard({ regenerate: true });
  });
});

/* ── Pair approve/reject ── */
elements.pendingPairs.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const approveId = target.dataset.requestId;
  if (!approveId) return;
  if (target.classList.contains("pair-approve")) {
    await withLoading(target, async () => {
      await window.openArm.approveDevicePair({ requestId: approveId });
      await window.openArm.listDevicePairing().catch(() => {});
      await window.openArm.listNodes().catch(() => {});
      showToast("Arm approved!", "success");
    });
  }
  if (target.classList.contains("pair-reject")) {
    const confirmed = await confirm(
      "Reject Pairing",
      "Are you sure you want to reject this Arm pairing request?",
    );
    if (!confirmed) return;
    await withLoading(target, async () => {
      await window.openArm.rejectDevicePair({ requestId: approveId });
      await window.openArm.listDevicePairing().catch(() => {});
    });
  }
});

/* ── Paired device actions ── */
elements.pairedArms.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const deviceId = (target.dataset.deviceId || "").trim();
  if (!deviceId) return;

  if (target.classList.contains("pair-wake")) {
    await withLoading(target, async () => {
      const deviceName = aliasForDevice(deviceId) || deviceId;
      const title = `Wake-on-LAN: ${deviceName}`;
      const subtitle = "Tip: Shift-click Wake to edit Wake-on-LAN settings.";

      const editMode = Boolean(event.shiftKey);
      let wol = wolConfigForDevice(deviceId);

      if (editMode) {
        const updated = await promptWakeOnLan({
          title,
          subtitle,
          currentValue: wol || undefined,
        });
        if (updated === null) return;
        if (updated?.remove) {
          await setWolConfig(deviceId, null);
          showToast("Wake-on-LAN settings removed.", "success");
          renderAll();
          return;
        }
        await setWolConfig(deviceId, updated);
        showToast("Wake-on-LAN settings saved.", "success");
        renderAll();
        return;
      }

      if (!wol) {
        const created = await promptWakeOnLan({
          title,
          subtitle,
          currentValue: undefined,
        });
        if (created === null) return;
        if (created?.remove) {
          await setWolConfig(deviceId, null);
          showToast("Wake-on-LAN settings removed.", "success");
          renderAll();
          return;
        }
        wol = created;
        await setWolConfig(deviceId, wol);
        showToast("Wake-on-LAN settings saved.", "success");
        renderAll();
      }

      const response = await window.openArm.wakeOnLan({
        mac: wol.mac,
        address: wol.address,
        port: wol.port,
      });
      if (!response?.ok) {
        throw new Error(response?.error?.message || "Wake-on-LAN failed.");
      }
      showToast("Wake packet sent.", "success");
      setTimeout(() => {
        void window.openArm.listNodes();
      }, 2200);
    });
    return;
  }

  if (target.classList.contains("pair-rename")) {
    await withLoading(target, async () => {
      const currentAlias = aliasForDevice(deviceId);
      const next = await promptRename({
        title: "Rename paired device",
        currentValue: currentAlias,
      });
      if (next === null) return;
      await setDeviceAlias(deviceId, next);
      showToast(next ? "Device renamed." : "Device name cleared.", "success");
      renderAll();
    });
    return;
  }

  if (target.classList.contains("pair-remove")) {
    const confirmed = await confirm(
      "Remove Paired Device (OpenArm Only)",
      "This removes the device from OpenArm's lists on this Controller Station. OpenClaw does not currently support deleting paired devices, so it will still exist in OpenClaw.",
    );
    if (!confirmed) return;
    await withLoading(target, async () => {
      await hideDevice(deviceId);
      showToast("Device removed from OpenArm UI.", "success");
      renderAll();
    });
  }
});

/* ── Manage hidden devices ── */
function setDevicesTab(tabName) {
  const next = (tabName || "paired").toString().trim().toLowerCase();
  state.devicesTab = next;
  for (const btn of elements.devicesTabButtons || []) {
    const name = (btn.dataset.devicesTab || "").toLowerCase();
    btn.classList.toggle("active", name === next);
  }
  for (const content of elements.devicesTabContents || []) {
    const name = (content.dataset.devicesTabContent || "").toLowerCase();
    content.classList.toggle("active", name === next);
  }
}

function focusDeviceRow(deviceId) {
  const safeId = (deviceId || "").trim();
  if (!safeId) return;
  const row = elements.pairedArms?.querySelector(
    `[data-device-id="${CSS.escape(safeId)}"]`,
  );
  if (!(row instanceof HTMLElement)) return;
  row.classList.add("row-focus");
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => row.classList.remove("row-focus"), 1800);
}

function openDevicesDialog({ tab = "paired", focusDeviceId = "" } = {}) {
  if (!elements.devicesDialog) return;
  setDevicesTab(tab);
  if (!elements.devicesDialog.open) {
    elements.devicesDialog.showModal();
  }
  if (focusDeviceId) {
    setTimeout(() => focusDeviceRow(focusDeviceId), 120);
  }
}

elements.armStationNodes?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const station = target.closest(".arm-station");
  if (!(station instanceof HTMLElement)) return;
  const deviceId = (station.dataset.deviceId || "").trim();
  openDevicesDialog({ tab: "paired", focusDeviceId: deviceId });
});

function renderHiddenDevicesTab() {
  if (!elements.hiddenDevicesList) return;
  const hidden = [...hiddenDeviceSet()];
  elements.hiddenDevicesList.innerHTML = "";
  if (!hidden.length) {
    elements.hiddenDevicesList.appendChild(
      createEmptyState("🙈", "No hidden devices."),
    );
    return;
  }
  for (const deviceId of hidden) {
    const alias = aliasForDevice(deviceId);
    const row = document.createElement("article");
    row.className = "list-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(alias || deviceId)}</strong>
        <div class="meta">ID ${escapeHtml(deviceId)}</div>
      </div>
      <div class="inline-actions">
        <button class="primary hidden-restore" data-device-id="${escapeHtml(deviceId)}" type="button">Restore</button>
      </div>
    `;
    elements.hiddenDevicesList.appendChild(row);
  }
}

elements.devicesTabBar?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const btn = target.closest("[data-devices-tab]");
  if (!(btn instanceof HTMLElement)) return;
  const name = (btn.dataset.devicesTab || "").toString();
  if (!name) return;
  setDevicesTab(name);
});

elements.devicesDialogClose?.addEventListener("click", () => {
  elements.devicesDialog?.close();
});

elements.manageHiddenBtn?.addEventListener("click", () => {
  openDevicesDialog({ tab: "hidden" });
});

elements.hiddenDevicesList?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("hidden-restore")) return;
  const deviceId = (target.dataset.deviceId || "").trim();
  if (!deviceId) return;
  await withLoading(target, async () => {
    await unhideDevice(deviceId);
    showToast("Device restored.", "success");
    renderAll();
  });
});

/* ── Refresh nodes ── */
elements.refreshNodesBtn.addEventListener("click", async () => {
  await withLoading(elements.refreshNodesBtn, async () => {
    const response = await window.openArm.listNodes();
    if (!response.ok) {
      elements.commandOutputBody.textContent = `Error: ${response.error?.message || "Failed to list nodes"}`;
      return;
    }
    state.nodes = response.nodes || [];
    updateNodePresence(state.nodes);
    renderNodeSelect();
    updateFileTransferSendState();
    renderPairingList();
  });
});

elements.targetNode.addEventListener("change", () => {
  state.selectedNodeId = elements.targetNode.value;
});

/* ── Run command ── */
elements.commandRunBtn.addEventListener("click", async () => {
  await withLoading(elements.commandRunBtn, async () => {
    elements.commandOutputBody.textContent = "Running command...";
    try {
      if (!hubRemoteControlEnabled()) {
        throw new Error("Remote Control is disabled in Group Settings.");
      }
      if (state.settings?.mode !== "hub") {
        throw new Error(
          "Quick Command is available only in Controller Station mode.",
        );
      }
      if (state.operatorConnection?.status !== "connected") {
        throw new Error("Controller is not connected. Click Reconnect first.");
      }
      const nodeId = selectedNodeOrThrow();
      const command = elements.commandInput.value.trim();
      if (!command) throw new Error("Command is required.");
      const node = state.nodes.find((entry) => entry.nodeId === nodeId);
      const platform = (node?.platform || "").toLowerCase();
      const argv = platform.includes("win")
        ? ["powershell.exe", "-NoProfile", "-Command", command]
        : ["/bin/bash", "-lc", command];
      const result = await runNodeInvoke({
        nodeId,
        command: "system.run",
        params: { command: argv, rawCommand: command, timeoutMs: 45_000 },
        timeoutMs: 60_000,
      });
      elements.commandOutputBody.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      elements.commandOutputBody.textContent = `Error: ${error.message}`;
      showToast(error.message, "error");
    }
  });
});

// Enter key for command input
elements.commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    elements.commandRunBtn.click();
  }
});

/* ── Chat ── */
elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = elements.chatInput.value.trim();
  if (!message) return;
  if (!hubRemoteControlEnabled()) {
    showToast("Remote Control is disabled in Group Settings.", "error");
    return;
  }
  if (state.settings?.mode !== "hub") {
    showToast(
      "Send Task is available only in Controller Station mode.",
      "error",
    );
    return;
  }
  if (state.operatorConnection?.status !== "connected") {
    showToast("Controller is not connected. Click Reconnect first.", "error");
    return;
  }
  const sendBtn = elements.chatForm.querySelector("button[type=submit]");
  await withLoading(sendBtn, async () => {
    const response = await window.openArm.sendChat({
      sessionKey: state.settings?.sessionKey || "main",
      message,
    });
    if (!response.ok) {
      appendChatLine({
        role: "system",
        text: `Send failed: ${response.error?.message || "unknown error"}`,
        meta: asTime(Date.now()),
      });
      showToast("Failed to send message", "error");
      return;
    }
    appendChatLine({ role: "you", text: message, meta: asTime(Date.now()) });
    elements.chatInput.value = "";
  });
});

elements.loadHistoryBtn.addEventListener("click", async () => {
  if (!hubRemoteControlEnabled()) {
    showToast("Remote Control is disabled in Group Settings.", "error");
    return;
  }
  if (state.settings?.mode !== "hub") {
    showToast(
      "Send Task is available only in Controller Station mode.",
      "error",
    );
    return;
  }
  if (state.operatorConnection?.status !== "connected") {
    showToast("Controller is not connected. Click Reconnect first.", "error");
    return;
  }
  await withLoading(elements.loadHistoryBtn, async () => {
    const response = await window.openArm.chatHistory({
      sessionKey: state.settings?.sessionKey || "main",
      limit: 120,
    });
    if (!response.ok) {
      appendChatLine({
        role: "system",
        text: `History failed: ${response.error?.message || "unknown error"}`,
        meta: asTime(Date.now()),
      });
      return;
    }
    elements.chatList.innerHTML = "";
    const messages = Array.isArray(response.response?.messages)
      ? response.response.messages
      : [];
    if (!messages.length) {
      elements.chatList.appendChild(
        createEmptyState(
          "💬",
          "No chat history yet. Send a message to get started.",
        ),
      );
    }
    for (const message of messages) {
      appendChatLine({
        role: message?.role || "assistant",
        text: extractMessageText(message) || "[empty]",
        meta: asTime(message?.timestamp || Date.now()),
      });
    }
  });
});

elements.clearLogsBtn.addEventListener("click", () => {
  state.logs = [];
  renderLogs();
});

/* ── Tab navigation ── */
elements.hubTabBar?.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  setTab(btn.dataset.tab);
});

/* ── Onboarding auto-fix ── */
elements.obRunAutoFixBtn?.addEventListener("click", async () => {
  await withLoading(elements.obRunAutoFixBtn, async () => {
    try {
      const obAutoFixStatus = elements.obAutoFixStatus;
      if (obAutoFixStatus) obAutoFixStatus.textContent = "Running auto-fix...";
      await runAutoFixFlow();
    } catch (error) {
      const message = error?.message || "Auto-fix failed.";
      if (elements.obAutoFixStatus)
        elements.obAutoFixStatus.textContent = message;
      showToast(message, "error");
    }
  });
});

/* ── Advanced Settings dialog ── */
elements.advancedSettingsBtn?.addEventListener("click", () => {
  fillGatewayInputsFromSettings();
  renderDetection();
  if (elements.advancedDialog && !elements.advancedDialog.open) {
    elements.advancedDialog.showModal();
  }
});

elements.advancedClose?.addEventListener("click", () => {
  elements.advancedDialog?.close();
});

elements.advancedSave?.addEventListener("click", async () => {
  await withLoading(elements.advancedSave, async () => {
    const patch = {
      gatewayUrl: (elements.gatewayUrlInput?.value || "").trim(),
      gatewayToken: (elements.gatewayTokenInput?.value || "").trim(),
      gatewayPassword: (elements.gatewayPasswordInput?.value || "").trim(),
      gatewayTlsFingerprint: (elements.gatewayTlsInput?.value || "").trim(),
      launchOnStartup: Boolean(elements.launchOnStartupInput?.checked),
      minimizeToTray: Boolean(elements.minimizeToTrayInput?.checked),
      closeToTray: Boolean(elements.closeToTrayInput?.checked),
      updateChecksEnabled: Boolean(elements.updateChecksEnabledInput?.checked),
      updatePromptEnabled: Boolean(elements.updatePromptEnabledInput?.checked),
      updateCheckIntervalHours: 24,
    };
    const urlErr = validateGatewayUrl(patch.gatewayUrl);
    if (urlErr) {
      showToast(urlErr, "error");
      return;
    }
    await callOk(
      window.openArm.saveSettings(patch),
      "Failed to save settings.",
    );
    showToast("Settings saved.", "success");
    elements.advancedDialog?.close();
  });
});

/* ── Advanced Settings utilities ── */
elements.utilitiesQuickCommandBtn?.addEventListener("click", () => {
  elements.advancedDialog?.close();
  if (!hubRemoteControlEnabled()) {
    showToast("Remote Control is disabled in Group Settings.", "error");
    return;
  }
  if (state.settings?.mode !== "hub") {
    showToast(
      "Quick Command is available only in Controller Station mode.",
      "error",
    );
    return;
  }
  if (state.operatorConnection?.status !== "connected") {
    showToast("Controller is not connected. Click Reconnect first.", "error");
    return;
  }
  if (elements.commandDialog && !elements.commandDialog.open) {
    elements.commandDialog.showModal();
  }
});

elements.utilitiesViewLogsBtn?.addEventListener("click", () => {
  elements.advancedDialog?.close();
  if (elements.logsDialog && !elements.logsDialog.open) {
    elements.logsDialog.showModal();
  }
});

elements.utilitiesRerunSetupBtn?.addEventListener("click", async () => {
  elements.advancedDialog?.close();
  await withLoading(elements.utilitiesRerunSetupBtn, async () => {
    await rerunSetupWizard();
  });
});

/* ── Group settings toggles ── */
async function saveGroupSetting(patch) {
  if (!patch || typeof patch !== "object") return;
  if (state.settings?.mode !== "hub") {
    showToast(
      "Group Settings are available only in Controller Station mode.",
      "error",
    );
    return false;
  }
  const response = await callOk(
    window.openArm.saveSettings(patch),
    "Failed to save group settings.",
  );
  if (response.settings) {
    state.settings = response.settings;
  }
  renderAll();
  return true;
}

async function handleGroupToggle(key, value) {
  if (syncingGroupSettings) return;
  const nextValue = Boolean(value);
  const previousValue = readGroupSettingValue(key);
  applyGroupToggleInputs(key, nextValue);
  syncingGroupSettings = true;
  try {
    const saved = await saveGroupSetting({ [key]: nextValue });
    if (!saved) {
      applyGroupToggleInputs(key, previousValue);
      renderGroupSettings();
    }
  } catch (error) {
    applyGroupToggleInputs(key, previousValue);
    renderGroupSettings();
    showToast(error?.message || "Failed to save group settings.", "error");
  } finally {
    syncingGroupSettings = false;
  }
}

elements.fileTransferCheck?.addEventListener("change", async () => {
  await handleGroupToggle(
    "hubFileTransferEnabled",
    Boolean(elements.fileTransferCheck?.checked),
  );
});

elements.fileTransferToggle?.addEventListener("change", async () => {
  await handleGroupToggle(
    "hubFileTransferEnabled",
    Boolean(elements.fileTransferToggle?.checked),
  );
});

elements.remoteControlCheck?.addEventListener("change", async () => {
  await handleGroupToggle(
    "hubRemoteControlEnabled",
    Boolean(elements.remoteControlCheck?.checked),
  );
});

elements.remoteControlToggle?.addEventListener("change", async () => {
  await handleGroupToggle(
    "hubRemoteControlEnabled",
    Boolean(elements.remoteControlToggle?.checked),
  );
});

/* ── Command dialog ── */

elements.commandDialogClose?.addEventListener("click", () => {
  elements.commandDialog?.close();
});

/* ── File transfer dialog ── */
elements.sendFileBtn?.addEventListener("click", () => {
  if (!hubFileTransferEnabled()) {
    showToast("File Transfer is disabled in Group Settings.", "error");
    return;
  }
  if (state.settings?.mode !== "hub") {
    showToast(
      "Send File is available only in Controller Station mode.",
      "error",
    );
    return;
  }
  if (state.operatorConnection?.status !== "connected") {
    showToast("Controller is not connected. Click Reconnect first.", "error");
    return;
  }
  resetFileTransferDialog();
  if (elements.fileTransferDialog && !elements.fileTransferDialog.open) {
    renderNodeSelect();
    elements.fileTransferDialog.showModal();
  }
});

elements.fileTransferClose?.addEventListener("click", () => {
  elements.fileTransferDialog?.close();
});

elements.fileRefreshNodesBtn?.addEventListener("click", async () => {
  await withLoading(elements.fileRefreshNodesBtn, async () => {
    const response = await window.openArm.listNodes();
    if (!response.ok) {
      setFileTransferStatus(
        `Error: ${response.error?.message || "Failed to list nodes"}`,
      );
      return;
    }
    state.nodes = response.nodes || [];
    updateNodePresence(state.nodes);
    renderNodeSelect();
    updateFileTransferSendState();
  });
});

elements.fileTargetNode?.addEventListener("change", () => {
  state.fileTransfer.targetNodeId = elements.fileTargetNode?.value || "";
  updateFileTransferSendState();
});

elements.fileDestPathInput?.addEventListener("input", () => {
  state.fileTransfer.destPath = (
    elements.fileDestPathInput?.value || ""
  ).trim();
  updateFileTransferSendState();
});

elements.filePickInput?.addEventListener("change", () => {
  const file = elements.filePickInput?.files?.[0] || null;
  state.fileTransfer.file = file || null;
  state.fileTransfer.name = file?.name || "";
  state.fileTransfer.size = Number(file?.size) || 0;
  if (file) {
    if (
      elements.fileDestPathInput &&
      !elements.fileDestPathInput.value.trim()
    ) {
      elements.fileDestPathInput.value = `C:\\Users\\Public\\Downloads\\${file.name}`;
    }
    setFileTransferStatus(`Selected ${file.name} (${formatBytes(file.size)}).`);
  } else {
    setFileTransferStatus("Pick a file and destination path, then send.");
  }
  updateFileTransferSendState();
});

elements.fileTransferSend?.addEventListener("click", async () => {
  await withLoading(elements.fileTransferSend, async () => {
    try {
      if (!hubFileTransferEnabled()) {
        throw new Error("File Transfer is disabled in Group Settings.");
      }
      if (state.settings?.mode !== "hub") {
        throw new Error(
          "Send File is available only in Controller Station mode.",
        );
      }
      if (state.operatorConnection?.status !== "connected") {
        throw new Error("Controller is not connected. Click Reconnect first.");
      }

      const file = state.fileTransfer.file;
      if (!file) {
        throw new Error("Pick a file first.");
      }
      if (file.size > fileTransferLimitBytes()) {
        throw new Error(
          `File is too large (${formatBytes(file.size)}). Limit is ${formatBytes(fileTransferLimitBytes())}.`,
        );
      }

      const nodeId = selectedFileTargetNodeOrThrow();
      const destPath = (elements.fileDestPathInput?.value || "").trim();
      if (!destPath) {
        throw new Error("Destination path is required.");
      }

      setFileTransferStatus(`Reading ${file.name}...`);
      const base64 = await readFileAsBase64(file);
      if (!base64) {
        throw new Error("File read failed.");
      }

      setFileTransferStatus(`Sending ${file.name} to ${destPath}...`);
      const result = await runNodeInvoke({
        nodeId,
        command: "openarm.file.write",
        params: {
          path: destPath,
          content: base64,
          encoding: "base64",
          append: false,
        },
        timeoutMs: 120_000,
      });

      const bytesWritten = Number(result?.bytesWritten) || 0;
      setFileTransferStatus(
        `Sent ${file.name} to ${destPath}. Wrote ${formatBytes(bytesWritten)}.`,
      );
      showToast("File sent.", "success");
    } catch (error) {
      const message = error?.message || "File transfer failed.";
      setFileTransferStatus(message);
      if (looksLikeAllowlistError(message)) {
        showToast(
          "Allowlist required: add openarm.file.write to gateway.nodes.allowCommands.",
          "error",
        );
      } else {
        showToast(message, "error");
      }
    } finally {
      updateFileTransferSendState();
    }
  });
});

/* ── Chat dialog ── */
elements.sendTaskBtn?.addEventListener("click", () => {
  if (!hubRemoteControlEnabled()) {
    showToast("Remote Control is disabled in Group Settings.", "error");
    return;
  }
  if (state.settings?.mode !== "hub") {
    showToast(
      "Send Task is available only in Controller Station mode.",
      "error",
    );
    return;
  }
  if (state.operatorConnection?.status !== "connected") {
    showToast("Controller is not connected. Click Reconnect first.", "error");
    return;
  }
  if (elements.chatDialog && !elements.chatDialog.open) {
    elements.chatDialog.showModal();
  }
});

elements.chatDialogClose?.addEventListener("click", () => {
  elements.chatDialog?.close();
});

/* ── Logs dialog ── */
elements.logsDialogClose?.addEventListener("click", () => {
  elements.logsDialog?.close();
});

/* ── Reconnect ── */
elements.reconnectBtn?.addEventListener("click", async () => {
  await withLoading(elements.reconnectBtn, async () => {
    const response = await window.openArm.connectForMode().catch((error) => ({
      ok: false,
      error: { message: error?.message || "Reconnect failed." },
    }));
    if (!response?.ok) {
      showToast(response?.error?.message || "Reconnect failed.", "error");
      return;
    }
    if (state.settings?.mode === "hub") {
      await window.openArm.listDevicePairing().catch(() => {});
      await window.openArm.listNodes().catch(() => {});
    }
    showToast("Reconnected.", "success");
  });
});

/* ── Disconnect All ── */
elements.disconnectAllBtn?.addEventListener("click", async () => {
  const confirmed = await confirm(
    "Disconnect All",
    "Disconnect all connections (Arm and Controller)?",
  );
  if (!confirmed) return;
  await withLoading(elements.disconnectAllBtn, async () => {
    await window.openArm.disconnectForMode().catch(() => {});
    showToast("All connections disconnected.", "success");
  });
});

/* ── Remove device ── */
elements.removeDeviceBtn?.addEventListener("click", () => {
  openDevicesDialog({ tab: "paired" });
  if (
    state.settings?.mode === "hub" &&
    state.operatorConnection?.status === "connected"
  ) {
    void window.openArm.listDevicePairing().catch(() => {});
    void window.openArm.listNodes().catch(() => {});
  }
});

/* ═══════════════════════════════════════════════════════════════
   IPC listeners
   ═══════════════════════════════════════════════════════════════ */

window.openArm.onStateUpdate((payload) => {
  const previousPairEvent = pairEventKey(state.pairPin?.lastEvent);
  state.settings = payload.settings;
  state.bootstrap = payload.bootstrap;
  state.nodeConnection = payload.nodeConnection;
  state.operatorConnection = payload.operatorConnection;
  state.nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  updateNodePresence(state.nodes);
  state.devicePairing = payload.devicePairing || state.devicePairing;
  state.pairPin = mergePairPinState(payload.pairPin, state.pairPin);
  if (!state.selectedRole) {
    state.selectedRole =
      state.settings?.mode || state.bootstrap?.installerRole || "";
    if (state.selectedRole) setRole(state.selectedRole);
  }
  fillGatewayInputsFromSettings();
  renderDetection();
  renderAll();
  maybeStartPairingRefresh();
  void maybeAdvanceAddArmWizard();

  const nextEvent = state.pairPin?.lastEvent;
  if (
    pairEventKey(nextEvent) !== previousPairEvent &&
    nextEvent?.reason === "redeemed" &&
    state.settings?.mode === "hub" &&
    state.operatorConnection?.status === "connected"
  ) {
    void window.openArm.listDevicePairing();
    void window.openArm.listNodes();
  }
});

window.openArm.onLogEntry((entry) => pushLog(entry));

window.openArm.onChatEvent((event) => {
  const stateText = event?.state || "event";
  const text =
    stateText === "error"
      ? `Error: ${event?.errorMessage || "unknown"}`
      : extractMessageText(event?.message) || `[${stateText}]`;
  appendChatLine({
    role: "openclaw",
    text,
    meta: `${stateText} · ${asTime(Date.now())}`,
  });
});

window.openArm.onGatewayEvent(() => {
  void window.openArm.listDevicePairing();
  void window.openArm.listNodes();
});

/* ═══════════════════════════════════════════════════════════════
   Init
   ═══════════════════════════════════════════════════════════════ */

async function init() {
  const response = await window.openArm.getState();
  if (!response.ok) {
    elements.finishStatus.textContent = `Failed to initialize: ${response.error?.message || "unknown error"}`;
    showToast("Failed to initialize app", "error");
    return;
  }
  state.settings = response.settings;
  state.bootstrap = response.bootstrap;
  state.nodeConnection = response.nodeConnection;
  state.operatorConnection = response.operatorConnection;
  state.nodes = Array.isArray(response.nodes) ? response.nodes : [];
  updateNodePresence(state.nodes);
  state.devicePairing = response.devicePairing || state.devicePairing;
  state.pairPin = mergePairPinState(response.pairPin, state.pairPin);
  resetAddArmWizard();
  state.selectedRole =
    state.settings?.mode || state.bootstrap?.installerRole || "";
  if (state.selectedRole) setRole(state.selectedRole);
  fillGatewayInputsFromSettings();
  renderDetection();
  renderAll();
  setStep(0);
  setTab("pairing");
  await initializeRuntimeConnectIfNeeded().catch(() => {});
  maybeStartPairingRefresh();
  void maybeAdvanceAddArmWizard();
}

init();

let topologyResizeRaf = 0;
window.addEventListener("resize", () => {
  if (topologyResizeRaf) cancelAnimationFrame(topologyResizeRaf);
  topologyResizeRaf = requestAnimationFrame(() => {
    topologyResizeRaf = 0;
    renderTopology();
  });
});
