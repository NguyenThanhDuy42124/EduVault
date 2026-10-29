@echo off
chcp 65001 >nul
title EduVault - Khoi Dong He Thong Toan Dien
color 0F

echo =====================================================================
echo       EduVault - HE THONG QUAN LY MUON THIET BI DAO TAO
echo       React 18 + FastAPI + MySQL 8.x + Hardhat EVM Blockchain
echo =====================================================================
echo.

REM 1. Khởi động Hardhat EVM Node
echo [1/4] Khoi dong Hardhat EVM Node tren port 8545...
start "EduVault - Hardhat EVM (Port 8545)" cmd /k "cd /d ""%~dp0contracts"" && title EduVault: Hardhat Node && color 0B && node node_modules\hardhat\internal\cli\cli.js node"

echo Dang cho Hardhat Node san sang (4 giay)...
timeout /t 4 /nobreak >nul

REM 2. Deploy Smart Contract len Hardhat Local
echo.
echo [2/4] Deploy Smart Contract EquipmentLending len Local EVM...
cd /d "%~dp0contracts"
call node node_modules\hardhat\internal\cli\cli.js run scripts\deploy.cjs --network localhost
if %errorlevel% neq 0 (
    echo [CANH BAO] Deploy contract that bai hoac Hardhat Node chua san sang.
    echo He thong se tiep tuc chay cac service con lai...
)

REM 3. Khởi động Backend FastAPI
echo.
echo [3/4] Khoi dong Backend FastAPI tai http://127.0.0.1:8000...
start "EduVault - Backend FastAPI (Port 8000)" cmd /k "cd /d ""%~dp0"" && title EduVault: Backend FastAPI && color 0A && set PYTHONIOENCODING=utf-8 && backend\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000"

REM 4. Khởi động Frontend Vite
echo.
echo [4/4] Khoi dong Frontend React Vite tai http://localhost:5173...
start "EduVault - Frontend React Vite (Port 5173)" cmd /k "cd /d ""%~dp0frontend"" && title EduVault: Frontend Vite && color 0E && node node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173"

echo.
echo Dang cho cac dich vu hoan tat khoi dong (3 giay)...
timeout /t 3 /nobreak >nul

echo.
echo =====================================================================
echo       EduVault DA KHOI DONG THANH CONG!
echo =====================================================================
echo   - Frontend:  http://localhost:5173
echo   - Backend:   http://127.0.0.1:8000/docs (Swagger UI)
echo   - Hardhat:   http://127.0.0.1:8545 (EVM RPC)
echo.
echo   Tai khoan mau:
echo   + Admin:     admin@eduvault.edu.vn  / admin123456
echo   + Sinh vien: sv01@eduvault.edu.vn   / student123
echo =====================================================================
echo.
echo Dang mo trinh duyet...
start http://localhost:5173

pause
