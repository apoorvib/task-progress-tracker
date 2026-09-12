$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
$testRoot = Join-Path $projectRoot ('.local\pg-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$dataDirectory = Join-Path $testRoot 'data'
$port = 54329
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Test port $port is occupied." }
& (Join-Path $pgBin 'initdb.exe') -D $dataDirectory -A trust -U tracker_test --no-locale -E UTF8
if ($LASTEXITCODE -ne 0) { throw 'Could not initialize isolated test database.' }
$oldTestUrl = $env:TEST_DATABASE_URL
try {
    & (Join-Path $pgBin 'pg_ctl.exe') -D $dataDirectory -l (Join-Path $testRoot 'postgres.log') -o "-p $port -h 127.0.0.1" -w start
    if ($LASTEXITCODE -ne 0) { throw 'Could not start isolated test database.' }
    $env:TEST_DATABASE_URL = "postgresql://tracker_test@127.0.0.1:$port/postgres"
    Push-Location $projectRoot
    try { & node --test 'tests/*.test.js'; $testExit = $LASTEXITCODE } finally { Pop-Location }
} finally {
    & (Join-Path $pgBin 'pg_ctl.exe') -D $dataDirectory -m fast -w stop
    $env:TEST_DATABASE_URL = $oldTestUrl
}
if ($testExit -ne 0) { throw 'Tests failed.' }
