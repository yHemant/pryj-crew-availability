@echo off
set "ROOT=%~dp0"
set "PG_BIN=%ROOT%backend\node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe"
set "PG_DATA=%ROOT%backend\pgdata"

echo Stopping PostgreSQL server...
"%PG_BIN%" -D "%PG_DATA%" stop -m fast
echo PostgreSQL stopped.
pause

