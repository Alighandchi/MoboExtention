@echo off
cd /d "%~dp0\bin"
start /b v2ray.exe run -config=config.json
@REM cmd.exe /K