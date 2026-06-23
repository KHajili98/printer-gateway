@echo off
title Print Gateway - Qurasdirma
cd /d "%~dp0"
set NODE=%~dp0node\node.exe
set APP=%~dp0app

echo.
echo  Print Gateway qurasdirilir...
echo  (Node.js daxildir - ayrica qurasdirmaya ehtiyac yoxdur)
echo.

if not exist "%APP%\.env" (
  copy /Y "%APP%\.env.example" "%APP%\.env" >nul
  echo  .env yaradildi.
)

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
(
  echo @echo off
  echo cd /d "%APP%"
  echo start /B "" "%NODE%" src\index.js
) > "%STARTUP%\PrintGateway.bat"
echo  Avto-start aktivdir.

taskkill /F /IM node.exe /FI "WINDOWTITLE eq print-gateway*" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

cd /d "%APP%"
start /B "" "%NODE%" src\index.js
timeout /t 3 /nobreak >nul

echo.
echo  Qurasdirma tamamlandi!
echo  Setup: http://localhost:3000/setup
echo.
start http://localhost:3000/setup
pause
