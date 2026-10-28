"""
Module: backend.tests.conftest
Mục đích: Cung cấp fixtures dùng chung cho Pytest (Test DB SQLite in-memory, TestClient, Demo Users, Equipment).
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.core.security import hash_password, create_access_token
from backend.app.db.session import Base, get_db
from backend.app.main import app
from backend.app.models.user import User, UserRole
from backend.app.models.equipment import Equipment, EquipmentStatus

# Sử dụng SQLite in-memory biệt lập cho môi trường kiểm thử
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """
    Mục đích: Khởi tạo và làm sạch schema CSDL in-memory cho từng ca kiểm thử.
    Trả về:
        - Session: Phiên làm việc SQLAlchemy biệt lập.
    """
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    Mục đích: Cung cấp TestClient của FastAPI với dependency get_db được override sang test DB.
    Trả về:
        - TestClient: Client HTTP để gửi request tới FastAPI API.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_admin_user(db_session) -> User:
    """
    Mục đích: Tạo tài khoản ADMIN mẫu sẵn sàng cho kiểm thử.
    """
    admin = User(
        student_staff_id="ADMIN001",
        full_name="Quản Trị Viên Hệ Thống",
        email="admin@eduvault.edu.vn",
        password_hash=hash_password("admin123456"),
        role=UserRole.ADMIN,
        is_active=True,
        failed_login_count=0
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture(scope="function")
def test_borrower_user(db_session) -> User:
    """
    Mục đích: Tạo tài khoản BORROWER mẫu (Sinh viên) sẵn sàng cho kiểm thử.
    """
    borrower = User(
        student_staff_id="SV2026001",
        full_name="Nguyễn Văn Sinh Viên",
        email="sinhvien@eduvault.edu.vn",
        password_hash=hash_password("student123"),
        role=UserRole.BORROWER,
        is_active=True,
        failed_login_count=0
    )
    db_session.add(borrower)
    db_session.commit()
    db_session.refresh(borrower)
    return borrower


@pytest.fixture(scope="function")
def available_equipment(db_session) -> Equipment:
    """
    Mục đích: Tạo một thiết bị khả dụng mẫu sẵn sàng cho các ca kiểm thử mượn trả.
    """
    eq = Equipment(
        serial_number="AVAILABLE-EQ-001",
        name="MacBook Pro M2 14 inch",
        category="LAPTOP",
        specifications="16GB RAM, 512GB SSD",
        status=EquipmentStatus.AVAILABLE,
        deposit_amount=1000000.00
    )
    db_session.add(eq)
    db_session.commit()
    db_session.refresh(eq)
    return eq


@pytest.fixture(scope="function")
def admin_token_headers(test_admin_user: User) -> dict:
    """
    Mục đích: Tạo HTTP Authorization Header chứa JWT Token của ADMIN.
    """
    token = create_access_token(subject=test_admin_user.id, role=test_admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def borrower_token_headers(test_borrower_user: User) -> dict:
    """
    Mục đích: Tạo HTTP Authorization Header chứa JWT Token của BORROWER.
    """
    token = create_access_token(subject=test_borrower_user.id, role=test_borrower_user.role.value)
    return {"Authorization": f"Bearer {token}"}
