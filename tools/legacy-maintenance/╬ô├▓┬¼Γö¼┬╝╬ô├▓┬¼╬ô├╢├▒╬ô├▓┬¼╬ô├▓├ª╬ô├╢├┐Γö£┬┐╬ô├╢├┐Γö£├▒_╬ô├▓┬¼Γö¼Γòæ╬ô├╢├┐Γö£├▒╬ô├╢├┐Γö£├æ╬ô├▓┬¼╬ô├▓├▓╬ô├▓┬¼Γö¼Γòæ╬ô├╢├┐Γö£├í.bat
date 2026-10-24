@echo off
TITLE RestoMaster Pro - Setup and Run
SETLOCAL

:: Set working directory to the script's location
cd /d "%~dp0"

echo ===================================================
echo    RestoMaster Pro - Integrated Setup ^& Launcher
echo ===================================================
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b
)

:: 2. Install Dependencies
echo [1/3] Checking and installing dependencies...
echo This may take a few minutes on the first run...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies. 
    echo Please check your internet connection and try again.
    pause
    exit /b
)
echo [SUCCESS] Dependencies are ready.
echo.

:: 3. Start Server
echo [2/3] Checking for existing server and starting...

:: Kill any process on port 3000 to avoid conflicts
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start the server in a new window
echo Starting server...
start "RestoMaster Server" cmd /c "npm run dev || pause"
echo [SUCCESS] Server process initiated.
echo.

:: 4. Open Browser
echo [3/3] Opening RestoMaster Pro in your browser...
:: Wait a bit for the server to be ready
timeout /t 5 >nul
start http://localhost:3000

echo.
echo ===================================================
echo    SYSTEM IS NOW RUNNING!
echo ===================================================
echo.
echo * You can now use the system in your browser.
echo * DO NOT CLOSE the minimized window labeled "RestoMaster Server".
echo * To stop the system, close the minimized window.
echo.
echo This window will close in 10 seconds...
timeout /t 10 >nul
exit
