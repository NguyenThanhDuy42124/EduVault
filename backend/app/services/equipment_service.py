"""
Module: backend.app.services.equipment_service
Mục đích: Xử lý nghiệp vụ quản lý thiết bị học tập và cơ chế khóa dòng MySQL Pessimistic Locking chống đặt trùng.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.schemas.equipment import EquipmentCreate, EquipmentUpdate


def get_equipment_by_id(db: Session, equipment_id: int) -> Optional[Equipment]:
    """
    Mục đích: Truy vấn thông tin thiết bị theo khóa chính ID.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
        - equipment_id (int): Khóa chính ID thiết bị.
    Trả về:
        - Optional[Equipment]: Đối tượng Equipment nếu tìm thấy, ngược lại None.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Thực thi truy vấn SELECT đơn thuần.
    """
    return db.query(Equipment).filter(Equipment.id == equipment_id).first()


def get_equipment_by_serial(db: Session, serial_number: str) -> Optional[Equipment]:
    """
    Mục đích: Tìm kiếm thiết bị theo mã số serial duy nhất.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
        - serial_number (str): Mã serial cần kiểm tra.
    Trả về:
        - Optional[Equipment]: Đối tượng Equipment hoặc None nếu không tồn tại.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Thực thi truy vấn SELECT.
    """
    return db.query(Equipment).filter(
        Equipment.serial_number == serial_number.strip()
    ).first()


def get_equipment_list(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    status_filter: Optional[EquipmentStatus] = None,
    search_keyword: Optional[str] = None
) -> List[Equipment]:
    """
    Mục đích: Lấy danh sách thiết bị hỗ trợ phân trang, lọc theo danh mục, trạng thái và tìm kiếm theo tên/serial.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
        - skip (int): Số bản ghi bỏ qua (mặc định 0).
        - limit (int): Số lượng bản ghi tối đa trả về (mặc định 100).
        - category (Optional[str]): Danh mục cần lọc (ví dụ: LAPTOP, PROJECTOR).
        - status_filter (Optional[EquipmentStatus]): Trạng thái thiết bị (AVAILABLE, IN_USE,...).
        - search_keyword (Optional[str]): Từ khóa tìm kiếm theo tên hoặc mã serial.
    Trả về:
        - List[Equipment]: Danh sách các thiết bị thỏa mãn điều kiện.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Thực thi truy vấn SELECT.
    """
    query = db.query(Equipment)

    if category is not None and category.strip():
        query = query.filter(Equipment.category == category.strip().upper())

    if status_filter is not None:
        query = query.filter(Equipment.status == status_filter)

    if search_keyword is not None and search_keyword.strip():
        like_pattern: str = f"%{search_keyword.strip()}%"
        query = query.filter(
            (Equipment.name.ilike(like_pattern)) | (Equipment.serial_number.ilike(like_pattern))
        )

    return query.order_by(Equipment.id.asc()).offset(skip).limit(limit).all()


def create_equipment(db: Session, equipment_in: EquipmentCreate) -> Equipment:
    """
    Mục đích: Kiểm tra trùng mã serial và lưu thiết bị mới vào kho CSDL MySQL.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
        - equipment_in (EquipmentCreate): DTO chứa dữ liệu thiết bị cần tạo.
    Trả về:
        - Equipment: Thực thể thiết bị vừa được thêm thành công.
    Lỗi:
        - HTTPException(409 Conflict): Nếu mã serial_number đã tồn tại trong kho.
    Tác dụng phụ:
        - Thêm mới 1 bản ghi vào bảng `equipment` trong MySQL (INSERT + COMMIT).
    """
    existing_equipment = get_equipment_by_serial(db, equipment_in.serial_number)
    if existing_equipment is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Thiết bị với số Serial '{equipment_in.serial_number}' đã tồn tại trong hệ thống."
        )

    new_equipment = Equipment(
        serial_number=equipment_in.serial_number.strip(),
        name=equipment_in.name.strip(),
        category=equipment_in.category.strip().upper(),
        specifications=equipment_in.specifications.strip() if equipment_in.specifications else None,
        status=equipment_in.status,
        deposit_amount=equipment_in.deposit_amount,
        image_url=equipment_in.image_url.strip() if equipment_in.image_url else None
    )

    db.add(new_equipment)
    db.commit()
    db.refresh(new_equipment)
    return new_equipment


def update_equipment(
    db: Session,
    equipment_id: int,
    equipment_in: EquipmentUpdate
) -> Equipment:
    """
    Mục đích: Cập nhật thông tin chi tiết hoặc trạng thái của một thiết bị hiện có.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
        - equipment_id (int): Khóa chính ID thiết bị cần sửa.
        - equipment_in (EquipmentUpdate): DTO chứa các trường cập nhật.
    Trả về:
        - Equipment: Thực thể thiết bị sau khi cập nhật.
    Lỗi:
        - HTTPException(404 Not Found): Nếu không tìm thấy thiết bị có ID tương ứng.
    Tác dụng phụ:
        - Cập nhật dòng dữ liệu tương ứng trong bảng `equipment` (UPDATE + COMMIT).
    """
    equipment = get_equipment_by_id(db, equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy thiết bị với ID #{equipment_id}."
        )

    update_data = equipment_in.model_dump(exclude_unset=True)
    for field_name, new_value in update_data.items():
        if field_name == "category" and isinstance(new_value, str):
            setattr(equipment, field_name, new_value.strip().upper())
        elif isinstance(new_value, str):
            setattr(equipment, field_name, new_value.strip())
        else:
            setattr(equipment, field_name, new_value)

    db.commit()
    db.refresh(equipment)
    return equipment


def delete_equipment(db: Session, equipment_id: int) -> Equipment:
    """
    Mục đích: Thu hồi/ngừng lưu hành thiết bị (chuyển trạng thái sang RETIRED để bảo tồn nhật ký kiểm toán).
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy.
        - equipment_id (int): Khóa chính ID thiết bị cần thu hồi.
    Trả về:
        - Equipment: Thực thể thiết bị đã chuyển trạng thái RETIRED.
    Lỗi:
        - HTTPException(404 Not Found): Nếu không tìm thấy thiết bị.
        - HTTPException(400 Bad Request): Nếu thiết bị đang trong trạng thái IN_USE (đang có người mượn).
    Tác dụng phụ:
        - Cập nhật cột `status` thành RETIRED trong MySQL.
    """
    equipment = get_equipment_by_id(db, equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy thiết bị với ID #{equipment_id}."
        )

    if equipment.status == EquipmentStatus.IN_USE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể thu hồi thiết bị đang được sinh viên mượn sử dụng (IN_USE)."
        )

    equipment.status = EquipmentStatus.RETIRED
    db.commit()
    db.refresh(equipment)
    return equipment


def get_equipment_for_update(db: Session, equipment_id: int) -> Equipment:
    """
    Mục đích: Khóa bi quan (Pessimistic Lock - SELECT FOR UPDATE) dòng thiết bị trong transaction hiện tại,
             đảm bảo chống tranh chấp mượn máy (Race Condition & Double-Booking) khi nhiều sinh viên cùng mượn.
    Tham số:
        - db (Session): Phiên làm việc CSDL SQLAlchemy (đang trong transaction).
        - equipment_id (int): Khóa chính ID thiết bị cần giữ khóa.
    Trả về:
        - Equipment: Thực thể thiết bị đã bị khóa dòng và đảm bảo đang ở trạng thái AVAILABLE.
    Lỗi:
        - HTTPException(404 Not Found): Khi thiết bị không tồn tại trong hệ thống.
        - HTTPException(409 Conflict): Khi thiết bị đã bị người khác đặt trước hoặc đang sử dụng (status != AVAILABLE).
    Tác dụng phụ:
        - Áp đặt độc quyền khóa dòng (Exclusive Row Lock) trên MySQL InnoDB cho tới khi transaction hiện tại COMMIT hoặc ROLLBACK.
    """
    equipment = db.query(Equipment).filter(
        Equipment.id == equipment_id
    ).with_for_update().first()

    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy thiết bị với ID #{equipment_id}."
        )

    if equipment.status != EquipmentStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Thiết bị '{equipment.name}' hiện không khả dụng để mượn (trạng thái: {equipment.status.value})."
        )

    return equipment

