@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    Remo Pro - Local Server Start
echo ==========================================

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install it from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist node_modules (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo [INFO] Starting the server...
echo [INFO] You can access the system at http://localhost:3000
echo [INFO] Press Ctrl+C to stop the server.

:: Run the application
call npm run dev
if %errorlevel% neq 0 (
    echo [INFO] Retrying directly with npx tsx server.ts...
    call npx tsx server.ts
)

pause
