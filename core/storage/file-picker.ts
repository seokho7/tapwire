import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
type Runner = (file: string, args: string[]) => Promise<{ stdout: string }>;
const run: Runner = (file, args) => execute(file, args, { encoding: "utf8", windowsHide: true });

const MAC_PICKER = `
try
  return POSIX path of (choose file with prompt "Select a Tapwire session (.tpw, .wspy, .json)")
on error number -128
  return ""
end try`;
const WINDOWS_PICKER = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Select a Tapwire session'
$dialog.Filter = 'Tapwire sessions (*.tpw;*.wspy;*.json)|*.tpw;*.wspy;*.json|All files (*.*)|*.*'
$dialog.Multiselect = $false
try {
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::WriteLine($dialog.FileName)
  }
} finally { $dialog.Dispose() }`;

/** Opens on the machine running Tapwire. No file contents pass through the browser. */
export async function pickSessionFile(platform: NodeJS.Platform = process.platform, executePicker: Runner = run): Promise<string | null> {
  let stdout: string;
  if (platform === "darwin") {
    ({ stdout } = await executePicker("/usr/bin/osascript", ["-e", MAC_PICKER]));
  } else if (platform === "win32") {
    ({ stdout } = await executePicker("powershell.exe", ["-NoProfile", "-STA", "-Command", WINDOWS_PICKER]));
  } else if (platform === "linux") {
    const commands: [string, string[]][] = [
      ["zenity", ["--file-selection", "--title=Select a Tapwire session", "--file-filter=Tapwire sessions | *.tpw *.wspy *.json"]],
      ["kdialog", ["--getopenfilename", ".", "*.tpw *.wspy *.json|Tapwire sessions", "--title", "Select a Tapwire session"]],
    ];
    for (const [file, args] of commands) {
      try {
        ({ stdout } = await executePicker(file, args));
        return selectedPath(stdout);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code as string | number | undefined;
        if (code === 1) return null; // Native dialog cancelled.
        if (code !== "ENOENT") throw error;
      }
    }
    throw new Error("Local file selection requires zenity or kdialog on the Tapwire PC.");
  } else {
    throw new Error("Local file selection is not supported on this operating system.");
  }
  return selectedPath(stdout);
}

function selectedPath(stdout: string): string | null {
  // Remove the dialog's output newline, preserving spaces and Unicode in filenames.
  return stdout.replace(/\r?\n$/, "") || null;
}
