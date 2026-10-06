@echo off
setlocal
cd /d "%~dp0backend"

where node >nul 2>&1 || (
  echo Node.js not found. Install Node.js 22 LTS, then try again.
  pause
  exit /b 1
)

set "HERA_SEED_EMAIL=alexamemoria@gmail.com"
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p=Read-Host 'Password for alexamemoria@gmail.com' -AsSecureString;$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($p);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"`) do set "HERA_SEED_PASSWORD=%%P"
if not defined HERA_SEED_PASSWORD (
  echo No password entered. Nothing changed.
  pause
  exit /b 1
)

node seed-account.js "%HERA_SEED_EMAIL%"
set "HERA_SEED_PASSWORD="
if errorlevel 1 (
  echo Seeding failed. Start HERA once to create its database, then try again.
  pause
  exit /b 1
)

echo.
echo 30 days of HERA data ready for %HERA_SEED_EMAIL%.
pause