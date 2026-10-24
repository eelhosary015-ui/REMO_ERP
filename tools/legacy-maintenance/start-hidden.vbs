Set WshShell = CreateObject("WScript.Shell")
' تشغيل أمر pm2 resurrect في الخلفية (0 تعني مخفي)
WshShell.Run "cmd.exe /c pm2 resurrect", 0, false
