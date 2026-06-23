@echo off
pm2 stop print-gateway 2>nul
pm2 delete print-gateway 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
echo Servis dayandirildi.
pause
