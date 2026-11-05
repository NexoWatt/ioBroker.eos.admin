@echo off
setlocal
cd /d "%~dp0"
call npm.cmd publish --dry-run
exit /b %ERRORLEVEL%
