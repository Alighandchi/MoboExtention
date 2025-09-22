Dim shell, fso, configFile, configContent, tokenId, response
Set shell = CreateObject("Wscript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the path to the current directory (where the VBS is)
currentPath = fso.GetParentFolderName(WScript.ScriptFullName)
configPath = currentPath & "\bin\config.json"

' Ask user if they want to start or stop the service
response = MsgBox("Would you like to start or stop the service?" & vbCrLf & _
                 "Click Yes to start, No to stop, or Cancel to exit.", _
                 vbYesNoCancel + vbQuestion, "MoboVPN Control")

If response = vbYes Then
    ' Clear the existing id in config.json
    If fso.FileExists(configPath) Then
        Set configFile = fso.OpenTextFile(configPath, 1) ' 1=ForReading
        configContent = configFile.ReadAll
        configFile.Close
        
        ' Clear the existing id
        configContent = Replace(configContent, """id"": ""[^""]*""", """id"": """"")
        
        ' Save the cleared content
        Set configFile = fso.OpenTextFile(configPath, 2, True) ' 2=ForWriting
        configFile.WriteLine configContent
        configFile.Close
    Else
        MsgBox "Error: config.json not found in the 'bin' folder.", vbExclamation, "MoboVPN"
        WScript.Quit
    End If
    
    ' Ask the user for the Token ID
    tokenId = InputBox("Please enter your Token ID:", "MoboVPN Token ID")
    
    ' Check if the user entered a Token ID and didn't cancel
    If tokenId <> "" Then
        ' Read the config file again
        Set configFile = fso.OpenTextFile(configPath, 1) ' 1=ForReading
        configContent = configFile.ReadAll
        configFile.Close
        
        ' Replace the empty id with the new token
        configContent = Replace(configContent, """id"": """"", """id"": """ & tokenId & """")
        
        ' Save the updated content
        Set configFile = fso.OpenTextFile(configPath, 2, True) ' 2=ForWriting
        configFile.WriteLine configContent
        configFile.Close
        
        ' Run the run.bat file silently
        shell.Run "cmd /c ""cd bin && run.bat""", 0, True
        
        MsgBox "The service is starting with the new Token ID.", vbInformation, "MoboVPN"
    Else
        MsgBox "No Token ID entered. The service will not start.", vbExclamation, "MoboVPN"
    End If
    
ElseIf response = vbNo Then
    ' Run the stop.ps1 file silently
    If fso.FileExists(currentPath & "\bin\stop.ps1") Then
        shell.Run "powershell -ExecutionPolicy Bypass -File """ & currentPath & "\bin\stop.ps1""", 0, True
        MsgBox "The service is stopping.", vbInformation, "MoboVPN"
    Else
        MsgBox "Error: stop.ps1 not found in the 'bin' folder.", vbExclamation, "MoboVPN"
    End If
End If