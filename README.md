# OpenArm

OpenArm is a desktop companion for **OpenClaw** that makes remote device operations practical for real-world setups.

It supports two roles:
- **Arm**: a machine that can be remotely operated
- **Hub**: a machine that pairs with and controls arms through OpenClaw Gateway

OpenArm is designed for secure, low-friction remote workflows: setup wizard, pairing, connectivity checks, command execution, file operations, and Wake-on-LAN support.

---

## Highlights

- Guided onboarding (Arm/Hub role selection)
- Pair-PIN flow for Hub ? Arm enrollment
- Modernized UI (lighter theme, improved contrast, cleaner hierarchy)
- Background/tray behavior options:
  - Start with OS login
  - Minimize to tray
  - Keep running when window closes
- OpenClaw-aware integration helpers for node command workflows

---

## Architecture at a glance

- **OpenArm app** (Electron): UX + local bridge behavior
- **OpenClaw Gateway**: transport/auth/routing
- **OpenClaw agent tools**: orchestration (`nodes`, etc.)

Detailed protocol mapping and implementation notes are in:
- `OPENCLAW_COMPATIBILITY.md`

---

## Requirements

- Node.js **20+**
- Windows 10/11 for companion development/build on this repo setup
- Reachable OpenClaw Gateway (`ws://` or `wss://`)

---

## Quick start

From repo root:

```powershell
npm run setup
npm run dev:companion
```

Build Windows installer:

```powershell
npm run build:companion
```

Cross-platform artifacts are distributed through GitHub Releases.

---

## Releases and installers

See:
- `INSTALLERS.md`
- `releases/v1.0.0/README.md`
- GitHub Releases page for downloadable binaries

Checksums:
- `releases/v1.0.0/SHA256SUMS.txt`

---

## Security & privacy

- No test credentials/tokens are committed.
- No personal testing data should be committed.
- Please report vulnerabilities privately first (see `SECURITY.md`).

---

## Contributing

Please read:
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`

Bug reports and feature requests are welcome via GitHub Issues.

---

## License

MIT — see `LICENSE`.
