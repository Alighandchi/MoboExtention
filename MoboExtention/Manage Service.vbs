Dim shell, fso, configFile, configContent, userInput, inputArray, serverAddress, tokenId, response
Set shell = CreateObject("Wscript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the path to the current directory (where the VBS is)
currentPath = fso.GetParentFolderName(WScript.ScriptFullName)
configPath = currentPath & "\bin\config.json"

' Ask user if they want to start or stop the service
response = MsgBox("Select Yes to start the service or No to stop the service.", _
                 vbYesNoCancel + vbQuestion, "MoboVPN Control")

If response = vbYes Then
    ' Step 1: Clear the existing id and address in config.json
    If fso.FileExists(configPath) Then
        Set configFile = fso.OpenTextFile(configPath, 1) ' 1=ForReading
        configContent = configFile.ReadAll
        configFile.Close
        
        ' Clear the existing id and address
        configContent = Replace(configContent, """id"": ""[^""]*""", """id"": """"")
        configContent = Replace(configContent, """address"": ""[^""]*""", """address"": """"")
        
        ' Save the cleared content back to config.json
        Set configFile = fso.OpenTextFile(configPath, 2, True) ' 2=ForWriting
        configFile.Write configContent
        configFile.Close
    Else
        MsgBox "Error: config.json not found in the 'bin' folder.", vbExclamation, "MoboVPN"
        WScript.Quit
    End If
    
    ' Step 2: Ask the user for the Address:ID
    userInput = InputBox("Please enter the Server Address and Token ID in the format Address:ID" & vbCrLf & _
                         "MoboVPN Input")
    
    ' Check if the user entered input and it contains a colon
    If userInput <> "" And InStr(userInput, ":") > 0 Then
        ' Split the input into Address and ID
        inputArray = Split(userInput, ":")
        If UBound(inputArray) = 1 Then
            serverAddress = Trim(inputArray(0))
            tokenId = Trim(inputArray(1))
            
            ' Check if both parts are non-empty
            If serverAddress <> "" And tokenId <> "" Then
                ' Read the config file again
                Set configFile = fso.OpenTextFile(configPath, 1) ' 1=ForReading
                configContent = configFile.ReadAll
                configFile.Close
                
                ' Replace the empty id and address with the new values
                configContent = Replace(configContent, """id"": """"", """id"": """ & tokenId & """")
                configContent = Replace(configContent, """address"": """"", """address"": """ & serverAddress & """")
                
                ' Save the updated content
                Set configFile = fso.OpenTextFile(configPath, 2, True) ' 2=ForWriting
                configFile.Write configContent
                configFile.Close
                
                ' Run the run.bat file silently
                shell.Run "cmd /c ""cd bin && run.bat""", 0, True
                
                MsgBox "The service is starting with the new Token ID and Server Address.", vbInformation, "MoboVPN"
            Else
                MsgBox "Both Server Address and Token ID are required. The service will not start.", vbExclamation, "MoboVPN"
            End If
        Else
            MsgBox "Invalid input format. Please use Address:ID. The service will not start.", vbExclamation, "MoboVPN"
        End If
    Else
        MsgBox "No input provided or invalid format (use Address:ID). The service will not start.", vbExclamation, "MoboVPN"
    End If
    
ElseIf response = vbNo Then
    ' Step 1: Clear the existing id and address in config.json
    If fso.FileExists(configPath) Then
        Set configFile = fso.OpenTextFile(configPath, 1) ' 1=ForReading
        configContent = configFile.ReadAll
        configFile.Close
        
        ' Clear the existing id and address
        configContent = Replace(configContent, """id"": ""[^""]*""", """id"": """"")
        configContent = Replace(configContent, """address"": ""[^""]*""", """address"": """"")
        
        ' Save the cleared content back to config.json
        Set configFile = fso.OpenTextFile(configPath, 2, True) ' 2=ForWriting
        configFile.Write configContent
        configFile.Close
    Else
        MsgBox "Error: config.json not found in the 'bin' folder.", vbExclamation, "MoboVPN"
        WScript.Quit
    End If
    
    ' Step 2: Run the stop.ps1 file silently
    If fso.FileExists(currentPath & "\bin\stop.ps1") Then
        shell.Run "powershell -ExecutionPolicy Bypass -File """ & currentPath & "\bin\stop.ps1""", 0, True
        MsgBox "The service is stopping and the ID and Address have been cleared.", vbInformation, "MoboVPN"
    Else
        MsgBox "Error: stop.ps1 not found in the 'bin' folder.", vbExclamation, "MoboVPN"
    End If
End If