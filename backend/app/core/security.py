"""
Module: backend.app.core.security
Mục đích: Cung cấp các tiện ích mật mã, băm mật khẩu bằng Bcrypt và xử lý JSON Web Token (JWT).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
import bcrypt
from jose import JWTError, jwt
from backend.app.core.config import settings

# Hằng số bảo mật hệ thống
MAX_FAILED_LOGIN_ATTEMPTS: int = 5
ACCOUNT_LOCKOUT_MINUTES: int = 15


def hash_password(plain_password: str) -> str:
    """
    Mục đích: Băm mật khẩu dạng văn bản thuần sang chuỗi mã hóa an toàn sử dụng thuật toán Bcrypt.
    Tham số:
        - plain_password (str): Mật khẩu gốc chưa mã hóa, tối đa 72 bytes theo giới hạn Bcrypt.
    Trả về:
        - str: Chuỗi mật khẩu đã băm kèm salt ngẫu nhiên.
    Lỗi:
        - Không phát sinh lỗi ngoại lệ ngoài luồng (chuỗi quá 72 bytes sẽ tự động cắt an toàn).
    Tác dụng phụ:
        - Không ghi CSDL hay thay đổi trạng thái bên ngoài.
    """
    password_bytes: bytes = plain_password.encode("utf-8")[:72]
    salt: bytes = bcrypt.gensalt()
    hashed_bytes: bytes = bcrypt.hashpw(password_bytes, salt)
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Mục đích: So khớp mật khẩu dạng văn bản thuần với chuỗi hash Bcrypt đã lưu trong CSDL.
    Tham số:
        - plain_password (str): Mật khẩu văn bản thuần người dùng nhập vào.
        - hashed_password (str): Chuỗi hash Bcrypt đã lưu trong CSDL.
    Trả về:
        - bool: True nếu mật khẩu trùng khớp, False nếu không trùng khớp hoặc lỗi định dạng hash.
    Lỗi:
        - Không làm sập chương trình nếu hash sai định dạng (trả về False an toàn).
    Tác dụng phụ:
        - Không.
    """
    try:
        password_bytes: bytes = plain_password.encode("utf-8")[:72]
        hash_bytes: bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(
    subject: Union[str, int],
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Mục đích: Sinh JWT Access Token có thời hạn sử dụng thuật toán ký HS256.
    Tham số:
        - subject (Union[str, int]): Định danh người dùng (thường là User ID).
        - role (str): Vai trò người dùng trong hệ thống (ADMIN hoặc BORROWER).
        - expires_delta (Optional[timedelta]): Thời gian hết hạn tùy chỉnh (nếu None sẽ dùng cấu hình mặc định).
    Trả về:
        - str: Chuỗi JWT token hoàn chỉnh gồm header, payload và signature.
    Lỗi:
        - Có thể ném lỗi nếu cấu hình JWT_SECRET_KEY không hợp lệ.
    Tác dụng phụ:
        - Không.
    """
    now_utc: datetime = datetime.now(timezone.utc)
    if expires_delta is not None:
        expire_time: datetime = now_utc + expires_delta
    else:
        expire_time = now_utc + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    claims: Dict[str, Any] = {
        "sub": str(subject),
        "role": str(role),
        "iat": int(now_utc.timestamp()),
        "exp": int(expire_time.timestamp()),
    }

    encoded_jwt: str = jwt.encode(
        claims,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Mục đích: Giải mã và xác thực tính hợp lệ của JWT token.
    Tham số:
        - token (str): Chuỗi JWT token cần kiểm tra.
    Trả về:
        - Optional[Dict[str, Any]]: Dictionary chứa payload của token nếu hợp lệ, None nếu hết hạn hoặc bị giả mạo.
    Lỗi:
        - Bắt toàn bộ lỗi JWTError để tránh ném ngoại lệ không kiểm soát ra ngoài tầng gọi.
    Tác dụng phụ:
        - Không.
    """
    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None

