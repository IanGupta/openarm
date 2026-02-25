const dgram = require("node:dgram");

function parseMacAddress(raw) {
  const text = (raw || "").toString().trim();
  if (!text) {
    return null;
  }
  const hex = text.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) {
    return null;
  }
  const bytes = [];
  for (let i = 0; i < 12; i += 2) {
    const part = hex.slice(i, i + 2);
    const value = Number.parseInt(part, 16);
    if (!Number.isFinite(value)) {
      return null;
    }
    bytes.push(value);
  }
  const normalized = bytes.map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();
  return { bytes: Buffer.from(bytes), normalized };
}

function buildMagicPacket(macBytes) {
  if (!Buffer.isBuffer(macBytes) || macBytes.length !== 6) {
    throw new Error("INVALID_REQUEST: macBytes must be 6 bytes");
  }
  const header = Buffer.alloc(6, 0xff);
  const body = Buffer.alloc(16 * 6);
  for (let i = 0; i < 16; i++) {
    macBytes.copy(body, i * 6);
  }
  return Buffer.concat([header, body]);
}

async function sendWakeOnLan({ mac, address, port } = {}) {
  const parsed = parseMacAddress(mac);
  if (!parsed) {
    throw new Error("INVALID_REQUEST: mac must look like AA:BB:CC:DD:EE:FF");
  }
  const host = (address || "").toString().trim() || "255.255.255.255";
  const udpPort = Number(port) > 0 ? Number(port) : 9;
  if (!Number.isFinite(udpPort) || udpPort <= 0 || udpPort > 65535) {
    throw new Error("INVALID_REQUEST: port must be between 1 and 65535");
  }

  const packet = buildMagicPacket(parsed.bytes);

  const bytesSent = await new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.on("error", (error) => {
      try {
        socket.close();
      } catch {
        // Ignore close errors.
      }
      reject(error);
    });

    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
      } catch {
        // Some platforms may throw if broadcast is unsupported.
      }
      socket.send(packet, udpPort, host, (error, sent) => {
        try {
          socket.close();
        } catch {
          // Ignore close errors.
        }
        if (error) {
          reject(error);
          return;
        }
        resolve(typeof sent === "number" ? sent : packet.length);
      });
    });
  });

  return {
    ok: true,
    mac: parsed.normalized,
    address: host,
    port: udpPort,
    bytesSent
  };
}

module.exports = {
  parseMacAddress,
  buildMagicPacket,
  sendWakeOnLan
};

