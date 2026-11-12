# PowerShell script to start PostgreSQL server
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pgBin = Join-Path $rootDir "backend\node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe"
$pgData = Join-Path $rootDir "backend\pgdata"
$logFile = Join-Path $rootDir "backend\pgdata\logfile.log"

Write-Host "Starting PostgreSQL server..." -ForegroundColor Cyan
& $pgBin -D $pgData -l $logFile start
Write-Host "PostgreSQL is running on localhost:5432" -ForegroundColor Green

