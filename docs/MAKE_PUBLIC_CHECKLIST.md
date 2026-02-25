# Public Launch Checklist

Use this checklist to verify the repository is ready to flip from **Private** to **Public**.

## Documentation & Hygiene
- [ ] **README Polish**: Ensure the "Two Minute Quick Start" works and images in `docs/assets/` load correctly.
- [ ] **Link Verification**: Check that links in `CONTRIBUTING.md` and `SECURITY.md` point to this specific repo.
- [ ] **Secret Scan**: Run a local grep to ensure no API keys or `.env` files were accidentally committed.
  - Command: `git grep -i "token\|secret\|key"`
- [ ] **Social Image**: Go to Settings > General and upload `docs/assets/openarm-social-preview.png` (if available) or a relevant screenshot.

## Release Artifacts (v1.0.0)
- [ ] **Checksum Match**: Verify the files in `releases/v1.0.0/` match the hashes in `SHA256SUMS.txt`.
  - Windows: `Get-FileHash <file>`
  - Mac/Linux: `shasum -a 256 <file>`
- [ ] **Installers**: Ensure `OpenArm-Setup-1.0.0.exe` launches correctly on a clean Windows VM (if possible).

## Repo Settings
- [ ] **Discussions**: Enable "Discussions" in Settings > General > Features (optional, per Issue #5).
- [ ] **Issues**: Verify bug report templates are rendering correctly in `.github/ISSUE_TEMPLATE/`.

## The Flip
- [ ] Change repository visibility to **Public**.