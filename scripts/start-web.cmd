@echo off
setlocal
set ROOT=C:\Users\glenn\Documents\NEW PROJECT
set APPS_WEB=%ROOT%\apps\web
set LOGFILE=C:\Users\glenn\Documents\NEW PROJECT\web-runtime.log
set FORCE_REBUILD=%1
echo ==== %date% %time% starting web server ====>> "%LOGFILE%"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do (
  echo ==== stopping stale process %%P on port 3000 at %date% %time% ====>> "%LOGFILE%"
  taskkill /PID %%P /F >> "%LOGFILE%" 2>&1
)
cd /d "%ROOT%"
if /I "%FORCE_REBUILD%"=="rebuild" (
  if exist "%APPS_WEB%\.next" (
    echo ==== clearing .next for forced rebuild at %date% %time% ====>> "%LOGFILE%"
    rmdir /s /q "%APPS_WEB%\.next"
  )
)
echo ==== rebuilding web app at %date% %time% ====>> "%LOGFILE%"
cd /d "%APPS_WEB%"
call pnpm.cmd build >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo ==== build failed with exit code %errorlevel% at %date% %time% ====>> "%LOGFILE%"
  pause
  exit /b %errorlevel%
)
echo ==== starting production server from %APPS_WEB% ====>> "%LOGFILE%"
cd /d "%APPS_WEB%"
call pnpm.cmd start >> "%LOGFILE%" 2>&1
echo ==== exit code %errorlevel% at %date% %time% ====>> "%LOGFILE%"
pause
