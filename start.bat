@echo off
title Print Gateway
cd /d "%~dp0"

where pm2 >nul 2>&1
if not errorlevel 1 (
  pm2 start src\index.js --name print-gateway 2>nul
  pm2 restart print-gateway 2>nul
  echo Servis isleyir. Setup: http://localhost:3000/setup
  start http://localhost:3000/setup
  pause
  exit /b 0
)

start /B node src\index.js >> gateway.log 2>> gateway.err.log
timeout /t 2 /nobreak >nul
start http://localhost:3000/setup
echo Servis basladildi. Setup: http://localhost:3000/setup
pause
