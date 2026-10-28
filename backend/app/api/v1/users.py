"""
Module: backend.app.api.v1.users
Mục đích: Router quản lý thông tin người dùng và API quản trị tài khoản (Admin).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.api.deps import get_current_user, require_role
from backend.app.db.session import get_db
from backend.app.models.user import User, UserRole
from backend.app.schemas.user import UserCreate, UserResponse
from backend.app.services.user_service import create_user, get_users

router = APIRouter(tags=["Users"])


@router.get(
    "/users/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Lấy thông tin tài khoản hiện tại",
    description="Trả về thông tin chi tiết của người dùng đang đăng nhập dựa trên JWT token."
)
def read_current_user(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Mục đích: Lấy hồ sơ tài khoản cá nhân của người dùng đang gửi request.
    Tham số:
        - current_user (User): Thực thể User được giải mã và truy vấn tự động qua Bearer Token.
    Trả về:
        - UserResponse: DTO thông tin người dùng hợp lệ.
    Lỗi:
        - 401 Unauthorized nếu token không hợp lệ hoặc thiếu Header.
    Tác dụng phụ:
        - Không.
    """
    return current_user


@router.post(
    "/admin/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin tạo tài khoản mới",
    description="Dành riêng cho ADMIN tạo tài khoản mới cho sinh viên hoặc cán bộ quản lý khác."
)
def admin_create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> UserResponse:
    """
    Mục đích: Cho phép quản trị viên thêm mới một người dùng vào hệ thống.
    Tham số:
        - user_in (UserCreate): DTO chứa thông tin người dùng cần tạo.
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên thực hiện thao tác (xác thực qua require_role).
    Trả về:
        - UserResponse: DTO thông tin tài khoản vừa được tạo thành công.
    Lỗi:
        - 403 Forbidden: Khi người gọi không phải ADMIN.
        - 409 Conflict: Khi email hoặc student_staff_id đã tồn tại.
    Tác dụng phụ:
        - Thêm một bản ghi mới vào bảng `users` trong MySQL.
    """
    return create_user(db=db, user_in=user_in)


@router.get(
    "/admin/users",
    response_model=List[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Admin xem danh sách người dùng",
    description="Dành riêng cho ADMIN xem danh sách tài khoản, hỗ trợ phân trang và lọc theo vai trò."
)
def admin_list_users(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=500, description="Số lượng bản ghi tối đa"),
    role: Optional[UserRole] = Query(None, description="Lọc theo vai trò ADMIN hoặc BORROWER"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> List[UserResponse]:
    """
    Mục đích: Cho phép quản trị viên truy vấn danh sách toàn bộ người dùng có bộ lọc.
    Tham số:
        - skip (int): Vị trí bắt đầu lấy bản ghi.
        - limit (int): Số lượng bản ghi tối đa trả về trong một trang.
        - role (Optional[UserRole]): Tiêu chí lọc theo vai trò.
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên thực hiện thao tác.
    Trả về:
        - List[UserResponse]: Danh sách các DTO người dùng tương ứng.
    Lỗi:
        - 403 Forbidden: Khi người gọi không phải ADMIN.
    Tác dụng phụ:
        - Thực thi truy vấn SELECT.
    """
    return get_users(db=db, skip=skip, limit=limit, role=role)

