@echo off
setlocal
cd /d "%~dp0backend"

where node >nul 2>&1 || (
	echo Node.js not found. Install Node.js 22 LTS, then run this file again.
	pause
	exit /b 1
)

if not exist "node_modules\express\package.json" (
	echo Installing backend packages...
	call npm ci || (
		echo Package installation failed.
		pause
		exit /b 1
	)
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do taskkill /f /pid %%P >nul 2>&1
start "HERA Backend" cmd /k "npm start"
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000/homepage"
