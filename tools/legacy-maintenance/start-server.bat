@echo off
cd /d "%~dp0"
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [INFO] Falling back to npx tsx server.ts...
    call npx tsx server.ts
)
pause
