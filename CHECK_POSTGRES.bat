@echo off
TITLE Remo Pro - PostgreSQL Check
SETLOCAL

echo ===================================================
echo    Remo Pro - PostgreSQL Troubleshooter
echo ===================================================
echo.

echo [1/3] Checking if PostgreSQL service is installed...
echo.

set "found=0"
for /f "tokens=*" %%a in ('net start ^| findstr /i "postgresql"') do (
    echo [FOUND] PostgreSQL Service: %%a
    set "found=1"
)

if %found%==0 (
    echo [ERROR] No PostgreSQL service found running.
    echo Attempting to start common PostgreSQL services...
    
    net start postgresql-x64-16
    if %errorlevel% neq 0 net start postgresql-x64-15
    if %errorlevel% neq 0 net start postgresql-x64-14
    if %errorlevel% neq 0 net start postgresql-x64-13
    if %errorlevel% neq 0 net start postgresql-x64-12
    
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] PostgreSQL service started successfully!
    ) else (
        echo.
        echo [CRITICAL] Could not find or start PostgreSQL.
        echo Please ensure PostgreSQL is installed from: https://www.postgresql.org/download/windows/
    )
) else (
    echo [OK] PostgreSQL service seems to be running.
)

echo.
echo [2/3] Verifying .env configuration...
if not exist ".env" (
    echo [WARNING] .env file missing! Creating from example...
    copy .env.example .env
)
echo [OK] .env file exists.

echo.
echo [3/3] Checking Database connectivity...
echo Running diagnostic script...
npx tsx check_db.js

echo.
echo ===================================================
echo Troubleshooting finished.
echo If the error persists, please check your Firewall.
echo ===================================================
echo.
pause
