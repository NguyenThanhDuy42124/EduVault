@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title EduVault - Backend FastAPI (Port 8000)
color 0A
echo ===================================================
echo   EduVault: KHOI DONG BACKEND FASTAPI (PORT 8000)
echo   Docs: http://127.0.0.1:8000/docs
echo ===================================================
cd /d "%~dp0"
backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
pause
