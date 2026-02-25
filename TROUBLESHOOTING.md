# Troubleshooting

## Build for macOS fails on Windows
Expected: Electron macOS packaging requires macOS host for native notarization/signing flow.
Workaround used in this repo: mac ZIP artifacts can be refreshed by updating app payload (`app.asar`) in existing bundles.

## Linux build errors on Windows/WSL
If `mksquashfs` or archive lock errors occur:
- Build on native Linux CI/host for reliable AppImage output.
- Ensure no stale `7za`/builder processes are running.

## Tray/startup behavior not applying
- Open Advanced Settings and re-save:
  - Start with OS
  - Minimize to tray
  - Keep running in background
- Restart app after changing startup setting.

## Pairing issues
- Confirm Hub and Arm can both reach gateway.
- Verify Pair PIN has not expired.
- Check gateway command allowlist for `openarm.file.*` and `openarm.wol.wake` if using those features.
