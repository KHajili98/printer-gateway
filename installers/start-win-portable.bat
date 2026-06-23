@echo off
cd /d "%~dp0app"
start /B "" "%~dp0node\node.exe" src\index.js
timeout /t 2 /nobreak >nul
start http://localhost:3000/setup
