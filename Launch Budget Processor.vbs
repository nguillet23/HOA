' ============================================================
' Launch Budget Processor
' Double-click this file to start the app.
' No terminal window will appear.
' ============================================================

Dim scriptDir, pythonScript, shell, fso

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' Get the folder this .vbs file lives in
scriptDir    = fso.GetParentFolderName(WScript.ScriptFullName)
pythonScript = scriptDir & "\app.py"

' Make sure app.py exists
If Not fso.FileExists(pythonScript) Then
    MsgBox "Could not find app.py in:" & vbCrLf & scriptDir & vbCrLf & vbCrLf & _
           "Please make sure this launcher is in the same folder as app.py.", _
           vbCritical, "Budget Processor"
    WScript.Quit
End If

' Check if something is already running on port 5000
Dim alreadyRunning
alreadyRunning = False
On Error Resume Next
Dim http
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://localhost:5000", False
http.Send
If Err.Number = 0 And http.Status = 200 Then
    alreadyRunning = True
End If
On Error GoTo 0

If alreadyRunning Then
    ' App already running — just open the browser
    shell.Run "cmd /c start http://localhost:5000", 0, False
    WScript.Quit
End If

' Start Flask silently (0 = hidden window, False = don't wait)
shell.Run "pythonw """ & pythonScript & """", 0, False

' Wait up to 8 seconds for the server to be ready
Dim attempts, ready
attempts = 0
ready    = False

Do While attempts < 16 And Not ready
    WScript.Sleep 500
    On Error Resume Next
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", "http://localhost:5000", False
    http.Send
    If Err.Number = 0 And http.Status = 200 Then
        ready = True
    End If
    On Error GoTo 0
    attempts = attempts + 1
Loop

If ready Then
    shell.Run "cmd /c start http://localhost:5000", 0, False
Else
    MsgBox "The Budget Processor took too long to start." & vbCrLf & vbCrLf & _
           "Please make sure Python is installed and try again." & vbCrLf & _
           "If the problem continues, run INSTALL.vbs first.", _
           vbExclamation, "Budget Processor"
End If

Set shell = Nothing
Set fso   = Nothing
