' ============================================================
' Launch Budget Processor
' Double-click this file to start the app.
' Searches for app.py relative to this launcher's location.
' ============================================================

Dim scriptDir, pythonScript, shell, fso

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' --- Search for app.py ---
' Priority order:
'   1. Same folder as this .vbs
'   2. Any immediate subfolder (e.g. /src, /app, /backend)
'   3. One level up (e.g. launcher is in /tools, app is in parent)
'   4. Subfolders of parent

Function FindAppPy(startFolder)
    Dim f, subf, candidate

    ' 1. Check the start folder itself
    candidate = startFolder & "\app.py"
    If fso.FileExists(candidate) Then
        FindAppPy = candidate
        Exit Function
    End If

    ' 2. Check immediate subfolders
    For Each subf In fso.GetFolder(startFolder).SubFolders
        candidate = subf.Path & "\app.py"
        If fso.FileExists(candidate) Then
            FindAppPy = candidate
            Exit Function
        End If
    Next

    ' 3. Check one level up
    Dim parentFolder
    On Error Resume Next
    parentFolder = fso.GetParentFolderName(startFolder)
    On Error GoTo 0

    If parentFolder <> "" And parentFolder <> startFolder Then
        candidate = parentFolder & "\app.py"
        If fso.FileExists(candidate) Then
            FindAppPy = candidate
            Exit Function
        End If

        ' 4. Check subfolders of parent
        For Each subf In fso.GetFolder(parentFolder).SubFolders
            candidate = subf.Path & "\app.py"
            If fso.FileExists(candidate) Then
                FindAppPy = candidate
                Exit Function
            End If
        Next
    End If

    FindAppPy = "" ' Not found
End Function

pythonScript = FindAppPy(scriptDir)

If pythonScript = "" Then
    MsgBox "Could not find app.py near:" & vbCrLf & scriptDir & vbCrLf & vbCrLf & _
           "Searched this folder, its subfolders, and the parent folder.", _
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
    shell.Run "cmd /c start http://localhost:5000", 0, False
    WScript.Quit
End If

' Start Flask silently using the found path
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