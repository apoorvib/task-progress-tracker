param([string]$Destination = [Environment]::GetFolderPath('Desktop'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$shortcutPath = Join-Path $Destination 'Task Progress Tracker.lnk'
if (Test-Path -LiteralPath $shortcutPath) {
    $existing = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
    if ($existing.Arguments -ne ('"' + (Join-Path $PSScriptRoot 'launch.vbs') + '"')) { throw 'A different shortcut already uses this name.' }
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + (Join-Path $PSScriptRoot 'launch.vbs') + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Open Task Progress Tracker'
$shortcut.WindowStyle = 7
$shortcut.IconLocation = (Join-Path $env:WINDIR 'System32\shell32.dll') + ',70'
$shortcut.Save()
Write-Output "Created $shortcutPath"
