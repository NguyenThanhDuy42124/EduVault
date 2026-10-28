"""
Module: backend.app.schemas.audit
Mục đích: Định nghĩa các Schema Pydantic cho kiểm toán đối soát Blockchain và lịch sử hệ thống.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from backend.app.models.blockchain_tx import TxActionType, TxStatus


class BlockchainTxResponse(BaseModel):
    """Schema dữ liệu phản hồi thông tin giao dịch On-chain."""
    id: int = Field(..., description="Khóa chính ID giao dịch")
    request_id: Optional[int] = Field(None, description="ID đơn mượn liên kết")
    tx_hash: str = Field(..., description="Mã băm giao dịch trên Blockchain EVM")
    action_type: TxActionType = Field(..., description="Loại thao tác on-chain")
    from_address: str = Field(..., description="Địa chỉ ví gửi (Admin Relayer)")
    to_address: str = Field(..., description="Địa chỉ Smart Contract nhận")
    block_number: Optional[int] = Field(None, description="Số hiệu block đã xác nhận")
    gas_used: Optional[int] = Field(None, description="Lượng gas tiêu thụ")
    status: TxStatus = Field(..., description="Trạng thái giao dịch: PENDING, CONFIRMED, FAILED")
    error_message: Optional[str] = Field(None, description="Chi tiết lỗi nếu thất bại")
    created_at: datetime = Field(..., description="Thời điểm ghi nhận giao dịch")

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    """Schema dữ liệu phản hồi lịch sử thao tác hệ thống."""
    id: int = Field(..., description="Khóa chính ID nhật ký")
    user_id: Optional[int] = Field(None, description="ID người dùng thực hiện")
    action: str = Field(..., description="Hành động thực hiện")
    entity_name: str = Field(..., description="Tên bảng hoặc thực thể liên quan")
    entity_id: int = Field(..., description="ID của thực thể bị tác động")
    details_json: Optional[Dict[str, Any]] = Field(None, description="Chi tiết bổ sung dạng JSON")
    created_at: datetime = Field(..., description="Thời điểm ghi nhận")

    model_config = ConfigDict(from_attributes=True)


class LoanVerificationResponse(BaseModel):
    """Schema kết quả đối soát tính toàn vẹn độc lập giữa MySQL và Smart Contract."""
    loan_id: int = Field(..., description="ID đơn mượn trong MySQL")
    on_chain_loan_id: Optional[str] = Field(None, description="Mã hash định danh trên Blockchain")
    is_synced: bool = Field(..., description="True nếu hai bên khớp dữ liệu 100%, False nếu có lệch trạng thái")
    mismatches: List[str] = Field(default_factory=list, description="Danh sách các trường bị sai lệch (nếu có)")
    mysql_state: Dict[str, Any] = Field(..., description="Dữ liệu trạng thái đọc từ MySQL")
    blockchain_state: Dict[str, Any] = Field(..., description="Dữ liệu trạng thái đọc từ Smart Contract")


class ReconcileResultResponse(BaseModel):
    """Schema kết quả chạy tiến trình tự phục hồi và đối soát dữ liệu."""
    scanned_count: int = Field(..., description="Tổng số đơn mượn được quét")
    fixed_count: int = Field(..., description="Số lượng đơn đã được tự động sửa lệch dữ liệu")
    details: List[str] = Field(default_factory=list, description="Chi tiết các điều chỉnh đã thực hiện")

