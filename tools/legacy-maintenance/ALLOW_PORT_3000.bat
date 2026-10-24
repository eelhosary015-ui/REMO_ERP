@echo off
echo =======================================================
echo السماح للمنفذ 3000 بالمرور عبر جدار الحماية (Windows Firewall)
echo =======================================================
echo.

:: Check for administrator rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with administrator rights.
) else (
    echo [ERROR] يرجى تشغيل هذا الملف كمسؤول (Run as administrator)
    echo يرجى النقر بزر الماوس الأيمن على الملف واختيار "Run as administrator"
    pause
    exit /b 1
)

echo Adding firewall rule for port 3000...
netsh advfirewall firewall add rule name="ERP System Port 3000" dir=in action=allow protocol=TCP localport=3000
if %errorLevel% == 0 (
    echo.
    echo [SUCCESS] تم إضافة القاعدة بنجاح! يمكن الآن للهواتف الاتصال بالسيرفر.
) else (
    echo.
    echo [ERROR] حدث خطأ أثناء إضافة القاعدة.
)

pause
