@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
title EduVault - Seed Database
color 0D
echo ===================================================
echo   EduVault: NAP DU LIEU MAU VAO MYSQL DATABASE
echo ===================================================
cd /d "%~dp0"
echo Chay Migration Alembic...
cd backend
..\backend\.venv\Scripts\python.exe -m alembic upgrade head
cd ..
echo.
echo Nap du lieu mau...
backend\.venv\Scripts\python.exe scripts\seed.py
echo.
pause
