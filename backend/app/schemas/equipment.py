"""
Module: backend.app.schemas.equipment
Mục đích: Định nghĩa các Schema Pydantic cho quản lý thiết bị học tập.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.equipment import EquipmentStatus


class EquipmentBase(BaseModel):
    """Schema cơ sở định nghĩa các trường thông tin của thiết bị."""
    serial_number: str = Field(..., min_length=3, max_length=100, description="Mã số định danh / Serial duy nhất của thiết bị")
    name: str = Field(..., min_length=2, max_length=200, description="Tên thiết bị (ví dụ: Laptop Dell XPS 15)")
    category: str = Field(..., min_length=2, max_length=100, description="Danh mục thiết bị (LAPTOP, PROJECTOR, TABLET,...)")
    specifications: Optional[str] = Field(None, description="Thông số kỹ thuật chi tiết của thiết bị")
    status: EquipmentStatus = Field(default=EquipmentStatus.AVAILABLE, description="Trạng thái hiện tại của thiết bị")
    deposit_amount: Decimal = Field(default=Decimal("0.00"), ge=0, description="Mức tiền cọc quy định (VND hoặc đơn vị tiền tệ mô phỏng)")
    image_url: Optional[str] = Field(None, max_length=500, description="Đường dẫn ảnh minh họa của thiết bị")


class EquipmentCreate(EquipmentBase):
    """Schema dữ liệu đầu vào khi thêm thiết bị mới vào kho."""
    pass


class EquipmentUpdate(BaseModel):
    """Schema dữ liệu khi cập nhật thông tin thiết bị (tất cả các trường đều là tùy chọn)."""
    name: Optional[str] = Field(None, min_length=2, max_length=200, description="Tên thiết bị mới")
    category: Optional[str] = Field(None, min_length=2, max_length=100, description="Danh mục mới")
    specifications: Optional[str] = Field(None, description="Thông số kỹ thuật cập nhật")
    status: Optional[EquipmentStatus] = Field(None, description="Trạng thái mới")
    deposit_amount: Optional[Decimal] = Field(None, ge=0, description="Tiền cọc cập nhật")
    image_url: Optional[str] = Field(None, max_length=500, description="URL ảnh mới")


class EquipmentResponse(EquipmentBase):
    """Schema phản hồi thông tin thiết bị hoàn chỉnh cho phía client."""
    id: int = Field(..., description="Khóa chính ID thiết bị")
    created_at: datetime = Field(..., description="Thời điểm khởi tạo bản ghi")
    updated_at: datetime = Field(..., description="Thời điểm cập nhật gần nhất")

    model_config = ConfigDict(from_attributes=True)

