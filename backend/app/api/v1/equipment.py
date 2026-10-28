"""
Module: backend.app.api.v1.equipment
Mục đích: Router xử lý các yêu cầu CRUD thiết bị học tập trong hệ thống.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from backend.app.api.deps import require_role
from backend.app.db.session import get_db
from backend.app.models.equipment import EquipmentStatus
from backend.app.models.user import User, UserRole
from backend.app.schemas.equipment import (
    EquipmentCreate,
    EquipmentResponse,
    EquipmentUpdate,
)
from backend.app.services.equipment_service import (
    create_equipment,
    delete_equipment,
    get_equipment_by_id,
    get_equipment_list,
    update_equipment,
)
from fastapi import HTTPException

router = APIRouter(prefix="/equipment", tags=["Equipment"])


@router.get(
    "",
    response_model=List[EquipmentResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh mục thiết bị học tập",
    description="Tra cứu danh mục thiết bị, hỗ trợ tìm kiếm theo từ khóa, lọc theo danh mục hoặc trạng thái."
)
def list_equipment_endpoint(
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(100, ge=1, le=500, description="Số lượng bản ghi tối đa trả về"),
    category: Optional[str] = Query(None, description="Lọc theo danh mục (LAPTOP, PROJECTOR,...)"),
    equipment_status: Optional[EquipmentStatus] = Query(None, alias="status", description="Lọc theo trạng thái"),
    search: Optional[str] = Query(None, description="Từ khóa tìm kiếm theo tên hoặc mã serial"),
    db: Session = Depends(get_db)
) -> List[EquipmentResponse]:
    """
    Mục đích: Cung cấp API công khai cho sinh viên và quản trị viên xem danh mục thiết bị.
    Tham số:
        - skip (int): Vị trí bắt đầu lấy dữ liệu phân trang.
        - limit (int): Số lượng tối đa bản ghi.
        - category (Optional[str]): Danh mục thiết bị.
        - equipment_status (Optional[EquipmentStatus]): Bộ lọc trạng thái.
        - search (Optional[str]): Chuỗi tìm kiếm.
        - db (Session): Phiên làm việc CSDL.
    Trả về:
        - List[EquipmentResponse]: Danh sách DTO thiết bị phù hợp.
    Lỗi:
        - Không.
    Tác dụng phụ:
        - Truy vấn CSDL SELECT.
    """
    return get_equipment_list(
        db=db,
        skip=skip,
        limit=limit,
        category=category,
        status_filter=equipment_status,
        search_keyword=search
    )


@router.get(
    "/{equipment_id}",
    response_model=EquipmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết thiết bị theo ID",
    description="Lấy thông tin cấu hình, tiền cọc và trạng thái hiện tại của một thiết bị cụ thể."
)
def get_equipment_detail_endpoint(
    equipment_id: int,
    db: Session = Depends(get_db)
) -> EquipmentResponse:
    """
    Mục đích: Lấy chi tiết thông tin một thiết bị học tập theo ID.
    Tham số:
        - equipment_id (int): Khóa chính ID thiết bị.
        - db (Session): Phiên làm việc CSDL.
    Trả về:
        - EquipmentResponse: DTO thiết bị tìm thấy.
    Lỗi:
        - HTTPException 404: Khi không tìm thấy thiết bị với ID truyền vào.
    Tác dụng phụ:
        - Không.
    """
    equipment = get_equipment_by_id(db, equipment_id=equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy thiết bị với ID #{equipment_id}."
        )
    return equipment


@router.post(
    "",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin thêm thiết bị mới vào kho",
    description="Chức năng dành riêng cho ADMIN đăng ký thiết bị mới vào hệ thống quản lý mượn trả."
)
def create_equipment_endpoint(
    equipment_in: EquipmentCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> EquipmentResponse:
    """
    Mục đích: Quản trị viên thêm thiết bị mới vào kho.
    Tham số:
        - equipment_in (EquipmentCreate): Dữ liệu thông tin thiết bị mới.
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên thực hiện hành động.
    Trả về:
        - EquipmentResponse: DTO thiết bị vừa tạo thành công.
    Lỗi:
        - 403 Forbidden: Khi người gọi không phải ADMIN.
        - 409 Conflict: Khi số serial thiết bị đã tồn tại.
    Tác dụng phụ:
        - Ghi mới bản ghi vào bảng `equipment` trong MySQL.
    """
    return create_equipment(db=db, equipment_in=equipment_in)


@router.put(
    "/{equipment_id}",
    response_model=EquipmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin cập nhật thông tin thiết bị",
    description="Chức năng dành riêng cho ADMIN điều chỉnh thông số, tiền cọc hoặc trạng thái bảo trì thiết bị."
)
def update_equipment_endpoint(
    equipment_id: int,
    equipment_in: EquipmentUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> EquipmentResponse:
    """
    Mục đích: Quản trị viên cập nhật thông tin hoặc chuyển trạng thái thiết bị.
    Tham số:
        - equipment_id (int): Khóa chính ID thiết bị.
        - equipment_in (EquipmentUpdate): DTO chứa các trường cần sửa đổi.
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên thực hiện hành động.
    Trả về:
        - EquipmentResponse: DTO thiết bị sau cập nhật.
    Lỗi:
        - 403 Forbidden: Khi người gọi không phải ADMIN.
        - 404 Not Found: Khi ID thiết bị không tồn tại.
    Tác dụng phụ:
        - Sửa đổi bản ghi bảng `equipment` trong MySQL.
    """
    return update_equipment(db=db, equipment_id=equipment_id, equipment_in=equipment_in)


@router.delete(
    "/{equipment_id}",
    response_model=EquipmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin thu hồi thiết bị khỏi lưu hành",
    description="Chuyển trạng thái thiết bị sang RETIRED để ngừng cho mượn nhưng vẫn giữ toàn vẹn nhật ký kiểm toán."
)
def delete_equipment_endpoint(
    equipment_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_role([UserRole.ADMIN]))
) -> EquipmentResponse:
    """
    Mục đích: Thu hồi thiết bị ngừng sử dụng.
    Tham số:
        - equipment_id (int): Khóa chính ID thiết bị.
        - db (Session): Phiên làm việc CSDL.
        - admin_user (User): Quản trị viên thực hiện hành động.
    Trả về:
        - EquipmentResponse: DTO thiết bị đã chuyển trạng thái RETIRED.
    Lỗi:
        - 400 Bad Request: Khi thiết bị đang được mượn (IN_USE).
        - 403 Forbidden: Khi người gọi không phải ADMIN.
        - 404 Not Found: Khi không tìm thấy thiết bị.
    Tác dụng phụ:
        - Cập nhật status thành RETIRED trong MySQL.
    """
    return delete_equipment(db=db, equipment_id=equipment_id)

