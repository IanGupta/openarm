const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const handler = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld("openArm", {
  getState: () => ipcRenderer.invoke("state:get"),
  saveSettings: (patch) => ipcRenderer.invoke("settings:save", patch),
  setMode: (payload) => ipcRenderer.invoke("mode:set", payload),
  generatePairPin: (payload) => ipcRenderer.invoke("pairpin:generate", payload),
  redeemPairPin: (payload) => ipcRenderer.invoke("pairpin:redeem", payload),
  connectNode: () => ipcRenderer.invoke("node:connect"),
  disconnectNode: () => ipcRenderer.invoke("node:disconnect"),
  connectOperator: () => ipcRenderer.invoke("operator:connect"),
  disconnectOperator: () => ipcRenderer.invoke("operator:disconnect"),
  connectForMode: () => ipcRenderer.invoke("connections:connectForMode"),
  disconnectForMode: () => ipcRenderer.invoke("connections:disconnectForMode"),
  listNodes: () => ipcRenderer.invoke("gateway:nodesList"),
  listDevicePairing: () => ipcRenderer.invoke("gateway:devicePairList"),
  approveDevicePair: (payload) => ipcRenderer.invoke("gateway:devicePairApprove", payload),
  rejectDevicePair: (payload) => ipcRenderer.invoke("gateway:devicePairReject", payload),
  autoFixGateway: (payload) => ipcRenderer.invoke("gateway:autoFix", payload),
  enableAgentIntegration: (payload) => ipcRenderer.invoke("gateway:agentIntegrationEnable", payload),
  invokeNode: (payload) => ipcRenderer.invoke("gateway:nodeInvoke", payload),
  sendChat: (payload) => ipcRenderer.invoke("gateway:chatSend", payload),
  chatHistory: (payload) => ipcRenderer.invoke("gateway:chatHistory", payload),
  wakeOnLan: (payload) => ipcRenderer.invoke("wol:send", payload),
  onStateUpdate: (callback) => subscribe("state:update", callback),
  onLogEntry: (callback) => subscribe("log:entry", callback),
  onChatEvent: (callback) => subscribe("chat:event", callback),
  onGatewayEvent: (callback) => subscribe("gateway:event", callback)
});
