param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.local'
$port = 4317
$appConfig = Join-Path $runtimeDirectory 'app.json'
if (Test-Path -LiteralPath $appConfig) { $port = (Get-Content -LiteralPath $appConfig -Raw | ConvertFrom-Json).port }
$url = "http://localhost:$port"
function Get-TrackerHealth {
    # Connect directly to the IPv4 listener while preserving the app's canonical Host.
    try {
        return Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -Headers @{ Host = "localhost:$port" } -TimeoutSec 2
    } catch { return $null }
}
$mutex = New-Object System.Threading.Mutex($false, "Local\TaskProgressTracker-$port")
$acquired = $false
try {
    try { $acquired = $mutex.WaitOne(15000) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
    if (-not $acquired) { throw 'Another tracker launch is still in progress. Try again shortly.' }
    $health = Get-TrackerHealth
    if ($health -and $health.app -ne 'task-progress-tracker') { throw "Another application is using $url." }
    if (-not $health) {
        $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($listener) { throw "Port $port is occupied, but the tracker did not respond. Check .local\server-error.log. The tracker address was not changed." }
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
        $env:PORT = [string]$port
        $arguments = '"' + (Join-Path $projectRoot 'server\index.js') + '"'
        Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') `
            -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log') | Out-Null
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            Start-Sleep -Milliseconds 250
            $health = Get-TrackerHealth
            if ($health -and $health.app -eq 'task-progress-tracker') { break }
        }
        if (-not $health -or $health.app -ne 'task-progress-tracker') { throw 'The tracker did not start. See .local\server-error.log.' }
    }
    if (-not $NoBrowser) { Start-Process $url }
    Write-Output $url
} catch {
    if (-not $NoBrowser) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($_.Exception.Message, 'Task Progress Tracker') | Out-Null
    }
    throw
} finally {
    if ($acquired) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
