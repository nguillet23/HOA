' ============================================================
' Stop Budget Processor
' Double-click this to shut down the app.
' ============================================================

Dim shell
Set shell = CreateObject("WScript.Shell")

' Kill any pythonw process running app.py
shell.Run "cmd /c taskkill /F /FI ""WINDOWTITLE eq pythonw*"" /IM pythonw.exe", 0, True

' Also target by image name in case the above misses it
shell.Run "cmd /c taskkill /F /IM pythonw.exe", 0, True

' Confirm to the user
MsgBox "Budget Processor has been stopped.", vbInformation, "Budget Processor"

Set shell = Nothing
