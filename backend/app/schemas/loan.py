"""
Module: backend.app.schemas.loan
Mục đích: Định nghĩa các Schema Pydantic cho vòng đời yêu cầu mượn trả thiết bị học tập.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.lending_request import DepositStatus, LoanStatus, ReturnCondition
from backend.app.schemas.equipment import EquipmentResponse
from backend.app.schemas.user import UserResponse


class LoanCreateRequest(BaseModel):
    """Schema dữ liệu khi sinh viên gửi yêu cầu mượn thiết bị."""
    equipment_id: int = Field(..., description="ID thiết bị muốn mượn")
    expected_handover_date: datetime = Field(..., description="Thời gian dự kiến nhận thiết bị")
    due_date: datetime = Field(..., description="Thời gian hạn chót trả lại thiết bị")
    admin_notes: Optional[str] = Field(None, max_length=500, description="Ghi chú mục đích mượn học tập")


class LoanReturnRequest(BaseModel):
    """Schema dữ liệu khi Admin xác nhận nhận lại thiết bị và đánh giá tình trạng."""
    return_condition: ReturnCondition = Field(default=ReturnCondition.GOOD, description="Hiện trạng thiết bị: GOOD, DAMAGED, LOST")
    manual_penalty_percent: Optional[int] = Field(None, ge=0, le=100, description="Mức phạt thủ công (nếu muốn ghi đè, mặc định để None để tự tính)")
    admin_notes: Optional[str] = Field(None, max_length=500, description="Ghi chú thẩm định hiện trạng bàn giao")


class LoanCancelRequest(BaseModel):
    """Schema dữ liệu khi người dùng hoặc Admin hủy đơn mượn."""
    reason: Optional[str] = Field("Người dùng hủy đơn", max_length=255, description="Lý do hủy đơn")


class LoanResponse(BaseModel):
    """Schema phản hồi thông tin chi tiết một đơn mượn."""
    id: int = Field(..., description="ID đơn mượn")
    user_id: int = Field(..., description="ID người mượn")
    equipment_id: int = Field(..., description="ID thiết bị")
    request_date: datetime = Field(..., description="Thời điểm gửi yêu cầu")
    expected_handover_date: datetime = Field(..., description="Thời gian dự kiến nhận")
    due_date: datetime = Field(..., description="Hạn chót trả")
    actual_handover_date: Optional[datetime] = Field(None, description="Thời gian bàn giao thực tế")
    actual_return_date: Optional[datetime] = Field(None, description="Thời gian nhận lại thực tế")
    status: LoanStatus = Field(..., description="Trạng thái đơn: PENDING, APPROVED, ACTIVE, RETURNED,...")
    return_condition: Optional[ReturnCondition] = Field(None, description="Hiện trạng khi hoàn trả")
    deposit_amount: Decimal = Field(..., description="Mức tiền cọc quy định")
    deposit_status: DepositStatus = Field(..., description="Trạng thái cọc: PENDING, LOCKED, REFUNDED, FORFEITED")
    on_chain_loan_id: Optional[str] = Field(None, description="Mã hash định danh trên Blockchain EVM")
    admin_notes: Optional[str] = Field(None, description="Ghi chú xử lý")
    is_overdue: bool = Field(False, description="Cờ xác định đơn có đang bị trễ hạn hay không (suy luận)")
    created_at: datetime = Field(..., description="Thời điểm tạo bản ghi")
    updated_at: datetime = Field(..., description="Thời điểm cập nhật gần nhất")

    # Thông tin mở rộng đính kèm
    user: Optional[UserResponse] = Field(None, description="Thông tin người mượn")
    equipment: Optional[EquipmentResponse] = Field(None, description="Thông tin thiết bị")

    model_config = ConfigDict(from_attributes=True)

