@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sentinel.ps1" %*
exit /b %ERRORLEVEL%
