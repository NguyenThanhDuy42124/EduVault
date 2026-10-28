"""
Module: backend.app.api.v1.audit
Mục đích: Router phục vụ các tác vụ kiểm toán đối soát Blockchain, lịch sử thao tác và tự phục hồi dữ liệu.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_current_user, require_role
from backend.app.db.session import get_db
from backend.app.models.audit_log import AuditLog
from backend.app.models.blockchain_tx import BlockchainTransaction, TxStatus
from backend.app.models.user import User, UserRole
from backend.app.schemas.audit import (
    AuditLogResponse,
    BlockchainTxResponse,
    LoanVerificationResponse,
    ReconcileResultResponse,
)
from backend.app.services.reconciliation_service import (
    reconcile_database_with_blockchain,
    verify_loan_integrity,
)

router = APIRouter(prefix="/audit", tags=["Audit & Reconciliation"])


@router.get(
    "/loans/{loan_id}/verify",
    response_model=LoanVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Đối soát tính toàn vẹn của một đơn mượn",
    description="So sánh chi tiết từng trường dữ liệu giữa MySQL và Smart Contract (State, Equipment ID, Mutex, Cọc)."
)
def verify_loan_endpoint(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> LoanVerificationResponse:
    """
    Mục đích: Cung cấp bằng chứng kiểm toán độc lập cho bất kỳ tài khoản đã đăng nhập nào.
    """
    result = verify_loan_integrity(db=db, loan_id=loan_id)
    return LoanVerificationResponse(**result)


@router.post(
    "/reconcile",
    response_model=ReconcileResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Kích hoạt Background Reconciliation Worker",
    description="Dành riêng cho ADMIN kích hoạt quét và tự động sửa lệch dữ liệu giữa MySQL và Blockchain."
)
def reconcile_endpoint(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> ReconcileResultResponse:
    """
    Mục đích: Quản trị viên kích hoạt đối soát và tự phục hồi sau sự cố sập server.
    """
    result = reconcile_database_with_blockchain(db=db, admin_user=admin_user)
    return ReconcileResultResponse(**result)


@router.get(
    "/transactions",
    response_model=List[BlockchainTxResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách giao dịch Blockchain",
    description="Xem toàn bộ các Transaction Hash, block number và lượng gas tiêu thụ trên mạng EVM."
)
def list_transactions_endpoint(
    status_filter: Optional[TxStatus] = Query(None, alias="status", description="Lọc theo trạng thái tx"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[BlockchainTxResponse]:
    """
    Mục đích: Lấy danh sách giao dịch blockchain phục vụ trang kiểm toán của hệ thống.
    """
    query = db.query(BlockchainTransaction)
    if status_filter is not None:
        query = query.filter(BlockchainTransaction.status == status_filter)
    return query.order_by(BlockchainTransaction.id.desc()).offset(skip).limit(limit).all()


@router.get(
    "/logs",
    response_model=List[AuditLogResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem nhật ký kiểm toán hệ thống",
    description="Dành riêng cho ADMIN theo dõi toàn bộ lịch sử thao tác nhạy cảm của người dùng và hệ thống."
)
def list_audit_logs_endpoint(
    action: Optional[str] = Query(None, description="Lọc theo mã hành động"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> List[AuditLogResponse]:
    """
    Mục đích: Quản trị viên xem nhật ký kiểm toán hệ thống.
    """
    query = db.query(AuditLog)
    if action is not None and action.strip():
        query = query.filter(AuditLog.action == action.strip())
    return query.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()

