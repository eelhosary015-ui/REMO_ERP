@echo off
chcp 65001 > nul
echo ===================================================
echo جاري تشغيل نظام Remo Pro...
echo ===================================================
echo.
echo جاري تشغيل السيرفر في الخلفية...
start start-hidden.vbs

echo جاري الانتظار حتى يبدأ السيرفر...
timeout /t 5 /nobreak > NUL

echo جاري فتح المتصفح...
start http://localhost:3000

echo.
echo النظام يعمل الآن! يمكنك إغلاق هذه النافذة.
timeout /t 3 > NUL
