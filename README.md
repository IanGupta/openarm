# OpenArm (Windows app for OpenClaw)

> This repository is prepared for open-source publication. It is currently private while maintainers finalize release housekeeping.

## Privacy/Sanitization
This repository has been prepared to avoid publishing personal testing data:
- No user-specific tokens/passwords
- No personal phone numbers
- No personal machine paths in tracked config
- No temporary local test folders

See `INSTALLERS.md`, `TROUBLESHOOTING.md`, and `releases/v1.0.0/SHA256SUMS.txt` for release ops.


OpenArm is a Windows desktop app for both sides of OpenClaw remote control:
- `Arm` mode: this machine is controlled by OpenClaw.
- `Hub` mode: this machine manages pairing and controls connected arms.

It is designed for the "basement hub + living room laptop" setup:
- Main OpenClaw instance runs on one machine.
- OpenArm runs on another Windows machine.
- Hub can pair and control arm devices through OpenClaw Gateway.

Detailed implementation mapping is in `OPENCLAW_COMPATIBILITY.md`.

## Compatibility target

OpenArm is aligned to OpenClaw Gateway protocol v3 and node-host semantics:
- WebSocket challenge/handshake: `connect.challenge` -> `connect`
- Node invoke path: `node.invoke.request` (event) -> `node.invoke.result` (request)
- Node event uplink: `node.event`
- Node command surface:
  - `system.run`
  - `system.which`
  - `system.execApprovals.get`
  - `system.execApprovals.set`
  - optional extended commands: `openarm.file.read`, `openarm.file.write`, `openarm.file.list`, `openarm.file.stat`

## Onboarding-first UI

OpenArm launches into a guided setup wizard:
1. Choose role: `Arm` or `Hub`.
2. Arm mode: enter the 4-digit Pair PIN from Hub.
3. Hub mode: set gateway URL + token/password.
4. Finish and connect.

After setup:
- Arm screen stays minimal and connection-focused.
- Hub screen provides pair-code generation, pending pair approvals, quick node command test, and chat.

## OpenClaw hub + agent awareness (OpenArm integration)

From Hub mode, OpenArm now auto-configures OpenClaw on first successful controller connection (and re-checks when gateway target changes) so both hub workflow and agent behavior treat OpenArm as the Arm bridge:
- Adds `nodes` to OpenClaw tool policy (global and default agent where patchable).
- Updates default agent `TOOLS.md` with a connection-first OpenArm workflow (`status` -> `run`/`which` -> `invoke`).
- Installs `openarm` skill files (`~/.openclaw/skills/openarm/SKILL.md`, plus WSL when detected).
- Adds OpenArm extended commands to `gateway.nodes.allowCommands` (`openarm.file.*`, `openarm.wol.wake`).

You can still run the manual "Enable agent integration" action from guided setup; it now verifies/applies the same idempotent flow.

## Prerequisites

- Node.js 20+
- Windows 10/11
- Running OpenClaw Gateway reachable over `ws://` or `wss://`

## Setup

From repo root:

```powershell
npm run setup
```

Run the app in development:

```powershell
npm run dev:companion
```

Inside the app:
1. Follow setup wizard.
2. If this is a Hub, generate a 4-digit Pair PIN and share it with the Arm device.
3. On Arm, enter the PIN (auto-discovery finds Hub; manual Hub IP fallback is available).
4. Back on Hub, approve pending pairing request.

## Build shareable installer (.exe)

```powershell
npm run build:companion
```

Artifact:
- `companion/dist/OpenArm-Setup-0.1.0.exe`
- `companion/dist/OpenArm-Uninstaller-0.1.0.exe`

The installer also writes the standard Windows uninstall entry (Apps & Features / Add-Remove Programs).
At installer start, OpenArm asks whether this device should default to Arm or Hub mode.

## Extended file commands (`openarm.file.*`)

OpenClaw default node command allowlist does not include custom commands.  
To invoke `openarm.file.*` through the gateway, add them to `gateway.nodes.allowCommands` in your OpenClaw config.

Example:

```json
{
  "gateway": {
    "nodes": {
      "allowCommands": [
        "openarm.file.read",
        "openarm.file.write",
        "openarm.file.list",
        "openarm.file.stat"
      ]
    }
  }
}
```

Without this allowlist update, `system.run` still works and can handle file operations via shell commands.

## Security notes

- This app intentionally enables remote command execution on the Windows machine.
- Use strong gateway auth, trusted networks/VPN, and TLS in remote scenarios.
- Device identity keys are stored in app user data and used for OpenClaw device signatures.
