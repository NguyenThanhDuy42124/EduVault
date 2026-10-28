"""
Module: backend.app.services.user_service
Mục đích: Xử lý các quy tắc nghiệp vụ liên quan đến tài khoản người dùng (tạo tài khoản, truy vấn).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.core.security import hash_password
from backend.app.models.user import User, UserRole
from backend.app.schemas.user import UserCreate


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

    # 3. Băm mật khẩu an toàn
    hashed_password: str = hash_password(user_in.password)

    # 4. Khởi tạo thực thể User
    new_user = User(
        student_staff_id=user_in.student_staff_id.strip(),
        full_name=user_in.full_name.strip(),
        email=user_in.email.strip().lower(),
        password_hash=hashed_password,
        role=user_in.role,
        wallet_address=user_in.wallet_address.strip() if user_in.wallet_address else None,
        is_active=True,
        failed_login_count=0,
        locked_until=None
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

