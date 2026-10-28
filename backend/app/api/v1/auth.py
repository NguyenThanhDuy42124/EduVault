"""
Module: backend.app.api.v1.auth
Mục đích: Router xử lý các yêu cầu đăng nhập và cấp phát JWT token.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.schemas.token import Token
from backend.app.schemas.user import UserLoginRequest
from backend.app.services.auth_service import authenticate_user, generate_user_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    summary="Đăng nhập tài khoản (JSON)",
    description="Nhận Email/Mã số và mật khẩu dạng JSON, trả về Bearer JWT token."
)
def login_json(
    login_data: UserLoginRequest,
    db: Session = Depends(get_db)
) -> Token:
    """
    Mục đích: Xử lý đăng nhập bằng JSON payload cho Client Web (React/Vite).
    Tham số:
        - login_data (UserLoginRequest): DTO chứa identifier và password.
        - db (Session): Phiên làm việc CSDL.
    Trả về:
        - Token: Chuỗi access token và thông tin vai trò người dùng.
    Lỗi:
        - HTTPException 401: Sai mật khẩu hoặc tài khoản không tồn tại.
        - HTTPException 423: Tài khoản bị khóa do brute-force.
    Tác dụng phụ:
        - Cập nhật số lần đăng nhập sai / reset bộ đếm trong CSDL.
    """
    user: User = authenticate_user(
        db=db,
        identifier=login_data.identifier,
        password=login_data.password
    )
    return generate_user_token(user)


@router.post(
    "/token",
    response_model=Token,
    status_code=status.HTTP_200_OK,
    summary="Đăng nhập OAuth2 Form (Swagger UI)",
    description="Tương thích chuẩn OAuth2 Password Flow phục vụ giao diện tài liệu Swagger /docs."
)
def login_oauth2_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Token:
    """
    Mục đích: Xử lý đăng nhập từ Form-data của Swagger UI Authorize.
    Tham số:
        - form_data (OAuth2PasswordRequestForm): Chứa username (identifier) và password.
        - db (Session): Phiên làm việc CSDL.
    Trả về:
        - Token: DTO chứa access_token.
    Lỗi:
        - Tương tự endpoint login_json.
    Tác dụng phụ:
        - Cập nhật số lần đăng nhập sai / reset bộ đếm trong CSDL.
    """
    user: User = authenticate_user(
        db=db,
        identifier=form_data.username,
        password=form_data.password
    )
    return generate_user_token(user)

