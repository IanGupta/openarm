const crypto = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = "openarm") {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function sanitizeText(value, maxLen = 160) {
  return (value ?? "").toString().trim().slice(0, maxLen);
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeFingerprint(input) {
  return (input ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll(":", "");
}

function toBase64Url(buffer) {
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function truncateOutput(raw, maxChars) {
  if (raw.length <= maxChars) {
    return { text: raw, truncated: false };
  }
  return {
    text: `... (truncated) ${raw.slice(raw.length - maxChars)}`,
    truncated: true
  };
}

function makeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  nowIso,
  randomId,
  sanitizeText,
  safeJsonParse,
  normalizeFingerprint,
  toBase64Url,
  fromBase64Url,
  truncateOutput,
  makeErrorMessage
};

