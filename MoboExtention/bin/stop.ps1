$configPath = Join-Path (Split-Path $MyInvocation.MyCommand.Path) "config.json"
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    $configContent = $configContent -replace '"id": "[^"]*"', '"id": ""'
    $configContent = $configContent -replace '"address": "[^"]*"', '"address": ""'
    Set-Content -Path $configPath -Value $configContent
} else {
    Write-Host "Error: config.json not found in the same directory as stop.ps1"
}

for ($i = 0; $i -lt 1; $i++) {
    Stop-Process -Name "wxray" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 1000
}