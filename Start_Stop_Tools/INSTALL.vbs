' ============================================================
' Install Budget Processor (run once before first use)
' Double-click this to install all required Python packages.
' A small progress window will appear and close when done.
' ============================================================

Dim shell, fso, scriptDir, reqFile

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Function FindFile(startFolder, fileName)
    Dim subf, candidate, parentFolder

    ' 1. Same folder
    candidate = startFolder & "\" & fileName
    If fso.FileExists(candidate) Then
        FindFile = candidate
        Exit Function
    End If

    ' 2. Immediate subfolders
    For Each subf In fso.GetFolder(startFolder).SubFolders
        candidate = subf.Path & "\" & fileName
        If fso.FileExists(candidate) Then
            FindFile = candidate
            Exit Function
        End If
    Next

    ' 3. One level up
    On Error Resume Next
    parentFolder = fso.GetParentFolderName(startFolder)
    On Error GoTo 0

    If parentFolder <> "" And parentFolder <> startFolder Then
        candidate = parentFolder & "\" & fileName
        If fso.FileExists(candidate) Then
            FindFile = candidate
            Exit Function
        End If

        ' 4. Subfolders of parent
        For Each subf In fso.GetFolder(parentFolder).SubFolders
            candidate = subf.Path & "\" & fileName
            If fso.FileExists(candidate) Then
                FindFile = candidate
                Exit Function
            End If
        Next
    End If

    FindFile = "" ' Not found
End Function

reqFile = FindFile(scriptDir, "requirements.txt")

If reqFile = "" Then
    MsgBox "Could not find requirements.txt near:" & vbCrLf & scriptDir & vbCrLf & vbCrLf & _
           "Searched this folder, its subfolders, and the parent folder.", _
           vbCritical, "Install Error"
    WScript.Quit
End If

MsgBox "Installation will now begin." & vbCrLf & vbCrLf & _
       "A window will briefly appear while packages install." & vbCrLf & _
       "This may take 1-3 minutes. Click OK to continue.", _
       vbInformation, "Budget Processor — Install"

Dim cmd
cmd = "pip install -r """ & reqFile & """"
shell.Run "cmd /c " & cmd & " & echo. & echo Installation complete! & timeout /t 4", 1, True

MsgBox "Installation complete!" & vbCrLf & vbCrLf & _
       "You can now double-click ""Launch Budget Processor.vbs"" to start the app.", _
       vbInformation, "Budget Processor — Ready"

Set shell = Nothing
Set fso   = Nothing