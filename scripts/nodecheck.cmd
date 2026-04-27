@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0nodecheck.ps1" %*
exit /b %ERRORLEVEL%
