@echo off
title Print Gateway - Qurasdirma
cd /d "%~dp0"

echo.
echo  Print Gateway qurasdirilir...
echo.

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo  .env yaradildi.
)

:: Avto-start qeydiyyati
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP%\PrintGateway.bat
(
  echo @echo off
  echo cd /d "%~dp0"
  echo start /B "" "%~dp0print-gateway.exe"
) > "%SHORTCUT%"
echo  Avto-start aktivdir.

:: Servisi baslat
taskkill /F /IM print-gateway.exe >nul 2>&1
start /B "" "%~dp0print-gateway.exe"
timeout /t 3 /nobreak >nul

echo.
echo  Qurasdirma tamamlandi!
echo  Setup paneli acilir: http://localhost:3000/setup
echo.
start http://localhost:3000/setup
pause
