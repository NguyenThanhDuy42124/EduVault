"""
Module: backend.app.schemas.user
Mục đích: Định nghĩa các Schema Pydantic cho người dùng (tạo mới, phản hồi, đăng nhập).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from backend.app.models.user import UserRole


class UserBase(BaseModel):
    """Schema cơ sở chứa các thuộc tính chung của người dùng."""
    student_staff_id: str = Field(..., min_length=3, max_length=50, description="Mã số sinh viên hoặc mã cán bộ duy nhất")
    full_name: str = Field(..., min_length=2, max_length=150, description="Họ và tên đầy đủ")
    email: EmailStr = Field(..., description="Địa chỉ email hợp lệ")
    role: UserRole = Field(default=UserRole.BORROWER, description="Vai trò: ADMIN hoặc BORROWER")
    wallet_address: Optional[str] = Field(None, max_length=42, description="Địa chỉ ví EVM (nếu có)")


class UserCreate(UserBase):
    """Schema dữ liệu khi tạo người dùng mới."""
    password: str = Field(..., min_length=6, max_length=100, description="Mật khẩu khởi tạo tối thiểu 6 ký tự")


class UserLoginRequest(BaseModel):
    """Schema dữ liệu yêu cầu đăng nhập từ phía client."""
    identifier: str = Field(..., description="Email hoặc Mã số sinh viên/cán bộ")
    password: str = Field(..., description="Mật khẩu người dùng")


class UserResponse(UserBase):
    """Schema dữ liệu phản hồi thông tin người dùng (không chứa password_hash)."""
    id: int = Field(..., description="Khóa chính người dùng")
    is_active: bool = Field(..., description="Trạng thái tài khoản đang kích hoạt")
    failed_login_count: int = Field(..., description="Số lần đăng nhập sai liên tiếp")
    locked_until: Optional[datetime] = Field(None, description="Thời điểm tài khoản hết bị khóa")
    created_at: datetime = Field(..., description="Thời điểm tạo tài khoản")
    updated_at: datetime = Field(..., description="Thời điểm cập nhật gần nhất")

    model_config = ConfigDict(from_attributes=True)

