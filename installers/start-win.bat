@echo off
cd /d "%~dp0"
start /B "" "%~dp0print-gateway.exe"
timeout /t 2 /nobreak >nul
start http://localhost:3000/setup
