"""
Module: backend.app.services.auth_service
Mục đích: Xử lý nghiệp vụ xác thực đăng nhập, kiểm soát brute-force và cấp token.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.core.security import (
    ACCOUNT_LOCKOUT_MINUTES,
    MAX_FAILED_LOGIN_ATTEMPTS,
    create_access_token,
    verify_password,
)
from backend.app.models.user import User
from backend.app.schemas.token import Token
from backend.app.services.user_service import get_user_by_identifier


def authenticate_user(db: Session, identifier: str, password: str) -> User:
    """
    Mục đích: Xác thực tài khoản người dùng, kiểm tra trạng thái khóa brute-force và mật khẩu.
    Tham số:
        - db (Session): Phiên làm việc với CSDL SQLAlchemy.
        - identifier (str): Chuỗi định danh đăng nhập (Email hoặc Mã sinh viên / cán bộ).
        - password (str): Mật khẩu người dùng nhập vào.
    Trả về:
        - User: Đối tượng User hợp lệ sau khi xác thực thành công.
    Lỗi:
        - HTTPException(401 Unauthorized): Khi tài khoản không tồn tại hoặc mật khẩu sai.
        - HTTPException(403 Forbidden): Khi tài khoản bị vô hiệu hóa (is_active = False).
        - HTTPException(423 Locked): Khi tài khoản đang trong thời gian bị khóa do nhập sai quá số lần quy định.
    Tác dụng phụ:
        - Cập nhật cột `failed_login_count` và `locked_until` trong bảng `users` MySQL.
    """
    # 1. Tìm người dùng theo email hoặc mã số
    user: Optional[User] = get_user_by_identifier(db, identifier)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thông tin đăng nhập không chính xác.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Kiểm tra trạng thái kích hoạt tài khoản
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản này đã bị vô hiệu hóa bởi quản trị viên."
        )

    # 3. Kiểm tra khóa tạm thời do brute-force
    current_time: datetime = datetime.now()
    if user.locked_until is not None and user.locked_until > current_time:
        remaining_seconds: int = int((user.locked_until - current_time).total_seconds())
        remaining_minutes: int = max(1, (remaining_seconds + 59) // 60)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Tài khoản đang tạm khóa do nhập sai quá {MAX_FAILED_LOGIN_ATTEMPTS} lần. Vui lòng thử lại sau {remaining_minutes} phút."
        )

    # 4. Xác thực mật khẩu
    is_password_valid: bool = verify_password(password, user.password_hash)
    if not is_password_valid:
        user.failed_login_count += 1
        # Nếu đạt ngưỡng giới hạn, kích hoạt khóa tài khoản
        if user.failed_login_count >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = current_time + timedelta(minutes=ACCOUNT_LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Tài khoản đã bị tạm khóa trong {ACCOUNT_LOCKOUT_MINUTES} phút do đăng nhập thất bại {MAX_FAILED_LOGIN_ATTEMPTS} lần liên tiếp."
            )

        db.commit()
        attempts_left: int = MAX_FAILED_LOGIN_ATTEMPTS - user.failed_login_count
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Mật khẩu không chính xác. Bạn còn {attempts_left} lần thử trước khi tài khoản bị khóa.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 5. Đăng nhập thành công -> Reset toàn bộ trạng thái đếm sai
    if user.failed_login_count > 0 or user.locked_until is not None:
        user.failed_login_count = 0
        user.locked_until = None
        db.commit()

    return user


def generate_user_token(user: User) -> Token:
    """
    Mục đích: Sinh token đóng gói đầy đủ thông tin sau khi đăng nhập thành công.
    Tham số:
        - user (User): Đối tượng User đã xác thực thành công.
    Trả về:
        - Token: DTO chứa access_token, token_type, role và user_id.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Không.
    """
    access_token: str = create_access_token(
        subject=user.id,
        role=user.role.value
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=user.id
    )

