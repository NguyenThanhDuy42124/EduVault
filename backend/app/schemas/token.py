"""
Module: backend.app.schemas.token
Mục đích: Định nghĩa cấu trúc dữ liệu Pydantic cho token xác thực và payload.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import Optional
from pydantic import BaseModel, Field


class Token(BaseModel):
    """Schema dữ liệu trả về khi đăng nhập thành công."""
    access_token: str = Field(..., description="Chuỗi Bearer token để xác thực các request kế tiếp")
    token_type: str = Field("bearer", description="Loại token xác thực")
    role: str = Field(..., description="Vai trò của người dùng: ADMIN hoặc BORROWER")
    user_id: int = Field(..., description="Khóa chính ID của người dùng trong hệ thống")


class TokenPayload(BaseModel):
    """Schema dữ liệu chứa bên trong payload của JWT token."""
    sub: Optional[str] = Field(None, description="Subject định danh (User ID dạng chuỗi)")
    role: Optional[str] = Field(None, description="Vai trò của người dùng")
    exp: Optional[int] = Field(None, description="Mốc thời gian hết hạn (Unix epoch)")

