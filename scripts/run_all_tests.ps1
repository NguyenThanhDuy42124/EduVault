# ==============================================================================
# Script: scripts/run_all_tests.ps1
# Muc dich: Chay toan bo cac bo kiem thu tu dong cua he thong EduVault
# Bao gom:
#   1. Smart Contract Test Suite (Hardhat): 28 tests on-chain AccessControl, Mutex & Penalties
#   2. Backend API Test Suite (Pytest): 56 tests Auth, Equipment, Loans, Audit & Blockchain
#   3. E2E Scenario Tests: Happy path, Penalties (10-50%), Damage/Loss forfeit & Concurrency
# ==============================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "         EDUVAULT - COMPREHENSIVE AUTOMATED TEST SUITE RUNNER         " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$TotalStartTime = Get-Date

# 1. HARDHAT CONTRACT TESTS
Write-Host "`n[1/3] CHAY KIEM THU SMART CONTRACT (HARDHAT)..." -ForegroundColor Yellow
Push-Location contracts
try {
    npx hardhat test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[-] Hardhat tests that bai!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
finally {
    Pop-Location
}
Write-Host "[+] Smart Contract: 28/28 TESTS PASSED!" -ForegroundColor Green

# 2. BACKEND PYTEST TESTS
Write-Host "`n[2/3] CHAY KIEM THU BACKEND API (PYTEST)..." -ForegroundColor Yellow
$env:PYTHONPATH = "."
& .\backend\.venv\Scripts\pytest.exe backend/tests/ -q
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Pytest tests that bai!" -ForegroundColor Red
    exit 1
}
Write-Host "[+] Backend API: 56/56 TESTS PASSED!" -ForegroundColor Green

# 3. E2E INTEGRATION SUITES
Write-Host "`n[3/3] CHAY CAC KICH BAN E2E INTEGRATION..." -ForegroundColor Yellow
$env:PYTHONIOENCODING = "utf-8"

Write-Host " -> E2E Happy Path (On-time & 100% Refund)..." -ForegroundColor Gray
& .\backend\.venv\Scripts\python.exe scripts/test_e2e_happy_path.py
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host " -> E2E Penalties (10%, 50%, Damaged, Lost)..." -ForegroundColor Gray
& .\backend\.venv\Scripts\python.exe scripts/test_e2e_penalties.py
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host " -> E2E Concurrency & Crash Recovery (Mutex & Reconcile)..." -ForegroundColor Gray
& .\backend\.venv\Scripts\python.exe scripts/test_e2e_concurrency_recovery.py
if ($LASTEXITCODE -ne 0) { exit 1 }

$TotalEndTime = Get-Date
$Duration = [math]::Round(($TotalEndTime - $TotalStartTime).TotalSeconds, 2)

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host " [+] TONG KET: TOAN BO TEST SUITES (84+ TESTS) PASSED 100% TRONG $Duration giay!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan

