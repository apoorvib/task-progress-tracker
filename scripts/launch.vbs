Option Explicit
Dim files, shell, scriptPath
Set files = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptPath = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "launch.ps1")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptPath & """", 0, False
