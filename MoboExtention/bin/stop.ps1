if (Test-Path "bin\config.json") {
    $content = Get-Content -Path "bin\config.json" -Raw
    $content = $content -replace '"id": "[^"]*"', '"id": ""'
    Set-Content -Path "bin\config.json" -Value $content
} else {
    Write-Host "Error: config.json not found in the 'bin' folder."
}
Stop-Process -Name "v2ray" -Force -ErrorAction SilentlyContinue
Write-Host "The service has been stopped and the ID has been cleared."