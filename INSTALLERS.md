# Installers and Release Artifacts

Current release artifacts are in `releases/v1.0.0/`:
- `OpenArm-Setup-1.0.0.exe`
- `OpenArm-Uninstaller-1.0.0.exe`
- `OpenArm-1.0.0-mac-x64.zip`
- `OpenArm-1.0.0-mac-arm64.zip`
- `openarm-1.0.0.tar.gz`
- `SHA256SUMS.txt`

## Verify downloads
- Windows: `Get-FileHash -Algorithm SHA256 <file>`
- macOS/Linux: `shasum -a 256 <file>`

Compare results with `SHA256SUMS.txt`.
