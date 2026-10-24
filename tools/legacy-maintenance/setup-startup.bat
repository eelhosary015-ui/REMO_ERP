@echo off
echo ===================================================
echo Remo Pro - Setup Auto Start (Hidden)
echo ===================================================
echo.
echo This script will add the server to Windows Startup
echo so it runs automatically in the background when the
echo computer turns on.
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%~dp0start-hidden.vbs"

if not exist "%VBS_FILE%" (
    echo Error: start-hidden.vbs not found!
    pause
    exit /b 1
)

echo Creating shortcut in Startup folder...
set "SHORTCUT_FILE=%STARTUP_DIR%\RemoPro.lnk"

powershell -Command "$wshell = New-Object -ComObject WScript.Shell; $shortcut = $wshell.CreateShortcut('%SHORTCUT_FILE%'); $shortcut.TargetPath = 'wscript.exe'; $shortcut.Arguments = '\"%VBS_FILE%\"'; $shortcut.WorkingDirectory = '%~dp0'; $shortcut.WindowStyle = 1; $shortcut.Save()"

echo.
echo Success! The system will now start automatically in the background
echo every time you turn on this computer.
echo.
echo To start it right now, double-click "start-hidden.vbs".
echo.
pause
