@echo off
echo ========================================================
echo   Starting Pinggy Tunnel (Alternative)
echo   Exposing localhost:3000 to the Internet
echo ========================================================
echo.
echo You will see a link like https://xxxx.a.pinggy.link
echo Copy it, add /careers at the end, and share it!
echo.
echo Keep this window open.
echo.
ssh -p 443 -R0:localhost:3000 a.pinggy.io
pause
