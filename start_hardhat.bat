@echo off
chcp 65001 >nul
title EduVault - Local Hardhat EVM Node
color 0B
echo ===================================================
echo   EduVault: KHOI DONG HARDHAT EVM NODE (PORT 8545)
echo ===================================================
cd /d "%~dp0contracts"
node node_modules\hardhat\internal\cli\cli.js node
pause
