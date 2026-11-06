# =============================================================================
# EduVault - Script khởi chạy một chạm (Windows PowerShell)
# Mục đích: Khởi động song song 3 tiến trình: Hardhat Node, FastAPI Backend,
#            Vite Frontend trong 3 cửa sổ PowerShell riêng biệt.
# Cách dùng: Mở PowerShell tại thư mục gốc EduVault -> .\scripts\start_all.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Lấy thư mục gốc của project (thư mục chứa script này ở scripts/)
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   EduVault - One-Click Startup Script" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# --- Kiểm tra điều kiện tiên quyết ---
Write-Host "[CHECK] Kiem tra dieu kien..." -ForegroundColor Yellow

# Kiểm tra Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js chua duoc cai dat. Tai tai: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Kiểm tra Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python chua duoc cai dat. Tai tai: https://python.org/" -ForegroundColor Red
    exit 1
}

# Kiểm tra node_modules contracts
if (-not (Test-Path "$ProjectRoot\contracts\node_modules")) {
    Write-Host "[SETUP] Cai dat dependencies cho contracts..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\contracts"
    npm install
    Pop-Location
}

# Kiểm tra node_modules frontend
if (-not (Test-Path "$ProjectRoot\frontend\node_modules")) {
    Write-Host "[SETUP] Cai dat dependencies cho frontend..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\frontend"
    npm install
    Pop-Location
}

# Kiểm tra .env backend
if (-not (Test-Path "$ProjectRoot\backend\.env")) {
    Write-Host "[SETUP] Tao file .env tu .env.example..." -ForegroundColor Yellow
    Copy-Item "$ProjectRoot\backend\.env.example" "$ProjectRoot\backend\.env"
    Write-Host "[WARN]  Vui long kiem tra lai $ProjectRoot\backend\.env truoc khi chay!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[1/3] Khoi dong Hardhat Local Node (port 8545)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ProjectRoot\contracts'; Write-Host 'HARDHAT NODE STARTING...' -ForegroundColor Green; npx hardhat node"
) -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "[2/3] Khoi dong FastAPI Backend (port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ProjectRoot\backend'; Write-Host 'FASTAPI BACKEND STARTING...' -ForegroundColor Blue; python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "[3/3] Khoi dong Vite Frontend (port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ProjectRoot\frontend'; Write-Host 'VITE FRONTEND STARTING...' -ForegroundColor Magenta; npm run dev"
) -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Tat ca dich vu dang khoi dong!" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Hardhat Node  : http://127.0.0.1:8545" -ForegroundColor White
Write-Host "   FastAPI Docs  : http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "   Web UI        : http://127.0.0.1:5173" -ForegroundColor White
Write-Host ""
Write-Host "   Tai khoan demo:" -ForegroundColor Yellow
Write-Host "   Admin   : admin@eduvault.edu.vn / admin123456" -ForegroundColor Yellow
Write-Host "   SV      : sv01@eduvault.edu.vn  / student123" -ForegroundColor Yellow
Write-Host ""
Write-Host "De dung tat ca: Dong 3 cua so PowerShell vua mo." -ForegroundColor Gray
Write-Host ""
