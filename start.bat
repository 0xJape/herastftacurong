@echo off
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do taskkill /f /pid %%P >nul 2>&1
cd /d "%~dp0backend"
start "HERA Backend" cmd /k "npm start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
