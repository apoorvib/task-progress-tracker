$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$targetJson = & node (Join-Path $projectRoot 'server\setup.js') --describe
if ($LASTEXITCODE -ne 0) { throw 'Check the Postgres settings in .env.' }
$target = $targetJson | ConvertFrom-Json
Write-Host "Provisioning $($target.database) for $($target.user) on $($target.host):$($target.port)."
$adminUser = Read-Host 'Postgres administrator username [postgres]'
if (-not $adminUser) { $adminUser = 'postgres' }
$runtimeDirectory = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $runtimeDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)(F)" 'SYSTEM:(OI)(CI)(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect the local credentials directory.' }
$secret = Read-Host 'Postgres administrator password (used once, never saved)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $configuration = @{
        user = $adminUser
        password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $configuration | ConvertTo-Json -Compress | & node (Join-Path $projectRoot 'server\setup.js')
    if ($LASTEXITCODE -ne 0) { throw 'Postgres setup did not complete.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    if ($configuration) { $configuration.password = $null }
}
$configFile = Join-Path $projectRoot '.local\database.json'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $configFile /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict permissions on the local credentials file.' }
Write-Host 'Setup complete. App credentials are in .local\database.json; administrator credentials were not saved.'
