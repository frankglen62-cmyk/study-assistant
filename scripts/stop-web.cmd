@echo off
setlocal
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)
echo Stopped any web server listening on port 3000.
