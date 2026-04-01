' ============================================================
' Install Budget Processor (run once before first use)
' Double-click this to install all required Python packages.
' A small progress window will appear and close when done.
' ============================================================

Dim shell, fso, scriptDir, reqFile

Set shell     = CreateObject("WScript.Shell")
Set fso       = CreateObject("Scripting.FileSystemObject")
scriptDir     = fso.GetParentFolderName(WScript.ScriptFullName)
reqFile       = scriptDir & "\requirements.txt"

If Not fso.FileExists(reqFile) Then
    MsgBox "Could not find requirements.txt in:" & vbCrLf & scriptDir, vbCritical, "Install Error"
    WScript.Quit
End If

MsgBox "Installation will now begin." & vbCrLf & vbCrLf & _
       "A window will briefly appear while packages install." & vbCrLf & _
       "This may take 1-3 minutes. Click OK to continue.", _
       vbInformation, "Budget Processor — Install"

' Run pip install in a visible window so the user can see progress, then auto-close
Dim cmd
cmd = "pip install -r """ & reqFile & """"
shell.Run "cmd /c " & cmd & " & echo. & echo Installation complete! & timeout /t 4", 1, True

MsgBox "Installation complete!" & vbCrLf & vbCrLf & _
       "You can now double-click ""Launch Budget Processor.vbs"" to start the app.", _
       vbInformation, "Budget Processor — Ready"

Set shell = Nothing
Set fso   = Nothing
