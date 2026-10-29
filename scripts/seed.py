"""
Module: scripts.seed
Mục đích: Script nạp dữ liệu mẫu ban đầu (Seed Data) vào CSDL MySQL cho hệ thống EduVault.
Dữ liệu mẫu:
  - 1 Tài khoản Quản trị viên (ADMIN)
  - 3 Tài khoản Sinh viên (BORROWER)
  - 8 Thiết bị học tập đa dạng (LAPTOP, TABLET, PROJECTOR, LAB_TOOL, EMBEDDED_KIT)
  - 1 Bản ghi đơn mượn mẫu để kiểm tra dữ liệu
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

# Đảm bảo đường dẫn gốc được nạp vào sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.core.security import hash_password
from backend.app.db.session import SessionLocal
from backend.app.models.audit_log import AuditLog
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.models.lending_request import DepositStatus, LendingRequest, LoanStatus, ReturnCondition
from backend.app.models.user import User, UserRole


def seed_users(db) -> dict:
    """
    Mục đích: Nạp tài khoản Admin và 3 tài khoản sinh viên mẫu vào bảng users.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
    Trả về:
        - dict: Ánh xạ student_staff_id -> User entity đã được lưu.
    Lỗi:
        - Báo lỗi nếu CSDL không kết nối được.
    Tác dụng phụ:
        - Ghi mới bản ghi vào bảng `users`.
    """
    users_data = [
        {
            "student_staff_id": "ADMIN001",
            "full_name": "Quản Trị Viên Hệ Thống (Admin)",
            "email": "admin@eduvault.edu.vn",
            "password": "admin123456",
            "role": UserRole.ADMIN,
            "wallet_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",  # Hardhat Account #0
        },
        {
            "student_staff_id": "SV2026001",
            "full_name": "Nguyễn Văn An",
            "email": "sv01@eduvault.edu.vn",
            "password": "student123",
            "role": UserRole.BORROWER,
            "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  # Hardhat Account #1
        },
        {
            "student_staff_id": "SV2026002",
            "full_name": "Trần Thị Bình",
            "email": "sv02@eduvault.edu.vn",
            "password": "student123",
            "role": UserRole.BORROWER,
            "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",  # Hardhat Account #2
        },
        {
            "student_staff_id": "SV2026003",
            "full_name": "Lê Hoàng Cường",
            "email": "sv03@eduvault.edu.vn",
            "password": "student123",
            "role": UserRole.BORROWER,
            "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",  # Hardhat Account #3
        },
    ]

    user_map = {}
    for item in users_data:
        existing = db.query(User).filter(User.student_staff_id == item["student_staff_id"]).first()
        if existing is None:
            user = User(
                student_staff_id=item["student_staff_id"],
                full_name=item["full_name"],
                email=item["email"],
                password_hash=hash_password(item["password"]),
                role=item["role"],
                wallet_address=item["wallet_address"],
                is_active=True,
                failed_login_count=0
            )
            db.add(user)
            db.flush()
            user_map[item["student_staff_id"]] = user
            print(f" [USER CREATED] {item['role'].value:<8} | {item['student_staff_id']} | {item['full_name']} ({item['email']})")
        else:
            user_map[item["student_staff_id"]] = existing
            print(f" [USER EXISTS]  {item['role'].value:<8} | {item['student_staff_id']} | {item['full_name']}")

    db.commit()
    return user_map


def seed_equipment(db) -> dict:
    """
    Mục đích: Nạp 8 thiết bị học tập mẫu đa dạng chủng loại vào bảng equipment.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
    Trả về:
        - dict: Ánh xạ serial_number -> Equipment entity đã lưu.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Ghi mới bản ghi vào bảng `equipment`.
    """
    equipment_data = [
        {
            "serial_number": "LAPTOP-MBP-001",
            "name": "MacBook Pro 14\" M2 Pro",
            "category": "LAPTOP",
            "specifications": "Apple M2 Pro 10-core CPU, 16-core GPU, 16GB RAM, 512GB SSD Retina XDR",
            "deposit_amount": Decimal("1000000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/macbook-pro.jpg"
        },
        {
            "serial_number": "LAPTOP-DELL-002",
            "name": "Dell XPS 15 9530",
            "category": "LAPTOP",
            "specifications": "Intel Core i7-13700H, 16GB DDR5, 512GB NVMe, RTX 4050 6GB",
            "deposit_amount": Decimal("800000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/dell-xps.jpg"
        },
        {
            "serial_number": "TABLET-IPAD-001",
            "name": "iPad Pro 11\" M2 Wifi 128GB",
            "category": "TABLET",
            "specifications": "Apple M2 chip, Màn hình Liquid Retina 120Hz, kèm bút Apple Pencil 2",
            "deposit_amount": Decimal("500000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/ipad-pro.jpg"
        },
        {
            "serial_number": "PROJ-SONY-001",
            "name": "Máy Chiếu Sony VPL-EX570",
            "category": "PROJECTOR",
            "specifications": "Độ sáng 4200 Ansi Lumens, Độ phân giải XGA (1024x768), Cổng HDMI/VGA",
            "deposit_amount": Decimal("600000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/sony-projector.jpg"
        },
        {
            "serial_number": "OSC-RIGOL-001",
            "name": "Máy Đo Xung Số Rigol DS1054Z",
            "category": "LAB_TOOL",
            "specifications": "Băng thông 50MHz, 4 kênh tương tự, Tốc độ lấy mẫu 1GSa/s, Bộ nhớ 24Mpts",
            "deposit_amount": Decimal("400000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/rigol-oscilloscope.jpg"
        },
        {
            "serial_number": "MIC-ANDON-001",
            "name": "Kính Hiển Vi Kỹ Thuật Số Andonstar AD407",
            "category": "LAB_TOOL",
            "specifications": "Độ phóng đại 270X, Màn hình 7 inch gắn liền, Cổng ra HDMI 1080P FHD",
            "deposit_amount": Decimal("300000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/andonstar-microscope.jpg"
        },
        {
            "serial_number": "KIT-STM32-001",
            "name": "Kit Phát Triển STM32F407 Discovery",
            "category": "EMBEDDED_KIT",
            "specifications": "ARM Cortex-M4 168MHz, 1MB Flash, 192KB RAM, ST-LINK/V2 tích hợp sẵn",
            "deposit_amount": Decimal("200000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/stm32-kit.jpg"
        },
        {
            "serial_number": "KIT-ARDUINO-001",
            "name": "Bộ Cảm Biến Arduino IoT Starter Kit",
            "category": "EMBEDDED_KIT",
            "specifications": "Bo mạch Arduino Mega 2560, Module ESP8266 Wifi, 37 loại cảm biến học tập",
            "deposit_amount": Decimal("150000.00"),
            "status": EquipmentStatus.AVAILABLE,
            "image_url": "/images/equipment/arduino-kit.jpg"
        },
    ]

    equipment_map = {}
    for item in equipment_data:
        existing = db.query(Equipment).filter(Equipment.serial_number == item["serial_number"]).first()
        if existing is None:
            eq = Equipment(
                serial_number=item["serial_number"],
                name=item["name"],
                category=item["category"],
                specifications=item["specifications"],
                deposit_amount=item["deposit_amount"],
                status=item["status"],
                image_url=item["image_url"]
            )
            db.add(eq)
            db.flush()
            equipment_map[item["serial_number"]] = eq
            print(f" [EQUIPMENT ADDED]  {item['category']:<12} | {item['serial_number']:<16} | {item['name']}")
        else:
            existing.image_url = item["image_url"]
            existing.name = item["name"]
            existing.specifications = item["specifications"]
            existing.deposit_amount = item["deposit_amount"]
            equipment_map[item["serial_number"]] = existing
            print(f" [EQUIPMENT EXISTS] {item['category']:<12} | {item['serial_number']:<16} | {item['name']}")

    db.commit()
    return equipment_map


def seed_sample_loan(db, users, equipment) -> None:
    """
    Mục đích: Tạo 1 đơn mượn mẫu ở trạng thái PENDING để kiểm thử trực quan luồng duyệt mượn.
    Tham số:
        - db (Session): Phiên làm việc CSDL.
        - users (dict): Danh sách người dùng đã nạp.
        - equipment (dict): Danh sách thiết bị đã nạp.
    """
    student = users.get("SV2026001")
    device = equipment.get("TABLET-IPAD-001")

    if not student or not device:
        return

    existing = db.query(LendingRequest).filter(
        LendingRequest.user_id == student.id,
        LendingRequest.equipment_id == device.id
    ).first()

    if existing is None:
        now = datetime.now()
        sample_loan = LendingRequest(
            user_id=student.id,
            equipment_id=device.id,
            request_date=now - timedelta(hours=2),
            expected_handover_date=now + timedelta(days=1),
            due_date=now + timedelta(days=7),
            status=LoanStatus.PENDING,
            deposit_amount=device.deposit_amount,
            deposit_status=DepositStatus.PENDING,
            admin_notes="Đơn mượn mẫu: Sinh viên Nguyễn Văn An mượn iPad Pro làm đồ án thiết kế UI/UX"
        )
        db.add(sample_loan)
        db.flush()

        audit = AuditLog(
            user_id=student.id,
            action="LOAN_REQUEST_SUBMITTED",
            entity_name="lending_requests",
            entity_id=sample_loan.id,
            details_json={"note": "Sample seed loan"}
        )
        db.add(audit)
        db.commit()
        print(f" [SAMPLE LOAN ADDED] Đơn mượn mẫu #{sample_loan.id} (Sinh viên {student.student_staff_id} mượn {device.name})")


def main():
    """
    Mục đích: Hàm thực thi chính điều phối nạp dữ liệu mẫu ban đầu.
    """
    print("=" * 75)
    print("EduVault: TIẾN HÀNH NẠP DỮ LIỆU MẪU BAN ĐẦU (SEED DATA)")
    print("=" * 75)

    db = SessionLocal()
    try:
        print("\n--- 1. Nạp Tài khoản Người dùng (Users) ---")
        users = seed_users(db)

        print("\n--- 2. Nạp Danh mục Thiết bị (Equipment) ---")
        equipment = seed_equipment(db)

        print("\n--- 3. Khởi tạo Đơn mượn Thử nghiệm (Sample Loan) ---")
        seed_sample_loan(db, users, equipment)

        print("\n" + "=" * 75)
        print("[THÀNH CÔNG] Toàn bộ dữ liệu mẫu đã được nạp thành công vào CSDL MySQL!")
        print("Tài khoản Quản trị: admin@eduvault.edu.vn / admin123456")
        print("Tài khoản Sinh viên: sv01@eduvault.edu.vn / student123")
        print("=" * 75)
    except Exception as e:
        print(f"\n[LỖI] Quá trình nạp dữ liệu thất bại: {e}")
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    main()

