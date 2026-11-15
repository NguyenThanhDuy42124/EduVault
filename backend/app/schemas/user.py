"""
Module: backend.app.schemas.user
Mục đích: Định nghĩa các Schema Pydantic cho người dùng (tạo mới, phản hồi, đăng nhập).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from web3 import Web3
from backend.app.models.user import UserRole


def _normalize_optional_wallet(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if not Web3.is_address(cleaned):
        raise ValueError("Địa chỉ ví EVM không hợp lệ (phải có dạng 0x + 40 ký tự hex).")
    return Web3.to_checksum_address(cleaned)


class UserBase(BaseModel):
    """Schema cơ sở chứa các thuộc tính chung của người dùng."""
    student_staff_id: str = Field(..., min_length=3, max_length=50, description="Mã số sinh viên hoặc mã cán bộ duy nhất")
    full_name: str = Field(..., min_length=2, max_length=150, description="Họ và tên đầy đủ")
    email: EmailStr = Field(..., description="Địa chỉ email hợp lệ")
    role: UserRole = Field(default=UserRole.BORROWER, description="Vai trò: ADMIN hoặc BORROWER")
    wallet_address: Optional[str] = Field(None, max_length=42, description="Địa chỉ ví EVM (nếu có)")

    @field_validator("wallet_address", mode="before")
    @classmethod
    def validate_wallet_address(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_optional_wallet(v)


class UserCreate(UserBase):
    """Schema dữ liệu khi tạo người dùng mới."""
    password: str = Field(..., min_length=6, max_length=100, description="Mật khẩu khởi tạo tối thiểu 6 ký tự")


class PublicRegisterRequest(BaseModel):
    """Schema dữ liệu tự đăng ký tài khoản công khai dành cho sinh viên/người mượn."""

    model_config = ConfigDict(extra="forbid")

    student_staff_id: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Mã số sinh viên duy nhất (3–50 ký tự)",
    )
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Họ và tên đầy đủ (2–150 ký tự)",
    )
    email: EmailStr = Field(..., description="Địa chỉ email hợp lệ")
    password: str = Field(
        ...,
        min_length=8,
        max_length=100,
        description="Mật khẩu tối thiểu 8 ký tự",
    )
    password_confirmation: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Nhập lại mật khẩu để xác nhận",
    )

    @field_validator("student_staff_id", mode="before")
    @classmethod
    def validate_student_staff_id(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Mã số sinh viên/cán bộ phải là chuỗi hợp lệ.")
        cleaned = value.strip()
        if not 3 <= len(cleaned) <= 50:
            raise ValueError("Mã số sinh viên/cán bộ phải có từ 3 đến 50 ký tự.")
        return cleaned

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Họ và tên phải là chuỗi hợp lệ.")
        cleaned = value.strip()
        if not 2 <= len(cleaned) <= 150:
            raise ValueError("Họ và tên phải có từ 2 đến 150 ký tự.")
        return cleaned

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @model_validator(mode="after")
    def verify_password_match(self) -> "PublicRegisterRequest":
        if self.password != self.password_confirmation:
            raise ValueError("Mật khẩu xác nhận không khớp.")
        return self


class UserLoginRequest(BaseModel):
    """Schema dữ liệu yêu cầu đăng nhập từ phía client."""
    identifier: str = Field(..., description="Email hoặc Mã số sinh viên/cán bộ")
    password: str = Field(..., description="Mật khẩu người dùng")


class WalletChallengeRequest(BaseModel):
    """Schema yêu cầu cấp mã thử thách (one-time nonce) để ký liên kết ví MetaMask."""
    wallet_address: str = Field(..., min_length=42, max_length=42, description="Địa chỉ ví EVM cần xác minh")

    @field_validator("wallet_address", mode="before")
    @classmethod
    def validate_challenge_wallet(cls, v: str) -> str:
        normalized = _normalize_optional_wallet(v)
        if not normalized:
            raise ValueError("Thiếu địa chỉ ví EVM.")
        return normalized


class WalletChallengeResponse(BaseModel):
    """Schema phản hồi thông điệp thử thách EIP-191 để sinh viên ký bằng MetaMask."""
    nonce: str = Field(..., description="Mã nonce ngẫu nhiên dùng một lần")
    message: str = Field(..., description="Thông điệp chuẩn để ký personal_sign")
    wallet_address: str = Field(..., description="Địa chỉ ví EVM đã chuẩn hóa checksum")
    expires_at: datetime = Field(..., description="Thời điểm hết hạn mã thử thách")


class WalletVerifyRequest(BaseModel):
    """Schema gửi chữ ký MetaMask (personal_sign) để xác minh quyền sở hữu ví."""
    wallet_address: str = Field(..., min_length=42, max_length=42, description="Địa chỉ ví EVM đã ký")
    signature: str = Field(..., min_length=130, max_length=200, description="Chữ ký hex EIP-191 trả về từ MetaMask")

    @field_validator("wallet_address", mode="before")
    @classmethod
    def validate_verify_wallet(cls, v: str) -> str:
        normalized = _normalize_optional_wallet(v)
        if not normalized:
            raise ValueError("Thiếu địa chỉ ví EVM.")
        return normalized


class UserResponse(UserBase):
    """Schema dữ liệu phản hồi thông tin người dùng (không chứa password_hash)."""
    id: int = Field(..., description="Khóa chính người dùng")
    wallet_verified: bool = Field(default=False, description="Đã xác minh quyền sở hữu ví bằng chữ ký EIP-191")
    wallet_linked_at: Optional[datetime] = Field(None, description="Thời điểm liên kết/xác minh ví gần nhất")
    is_active: bool = Field(..., description="Trạng thái tài khoản đang kích hoạt")
    failed_login_count: int = Field(..., description="Số lần đăng nhập sai liên tiếp")
    locked_until: Optional[datetime] = Field(None, description="Thời điểm tài khoản hết bị khóa")
    created_at: datetime = Field(..., description="Thời điểm tạo tài khoản")
    updated_at: datetime = Field(..., description="Thời điểm cập nhật gần nhất")

    model_config = ConfigDict(from_attributes=True)


class PendingBorrowerResponse(UserResponse):
    """Schema thông tin sinh viên đã xác minh ví để Admin đối chiếu/cấp BORROWER_ROLE on-chain."""
    on_chain_borrower_role: Optional[bool] = Field(
        None,
        description="Trạng thái sở hữu BORROWER_ROLE trên Smart Contract (None nếu RPC offline)"
    )

