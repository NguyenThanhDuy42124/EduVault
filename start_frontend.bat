@echo off
chcp 65001 >nul
title EduVault - Frontend React Vite (Port 5173)
color 0E
echo ===================================================
echo   EduVault: KHOI DONG FRONTEND VITE (PORT 5173)
echo   App: http://localhost:5173
echo ===================================================
cd /d "%~dp0frontend"
node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173
pause
