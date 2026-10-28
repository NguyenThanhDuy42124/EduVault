"""
Module: backend.app.api.deps
Mục đích: Cung cấp các Dependency Injection cho FastAPI (CSDL session, xác thực token, phân quyền RBAC).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import Any, Callable, Dict, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.app.core.security import decode_access_token
from backend.app.db.session import get_db
from backend.app.models.user import User, UserRole
from backend.app.services.user_service import get_user_by_id

# OAuth2 Scheme trỏ về đường dẫn endpoint token cho Swagger UI
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token",
    auto_error=True
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Mục đích: Giải mã Bearer token từ Header và truy vấn thông tin người dùng đang thực hiện request.
    Tham số:
        - token (str): Chuỗi Bearer token tự động trích xuất từ Header Authorization.
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
    Trả về:
        - User: Đối tượng User tương ứng với token hợp lệ.
    Lỗi:
        - HTTPException(401 Unauthorized): Khi token không hợp lệ, hết hạn hoặc không tìm thấy user tương ứng.
        - HTTPException(403 Forbidden): Khi tài khoản bị vô hiệu hóa.
    Tác dụng phụ:
        - Thực thi truy vấn SELECT vào bảng `users`.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload: Optional[Dict[str, Any]] = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id: int = int(user_id_str)
    except ValueError:
        raise credentials_exception

    user: Optional[User] = get_user_by_id(db, user_id=user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khóa hoặc ngừng hoạt động."
        )

    return user


def require_role(allowed_roles: List[UserRole]) -> Callable[[User], User]:
    """
    Mục đích: Factory function sinh ra Dependency kiểm tra phân quyền người dùng (Role-Based Access Control).
    Tham số:
        - allowed_roles (List[UserRole]): Danh sách các vai trò được phép truy cập endpoint.
    Trả về:
        - Callable[[User], User]: Hàm dependency kiểm tra vai trò của `current_user`.
    Lỗi:
        - HTTPException(403 Forbidden): Khi vai trò của người dùng không nằm trong danh sách cho phép.
    Tác dụng phụ:
        - Không.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Quyền truy cập bị từ chối. Yêu cầu một trong các quyền: {[r.value for r in allowed_roles]}."
            )
        return current_user

    return role_checker
