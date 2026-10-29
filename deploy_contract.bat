@echo off
chcp 65001 >nul
title EduVault - Deploy Smart Contract
color 0A
echo ===================================================
echo   EduVault: TRIEN KHAI SMART CONTRACT LEN LOCALHOST
echo ===================================================
cd /d "%~dp0contracts"
node node_modules\hardhat\internal\cli\cli.js run scripts\deploy.cjs --network localhost
echo.
echo Deploy hoan tat!
pause
