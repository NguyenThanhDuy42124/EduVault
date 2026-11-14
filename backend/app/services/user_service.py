"""
Module: backend.app.services.user_service
Mục đích: Xử lý các quy tắc nghiệp vụ liên quan đến tài khoản người dùng (tạo tài khoản, truy vấn).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from datetime import datetime, timedelta
import secrets
from typing import List, Optional
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from web3 import Web3
from backend.app.core.security import hash_password
from backend.app.models.audit_log import AuditLog
from backend.app.models.lending_request import LendingRequest, LoanStatus
from backend.app.models.user import User, UserRole
from backend.app.schemas.user import UserCreate

WALLET_CHALLENGE_TTL_MINUTES = 5


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """
    Mục đích: Tìm kiếm và trả về thông tin người dùng theo khóa chính (ID).
    Tham số:
        - db (Session): Phiên làm việc với CSDL SQLAlchemy.
        - user_id (int): Khóa chính ID người dùng cần tìm.
    Trả về:
        - Optional[User]: Đối tượng User nếu tồn tại, None nếu không tìm thấy.
    Lỗi:
        - Không ném ngoại lệ ngoài ý muốn.
    Tác dụng phụ:
        - Chỉ thực thi truy vấn SELECT, không sửa đổi dữ liệu.
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_identifier(db: Session, identifier: str) -> Optional[User]:
    """
    Mục đích: Tìm kiếm người dùng dựa trên email hoặc mã số sinh viên / cán bộ.
    Tham số:
        - db (Session): Phiên làm việc với CSDL SQLAlchemy.
        - identifier (str): Chuỗi định danh (có thể là email hoặc student_staff_id).
    Trả về:
        - Optional[User]: Bản ghi User tương ứng hoặc None nếu không tìm thấy.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Chỉ đọc CSDL (SELECT).
    """
    clean_identifier: str = identifier.strip()
    return db.query(User).filter(
        (User.email == clean_identifier) | (User.student_staff_id == clean_identifier)
    ).first()


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    role: Optional[UserRole] = None
) -> List[User]:
    """
    Mục đích: Lấy danh sách người dùng trong hệ thống có phân trang và lọc theo vai trò.
    Tham số:
        - db (Session): Phiên làm việc với CSDL SQLAlchemy.
        - skip (int): Số bản ghi cần bỏ qua (phục vụ phân trang, mặc định 0).
        - limit (int): Số lượng bản ghi tối đa trả về (mặc định 100).
        - role (Optional[UserRole]): Lọc theo vai trò ADMIN hoặc BORROWER (nếu có).
    Trả về:
        - List[User]: Danh sách các thực thể User phù hợp điều kiện.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Chỉ đọc CSDL (SELECT).
    """
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.order_by(User.id.asc()).offset(skip).limit(limit).all()


def create_user(db: Session, user_in: UserCreate) -> User:
    """
    Mục đích: Kiểm tra trùng lặp, băm mật khẩu và tạo tài khoản người dùng mới vào hệ thống.
    Tham số:
        - db (Session): Phiên làm việc với CSDL SQLAlchemy.
        - user_in (UserCreate): Dữ liệu đầu vào đã được Pydantic kiểm thực (email, mã số, mật khẩu,...).
    Trả về:
        - User: Thực thể User vừa được tạo thành công trong MySQL.
    Lỗi:
        - HTTPException(409 Conflict): Khi email hoặc student_staff_id đã tồn tại trên hệ thống.
    Tác dụng phụ:
        - Ghi mới 1 dòng dữ liệu vào bảng `users` trong MySQL (INSERT + COMMIT).
    """
    # 1. Kiểm tra trùng lặp email
    existing_user_by_email: Optional[User] = db.query(User).filter(User.email == user_in.email).first()
    if existing_user_by_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{user_in.email}' đã được đăng ký trong hệ thống."
        )

    # 2. Kiểm tra trùng lặp student_staff_id
    existing_user_by_id: Optional[User] = db.query(User).filter(
        User.student_staff_id == user_in.student_staff_id
    ).first()
    if existing_user_by_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Mã số '{user_in.student_staff_id}' đã tồn tại trong hệ thống."
        )

    # 3. Kiểm tra trùng lặp wallet_address nếu có cung cấp
    normalized_wallet: Optional[str] = None
    if user_in.wallet_address:
        normalized_wallet = Web3.to_checksum_address(user_in.wallet_address.strip())
        existing_wallet = (
            db.query(User)
            .filter(func.lower(User.wallet_address) == normalized_wallet.lower())
            .first()
        )
        if existing_wallet is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Địa chỉ ví '{normalized_wallet}' đã được gán cho tài khoản khác."
            )

    # 4. Băm mật khẩu an toàn
    hashed_password: str = hash_password(user_in.password)

    # 5. Khởi tạo thực thể User (ví do Admin nhập chưa được xác minh chữ ký cho tới khi chủ ví ký EIP-191)
    new_user = User(
        student_staff_id=user_in.student_staff_id.strip(),
        full_name=user_in.full_name.strip(),
        email=user_in.email.strip().lower(),
        password_hash=hashed_password,
        role=user_in.role,
        wallet_address=normalized_wallet,
        wallet_verified=False,
        is_active=True,
        failed_login_count=0,
        locked_until=None
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def _build_wallet_challenge_message(
    user: User,
    wallet_address: str,
    nonce: str,
    expires_at: datetime
) -> str:
    """
    Mục đích: Tạo thông điệp EIP-191 chuẩn hóa dùng chung giữa bước phát challenge và xác minh chữ ký.
    """
    return (
        "EduVault Equipment Lending - Xac minh quyen so huu vi\n"
        f"Account: {user.student_staff_id} (User #{user.id})\n"
        f"Wallet: {wallet_address}\n"
        f"Nonce: {nonce}\n"
        f"Expires At: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}"
    )


def create_wallet_challenge(db: Session, current_user: User, wallet_address: str) -> dict:
    """
    Mục đích: Sinh mã nonce ngẫu nhiên dùng một lần (hiệu lực 5 phút) để người dùng ký EIP-191 trên MetaMask.
    """
    checksum_wallet = Web3.to_checksum_address(wallet_address.strip())

    # Không cho phép chiếm ví đang thuộc về tài khoản khác
    existing_owner = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            func.lower(User.wallet_address) == checksum_wallet.lower()
        )
        .first()
    )
    if existing_owner is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Địa chỉ ví {checksum_wallet} đã được liên kết với một tài khoản khác."
        )

    # Chặn đổi sang ví mới nếu tài khoản đã xác minh ví cũ và còn đơn mở
    if (
        current_user.wallet_verified
        and current_user.wallet_address
        and current_user.wallet_address.lower() != checksum_wallet.lower()
    ):
        open_loans = (
            db.query(LendingRequest)
            .filter(
                LendingRequest.user_id == current_user.id,
                LendingRequest.status.in_([LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.ACTIVE])
            )
            .count()
        )
        if open_loans > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Không thể đổi sang ví khác khi vẫn còn đơn mượn đang xử lý hoặc đang mượn với ví đã liên kết."
            )

    nonce = secrets.token_hex(16)
    expires_at = datetime.now().replace(microsecond=0) + timedelta(minutes=WALLET_CHALLENGE_TTL_MINUTES)

    current_user.wallet_nonce = nonce
    current_user.wallet_nonce_expires_at = expires_at
    current_user.wallet_challenge_address = checksum_wallet
    db.commit()
    db.refresh(current_user)

    message = _build_wallet_challenge_message(
        user=current_user,
        wallet_address=checksum_wallet,
        nonce=nonce,
        expires_at=expires_at
    )
    return {
        "nonce": nonce,
        "message": message,
        "wallet_address": checksum_wallet,
        "expires_at": expires_at,
    }


def verify_wallet_signature(
    db: Session,
    current_user: User,
    wallet_address: str,
    signature: str
) -> User:
    """
    Mục đích: Xác thực chữ ký personal_sign (EIP-191), tiêu thụ one-time nonce và đánh dấu ví đã xác minh.
    """
    checksum_wallet = Web3.to_checksum_address(wallet_address.strip())

    if (
        not current_user.wallet_nonce
        or not current_user.wallet_nonce_expires_at
        or not current_user.wallet_challenge_address
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không tìm thấy mã thử thách ví hợp lệ. Vui lòng tạo yêu cầu thử thách mới."
        )

    challenge_wallet = current_user.wallet_challenge_address
    challenge_nonce = current_user.wallet_nonce
    challenge_expires = current_user.wallet_nonce_expires_at

    # Tiêu thụ one-time nonce ngay lập tức để chống replay / thử lại cùng nonce
    current_user.wallet_nonce = None
    current_user.wallet_nonce_expires_at = None
    current_user.wallet_challenge_address = None

    if datetime.now() > challenge_expires:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã thử thách (nonce) đã hết hạn. Vui lòng yêu cầu thử thách mới."
        )

    if challenge_wallet.lower() != checksum_wallet.lower():
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Địa chỉ ví xác minh không khớp với ví đã tạo thử thách."
        )

    expected_message = _build_wallet_challenge_message(
        user=current_user,
        wallet_address=checksum_wallet,
        nonce=challenge_nonce,
        expires_at=challenge_expires
    )

    try:
        signable_msg = encode_defunct(text=expected_message)
        recovered_address = Account.recover_message(signable_msg, signature=signature)
    except Exception as exc:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chữ ký MetaMask không hợp lệ: {exc}"
        ) from exc

    if recovered_address.lower() != checksum_wallet.lower():
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chữ ký không thuộc về địa chỉ ví cần xác minh."
        )

    existing_owner = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            func.lower(User.wallet_address) == checksum_wallet.lower()
        )
        .first()
    )
    if existing_owner is not None:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Địa chỉ ví {checksum_wallet} đã được liên kết với tài khoản khác."
        )

    current_user.wallet_address = checksum_wallet
    current_user.wallet_verified = True
    current_user.wallet_linked_at = datetime.now().replace(microsecond=0)

    audit_entry = AuditLog(
        user_id=current_user.id,
        action="WALLET_LINKED_VERIFIED",
        entity_name="User",
        entity_id=current_user.id,
        details_json={"wallet_address": checksum_wallet}
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(current_user)
    return current_user

