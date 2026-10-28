"""
Module: backend.app.main
Mục đích: Điểm khởi chạy chính của FastAPI Application, cấu hình CORS và định tuyến API v1.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.v1.audit import router as audit_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.blockchain import router as blockchain_router
from backend.app.api.v1.equipment import router as equipment_router
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.loans import router as loans_router
from backend.app.api.v1.users import router as users_router
from backend.app.core.config import settings

app = FastAPI(
    title="EduVault API",
    description="EduVault: Smart Contract-Based Educational Equipment Lending Management System API",
    version="1.0.0",
    debug=settings.DEBUG,
)

# Cấu hình CORS Middleware cho phép kết nối từ Frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các Router nghiệp vụ phiên bản v1
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(equipment_router, prefix="/api/v1")
app.include_router(loans_router, prefix="/api/v1")
app.include_router(blockchain_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.get("/", summary="Root Health Ping")
def root():
    """
    Mục đích: Endpoint kiểm tra phản hồi cơ bản từ máy chủ gốc.
    Trả về:
        - dict: Thông tin cơ bản và đường dẫn tài liệu API.
    """
    return {
        "message": "EduVault API is online",
        "docs_url": "/docs",
        "health_check": "/api/v1/health"
    }
