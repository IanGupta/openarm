const PROTOCOL_VERSION = 3;
const DEFAULT_TIMEOUT_MS = 45_000;
const OUTPUT_CAP = 200_000;
const OUTPUT_EVENT_TAIL = 20_000;
const IDENTITY_VERSION = 1;
const DEFAULT_SESSION_KEY = "main";

const NODE_CLIENT = {
  id: "node-host",
  mode: "node",
  role: "node",
  caps: ["system"]
};

const OPERATOR_CLIENT = {
  id: "cli",
  mode: "cli",
  role: "operator",
  scopes: ["operator.admin"],
  caps: ["tool-events"]
};

module.exports = {
  PROTOCOL_VERSION,
  DEFAULT_TIMEOUT_MS,
  OUTPUT_CAP,
  OUTPUT_EVENT_TAIL,
  IDENTITY_VERSION,
  DEFAULT_SESSION_KEY,
  NODE_CLIENT,
  OPERATOR_CLIENT
};
