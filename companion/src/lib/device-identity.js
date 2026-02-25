const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { IDENTITY_VERSION } = require("./constants");
const { toBase64Url } = require("./util");

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function derivePublicKeyRaw(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" });
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  return toBase64Url(derivePublicKeyRaw(publicKeyPem));
}

function signDevicePayload(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return toBase64Url(signature);
}

function buildDeviceAuthPayload(params) {
  const version = params.nonce ? "v2" : "v1";
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const fields = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token
  ];
  if (version === "v2") {
    fields.push(params.nonce);
  }
  return fields.join("|");
}

function createDeviceIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const deviceId = crypto.createHash("sha256").update(derivePublicKeyRaw(publicKeyPem)).digest("hex");
  return {
    deviceId,
    publicKeyPem,
    privateKeyPem
  };
}

async function loadOrCreateDeviceIdentity(identityPath) {
  try {
    if (fsSync.existsSync(identityPath)) {
      const raw = await fs.readFile(identityPath, "utf8");
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.version === IDENTITY_VERSION &&
        typeof parsed.deviceId === "string" &&
        typeof parsed.publicKeyPem === "string" &&
        typeof parsed.privateKeyPem === "string"
      ) {
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem
        };
      }
    }
  } catch {
    // Regenerate if file is invalid.
  }

  const identity = createDeviceIdentity();
  await fs.mkdir(path.dirname(identityPath), { recursive: true });
  await fs.writeFile(
    identityPath,
    `${JSON.stringify(
      {
        version: IDENTITY_VERSION,
        ...identity,
        createdAtMs: Date.now()
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return identity;
}

module.exports = {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  buildDeviceAuthPayload
};

