@echo off
setlocal
set ROOT=C:\Users\glenn\Documents\NEW PROJECT

cd /d "%ROOT%"
start "" cmd /k call "%ROOT%\scripts\start-web.cmd"
timeout /t 6 /nobreak >nul
start "" http://localhost:3000/login
