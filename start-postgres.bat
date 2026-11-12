@echo off
set "ROOT=%~dp0"
set "PG_BIN=%ROOT%backend\node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe"
set "PG_DATA=%ROOT%backend\pgdata"
set "PG_LOG=%ROOT%backend\pgdata\logfile.log"

echo Starting PostgreSQL server on localhost:5432...
"%PG_BIN%" -D "%PG_DATA%" -l "%PG_LOG%" start
echo PostgreSQL started!
pause

