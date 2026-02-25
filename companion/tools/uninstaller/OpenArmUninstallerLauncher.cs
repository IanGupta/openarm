using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Windows.Forms;

internal static class Program
{
    private const string ProductName = "OpenArm";

    private sealed class UninstallEntry
    {
        public string DisplayName { get; set; }
        public string UninstallString { get; set; }
        public string QuietUninstallString { get; set; }
        public string InstallLocation { get; set; }
        public RegistryHive Hive { get; set; }
        public string KeyPath { get; set; }

        public UninstallEntry()
        {
            DisplayName = "";
            UninstallString = "";
            QuietUninstallString = "";
            InstallLocation = "";
            KeyPath = "";
        }
    }

    private sealed class ParsedCommand
    {
        public string FileName { get; set; }
        public string Arguments { get; set; }

        public ParsedCommand()
        {
            FileName = "";
            Arguments = "";
        }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        var silent = args.Any(IsSilentArg);
        try
        {
            var entry = FindBestEntry();
            if (entry == null)
            {
                if (!silent)
                {
                    MessageBox.Show(
                        ProductName + " is not installed on this machine.",
                        "OpenArm Uninstaller",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                }
                return 2;
            }

            var command = !string.IsNullOrWhiteSpace(entry.QuietUninstallString)
                ? entry.QuietUninstallString
                : entry.UninstallString;
            if (string.IsNullOrWhiteSpace(command))
            {
                if (!silent)
                {
                    MessageBox.Show(
                        "Could not locate an uninstall command for " + ProductName + ".",
                        "OpenArm Uninstaller",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                return 3;
            }

            var parsed = ParseCommand(command);
            if (parsed == null)
            {
                if (!silent)
                {
                    MessageBox.Show(
                        "Failed to parse uninstall command.",
                        "OpenArm Uninstaller",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                return 4;
            }

            var arguments = parsed.Arguments;
            if (silent && !ContainsSilentSwitch(arguments))
            {
                arguments = (arguments + " /S").Trim();
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = parsed.FileName,
                Arguments = arguments,
                UseShellExecute = true,
                WorkingDirectory = ResolveWorkingDirectory(parsed.FileName, entry.InstallLocation)
            };

            using (var process = Process.Start(startInfo))
            {
                if (process == null)
                {
                    if (!silent)
                    {
                        MessageBox.Show(
                            "Unable to start uninstaller process.",
                            "OpenArm Uninstaller",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                    }
                    return 5;
                }
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception ex)
        {
            if (!silent)
            {
                MessageBox.Show(
                    ex.Message,
                    "OpenArm Uninstaller",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            return 1;
        }
    }

    private static bool IsSilentArg(string arg)
    {
        var value = (arg ?? "").Trim();
        return value.Equals("--silent", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("/silent", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("/s", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ContainsSilentSwitch(string args)
    {
        var normalized = (args ?? "").ToLowerInvariant();
        return normalized.Contains(" /s ") || normalized.EndsWith(" /s") || normalized == "/s";
    }

    private static string ResolveWorkingDirectory(string fileName, string installLocation)
    {
        if (!string.IsNullOrWhiteSpace(installLocation) && Directory.Exists(installLocation))
        {
            return installLocation;
        }
        try
        {
            if (Path.IsPathRooted(fileName))
            {
                var parent = Path.GetDirectoryName(fileName);
                if (!string.IsNullOrWhiteSpace(parent) && Directory.Exists(parent))
                {
                    return parent;
                }
            }
        }
        catch
        {
            // Ignore and fallback.
        }
        return Environment.CurrentDirectory;
    }

    private static ParsedCommand ParseCommand(string raw)
    {
        var command = (raw ?? "").Trim();
        if (command.Length == 0)
        {
            return null;
        }
        if (command.StartsWith("\"", StringComparison.Ordinal))
        {
            var close = command.IndexOf('"', 1);
            if (close <= 1)
            {
                return null;
            }
            return new ParsedCommand
            {
                FileName = command.Substring(1, close - 1),
                Arguments = command.Substring(close + 1).Trim()
            };
        }

        var split = command.IndexOf(' ');
        if (split <= 0)
        {
            return new ParsedCommand
            {
                FileName = command,
                Arguments = ""
            };
        }

        return new ParsedCommand
        {
            FileName = command.Substring(0, split),
            Arguments = command.Substring(split + 1).Trim()
        };
    }

    private static UninstallEntry FindBestEntry()
    {
        var all = new List<UninstallEntry>();
        all.AddRange(EnumerateEntries(RegistryHive.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\Uninstall"));
        all.AddRange(EnumerateEntries(RegistryHive.LocalMachine, @"Software\Microsoft\Windows\CurrentVersion\Uninstall"));
        all.AddRange(EnumerateEntries(RegistryHive.LocalMachine, @"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"));

        return all
            .OrderByDescending(delegate(UninstallEntry entry) { return entry.DisplayName.Equals(ProductName, StringComparison.OrdinalIgnoreCase); })
            .ThenByDescending(delegate(UninstallEntry entry) { return entry.Hive == RegistryHive.CurrentUser; })
            .FirstOrDefault();
    }

    private static IEnumerable<UninstallEntry> EnumerateEntries(RegistryHive hive, string keyPath)
    {
        using (var root = RegistryKey.OpenBaseKey(hive, RegistryView.Default))
        using (var uninstallRoot = root.OpenSubKey(keyPath))
        {
            if (uninstallRoot == null)
            {
                yield break;
            }
            foreach (var name in uninstallRoot.GetSubKeyNames())
            {
                using (var appKey = uninstallRoot.OpenSubKey(name))
                {
                    if (appKey == null)
                    {
                        continue;
                    }
                    var displayName = (appKey.GetValue("DisplayName") as string ?? "").Trim();
                    if (!MatchesProduct(displayName))
                    {
                        continue;
                    }
                    var uninstallString = (appKey.GetValue("UninstallString") as string ?? "").Trim();
                    var quietUninstallString = (appKey.GetValue("QuietUninstallString") as string ?? "").Trim();
                    if (string.IsNullOrWhiteSpace(uninstallString) && string.IsNullOrWhiteSpace(quietUninstallString))
                    {
                        continue;
                    }

                    yield return new UninstallEntry
                    {
                        DisplayName = displayName,
                        UninstallString = uninstallString,
                        QuietUninstallString = quietUninstallString,
                        InstallLocation = (appKey.GetValue("InstallLocation") as string ?? "").Trim(),
                        Hive = hive,
                        KeyPath = keyPath + "\\" + name
                    };
                }
            }
        }
    }

    private static bool MatchesProduct(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return false;
        }
        if (displayName.Equals(ProductName, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        return displayName.IndexOf(ProductName, StringComparison.OrdinalIgnoreCase) >= 0;
    }
}
