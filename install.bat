@echo off
title Print Gateway - Qurasdirma
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo [X] Node.js tapilmadi!
  echo Yukle: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node scripts\install.js
pause
