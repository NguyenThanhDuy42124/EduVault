"""
Module: backend.app.api.v1.loans
Mục đích: Router xử lý toàn bộ vòng đời mượn trả thiết bị học tập.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_current_user, require_role
from backend.app.db.session import get_db
from backend.app.models.lending_request import LoanStatus
from backend.app.models.user import User, UserRole
from backend.app.schemas.loan import (
    LoanCancelRequest,
    LoanCreateRequest,
    LoanResponse,
    LoanReturnRequest,
)
from backend.app.services.loan_service import (
    approve_loan_request,
    cancel_loan_request,
    compute_is_overdue,
    create_loan_request,
    get_loan_by_id,
    get_loans,
    handover_loan_equipment,
    reject_loan_request,
    return_loan_equipment,
)

router = APIRouter(prefix="/loans", tags=["Loans Lifecycle"])


def _to_loan_response(loan) -> LoanResponse:
    """Helper chuyển đổi LendingRequest entity sang LoanResponse kèm cờ suy luận is_overdue."""
    resp = LoanResponse.model_validate(loan)
    resp.is_overdue = compute_is_overdue(loan)
    return resp


@router.post(
    "/request",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sinh viên gửi yêu cầu mượn thiết bị",
    description="Dành riêng cho BORROWER tạo đơn mượn máy học tập mới (trạng thái khởi tạo PENDING)."
)
def request_loan_endpoint(
    loan_in: LoanCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.BORROWER, UserRole.ADMIN]))
) -> LoanResponse:
    """
    Mục đích: Tiếp nhận và xử lý yêu cầu mượn thiết bị từ người dùng.
    Tham số:
        - loan_in (LoanCreateRequest): DTO chứa ID thiết bị và khoảng thời gian mượn.
        - db (Session): Phiên làm việc CSDL.
        - current_user (User): Người dùng gửi yêu cầu.
    Trả về:
        - LoanResponse: DTO đơn mượn vừa được tạo.
    """
    loan = create_loan_request(db=db, borrower_user=current_user, loan_in=loan_in)
    return _to_loan_response(loan)


@router.get(
    "",
    response_model=List[LoanResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách đơn mượn",
    description="Sinh viên chỉ thấy đơn của chính mình; Quản trị viên ADMIN có thể xem toàn bộ hệ thống."
)
def list_loans_endpoint(
    status_filter: Optional[LoanStatus] = Query(None, alias="status", description="Lọc theo trạng thái"),
    user_id: Optional[int] = Query(None, description="Lọc theo ID người dùng (chỉ ADMIN có quyền dùng)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[LoanResponse]:
    """
    Mục đích: Trả về danh sách đơn mượn có phân quyền người dùng.
    """
    target_user_id: Optional[int] = None
    if current_user.role == UserRole.BORROWER:
        target_user_id = current_user.id
    elif current_user.role == UserRole.ADMIN and user_id is not None:
        target_user_id = user_id

    loans = get_loans(
        db=db,
        user_id=target_user_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit
    )
    return [_to_loan_response(l) for l in loans]


@router.get(
    "/{loan_id}",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết đơn mượn theo ID",
    description="Xem tiến trình, thông tin cọc và mã hash blockchain của một đơn mượn cụ thể."
)
def get_loan_detail_endpoint(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> LoanResponse:
    """
    Mục đích: Lấy thông tin chi tiết một đơn mượn.
    """
    loan = get_loan_by_id(db, loan_id=loan_id)
    if loan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn mượn #{loan_id}."
        )

    if current_user.role == UserRole.BORROWER and loan.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem đơn mượn của người khác."
        )

    return _to_loan_response(loan)


@router.post(
    "/{loan_id}/approve",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin duyệt đơn mượn",
    description="Khóa dòng MySQL (Pessimistic Lock) đổi thiết bị sang RESERVED và gửi tx createLoan + approveLoan on-chain."
)
def approve_loan_endpoint(
    loan_id: int,
    notes: Optional[str] = Body(None, embed=True, description="Ghi chú duyệt đơn"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> LoanResponse:
    """
    Mục đích: Admin duyệt yêu cầu mượn và đặt giữ chỗ thiết bị.
    """
    loan = approve_loan_request(db=db, admin_user=admin_user, loan_id=loan_id, notes=notes)
    return _to_loan_response(loan)


@router.post(
    "/{loan_id}/reject",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin từ chối đơn mượn",
    description="Từ chối yêu cầu mượn chưa được duyệt (trạng thái chuyển sang REJECTED)."
)
def reject_loan_endpoint(
    loan_id: int,
    reason: Optional[str] = Body(None, embed=True, description="Lý do từ chối"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> LoanResponse:
    """
    Mục đích: Admin từ chối đơn mượn.
    """
    loan = reject_loan_request(db=db, admin_user=admin_user, loan_id=loan_id, reason=reason)
    return _to_loan_response(loan)


@router.post(
    "/{loan_id}/handover",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin xác nhận bàn giao máy thực tế",
    description="Đổi thiết bị sang IN_USE, đơn chuyển ACTIVE và gọi Smart Contract confirmHandover để khóa cọc."
)
def handover_loan_endpoint(
    loan_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> LoanResponse:
    """
    Mục đích: Admin bàn giao thiết bị thực tế cho sinh viên.
    """
    loan = handover_loan_equipment(db=db, admin_user=admin_user, loan_id=loan_id)
    return _to_loan_response(loan)


@router.post(
    "/{loan_id}/return",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin nhận lại thiết bị và xử lý cọc/phạt",
    description="Kiểm tra tình trạng (TỐT/HỎNG/MẤT), áp dụng mức phạt on-chain, giải phóng Mutex và mở lại thiết bị."
)
def return_loan_endpoint(
    loan_id: int,
    return_in: LoanReturnRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> LoanResponse:
    """
    Mục đích: Admin nhận lại máy và kết thúc đơn mượn.
    """
    loan = return_loan_equipment(db=db, admin_user=admin_user, loan_id=loan_id, return_in=return_in)
    return _to_loan_response(loan)


@router.post(
    "/{loan_id}/cancel",
    response_model=LoanResponse,
    status_code=status.HTTP_200_OK,
    summary="Hủy đơn mượn trước khi nhận máy",
    description="Chỉ áp dụng khi đơn đang PENDING hoặc APPROVED; tự động giải phóng thiết bị và Mutex on-chain."
)
def cancel_loan_endpoint(
    loan_id: int,
    cancel_in: LoanCancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> LoanResponse:
    """
    Mục đích: Sinh viên hoặc Admin hủy đơn mượn trước khi bàn giao.
    """
    loan = cancel_loan_request(db=db, current_user=current_user, loan_id=loan_id, cancel_in=cancel_in)
    return _to_loan_response(loan)

