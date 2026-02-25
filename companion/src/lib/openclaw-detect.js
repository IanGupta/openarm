const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { sanitizeText } = require("./util");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveHomeFromEnv(env) {
  const openclawHome = sanitizeText(env?.OPENCLAW_HOME, 2000);
  if (openclawHome) {
    return path.resolve(openclawHome);
  }
  return os.homedir();
}

function resolveConfigCandidates() {
  const env = process.env;
  const home = resolveHomeFromEnv(env);
  const stateDir =
    sanitizeText(env.OPENCLAW_STATE_DIR, 2000) ||
    sanitizeText(env.CLAWDBOT_STATE_DIR, 2000) ||
    path.join(home, ".openclaw");
  const configOverride =
    sanitizeText(env.OPENCLAW_CONFIG_PATH, 2000) || sanitizeText(env.CLAWDBOT_CONFIG_PATH, 2000);
  const configNames = ["openclaw.json", "clawdbot.json", "moldbot.json", "moltbot.json"];
  const dirs = unique([
    stateDir,
    path.join(home, ".openclaw"),
    path.join(home, ".clawdbot"),
    path.join(home, ".moldbot"),
    path.join(home, ".moltbot")
  ]);
  const candidates = [];
  if (configOverride) {
    candidates.push(path.resolve(configOverride));
  }
  for (const dir of dirs) {
    for (const name of configNames) {
      candidates.push(path.join(dir, name));
    }
  }
  return unique(candidates).map((candidate) => ({
    path: candidate,
    exists: fs.existsSync(candidate)
  }));
}

function detectCliCandidates() {
  const results = [];
  const lookupBin = process.platform === "win32" ? "where.exe" : "which";
  for (const executable of ["openclaw", "clawdbot"]) {
    try {
      const output = execFileSync(lookupBin, [executable], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const entry of lines) {
        const absolute = path.resolve(entry);
        results.push({
          path: absolute,
          exists: fs.existsSync(absolute)
        });
      }
    } catch {
      // Ignore lookup failures.
    }
  }
  return unique(results.map((entry) => entry.path)).map((entry) => ({
    path: entry,
    exists: fs.existsSync(entry)
  }));
}

function detectOpenClawEnvironment() {
  const configCandidates = resolveConfigCandidates();
  const cliCandidates = detectCliCandidates();
  const detectedConfig = configCandidates.find((candidate) => candidate.exists) || null;
  const detectedCli = cliCandidates.find((candidate) => candidate.exists) || null;
  return {
    platform: process.platform,
    home: resolveHomeFromEnv(process.env),
    configCandidates,
    cliCandidates,
    detectedConfigPath: detectedConfig?.path || null,
    detectedCliPath: detectedCli?.path || null
  };
}

module.exports = {
  detectOpenClawEnvironment
};
