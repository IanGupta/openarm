import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const companionDir = path.resolve(scriptDir, "..");
const sourceFile = path.join(companionDir, "tools", "uninstaller", "OpenArmUninstallerLauncher.cs");
const packageJson = JSON.parse(readFileSync(path.join(companionDir, "package.json"), "utf8"));
const distDir = path.join(companionDir, "dist");
const outputFile = path.join(
  distDir,
  `OpenArm-Uninstaller-${packageJson.version}.exe`
);

if (process.platform !== "win32") {
  throw new Error("build-uninstaller-launcher is only supported on Windows.");
}
if (!existsSync(sourceFile)) {
  throw new Error(`Missing source file: ${sourceFile}`);
}

mkdirSync(distDir, { recursive: true });

const winDir = process.env.WINDIR || "C:\\Windows";
const cscCandidates = [
  path.join(winDir, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
  path.join(winDir, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe")
];
const cscPath = cscCandidates.find((candidate) => existsSync(candidate));
if (!cscPath) {
  throw new Error("csc.exe not found. Install .NET Framework build tools.");
}

const compileArgs = [
  "/nologo",
  "/target:winexe",
  "/optimize+",
  "/platform:x64",
  "/r:System.Windows.Forms.dll",
  `/out:${outputFile}`,
  sourceFile
];

const result = spawnSync(cscPath, compileArgs, {
  cwd: companionDir,
  stdio: "inherit"
});

if (result.status !== 0) {
  throw new Error(`Failed to compile uninstaller launcher (exit code ${result.status ?? -1}).`);
}

console.log(`Generated ${outputFile}`);
