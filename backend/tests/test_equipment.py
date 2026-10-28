"""
Module: backend.tests.test_equipment
Mục đích: Bộ kiểm thử tự động cho Equipment Service, API thiết bị và cơ chế khóa Pessimistic Lock.
Áp dụng: Quy định viết code và docstring tại QUY_DINH_CODE.md.
"""
import pytest
from fastapi import HTTPException
from backend.app.models.equipment import Equipment, EquipmentStatus
from backend.app.services.equipment_service import get_equipment_for_update


@pytest.fixture(scope="function")
def sample_equipment(db_session) -> Equipment:
    """Fixture tạo một thiết bị mẫu sẵn có trong CSDL test."""
    equipment = Equipment(
        serial_number="LAPTOP-DELL-001",
        name="Dell XPS 15 9520",
        category="LAPTOP",
        specifications="Intel Core i7-12700H, 16GB RAM, 512GB SSD",
        status=EquipmentStatus.AVAILABLE,
        deposit_amount=500000.00
    )
    db_session.add(equipment)
    db_session.commit()
    db_session.refresh(equipment)
    return equipment


def test_admin_create_equipment_success(client, admin_token_headers):
    """
    Mục đích: Kiểm thử ADMIN thêm mới thiết bị vào kho thành công (201 Created).
    """
    payload = {
        "serial_number": "SONY-PROJ-01",
        "name": "Sony VPL-EX570",
        "category": "PROJECTOR",
        "specifications": "4200 Lumens, XGA 1024x768",
        "deposit_amount": 1000000.00,
        "status": "AVAILABLE"
    }
    response = client.post("/api/v1/equipment", json=payload, headers=admin_token_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["serial_number"] == "SONY-PROJ-01"
    assert data["category"] == "PROJECTOR"
    assert float(data["deposit_amount"]) == 1000000.00


def test_borrower_cannot_create_equipment_returns_403(client, borrower_token_headers):
    """
    Mục đích: Kiểm thử sinh viên (BORROWER) không có quyền thêm thiết bị mới (403 Forbidden).
    """
    payload = {
        "serial_number": "ILLEGAL-01",
        "name": "Forbidden Device",
        "category": "TABLET",
        "deposit_amount": 0
    }
    response = client.post("/api/v1/equipment", json=payload, headers=borrower_token_headers)
    assert response.status_code == 403


def test_create_equipment_duplicate_serial_returns_409(client, admin_token_headers, sample_equipment):
    """
    Mục đích: Kiểm thử hệ thống chặn tạo thiết bị trùng số serial duy nhất (409 Conflict).
    """
    payload = {
        "serial_number": sample_equipment.serial_number,
        "name": "Trùng Serial Number",
        "category": "LAPTOP",
        "deposit_amount": 200000.00
    }
    response = client.post("/api/v1/equipment", json=payload, headers=admin_token_headers)
    assert response.status_code == 409
    assert "Serial" in response.json()["detail"]


def test_list_equipment_public_access(client, sample_equipment):
    """
    Mục đích: Kiểm thử danh mục thiết bị có thể truy cập tự do không cần token.
    """
    response = client.get("/api/v1/equipment")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    assert any(i["serial_number"] == sample_equipment.serial_number for i in items)


def test_list_equipment_filter_by_category(client, sample_equipment):
    """
    Mục đích: Kiểm thử lọc danh mục thiết bị theo Category.
    """
    response = client.get("/api/v1/equipment?category=LAPTOP")
    assert response.status_code == 200
    items = response.json()
    assert all(i["category"] == "LAPTOP" for i in items)

    empty_response = client.get("/api/v1/equipment?category=NON_EXISTENT")
    assert empty_response.status_code == 200
    assert len(empty_response.json()) == 0


def test_list_equipment_search_keyword(client, sample_equipment):
    """
    Mục đích: Kiểm thử tìm kiếm thiết bị theo từ khóa trong tên hoặc serial.
    """
    response = client.get("/api/v1/equipment?search=XPS")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    assert "XPS" in items[0]["name"]


def test_get_equipment_detail_success(client, sample_equipment):
    """
    Mục đích: Kiểm thử lấy chi tiết thông tin thiết bị theo ID.
    """
    response = client.get(f"/api/v1/equipment/{sample_equipment.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sample_equipment.id
    assert data["name"] == sample_equipment.name


def test_get_equipment_detail_not_found_returns_404(client):
    """
    Mục đích: Kiểm thử truy vấn ID thiết bị không tồn tại trả về 404.
    """
    response = client.get("/api/v1/equipment/999999")
    assert response.status_code == 404


def test_admin_update_equipment_success(client, admin_token_headers, sample_equipment):
    """
    Mục đích: Kiểm thử ADMIN cập nhật thông số và chuyển trạng thái bảo trì thiết bị.
    """
    update_payload = {
        "status": "MAINTENANCE",
        "deposit_amount": 750000.00
    }
    response = client.put(
        f"/api/v1/equipment/{sample_equipment.id}",
        json=update_payload,
        headers=admin_token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "MAINTENANCE"
    assert float(data["deposit_amount"]) == 750000.00


def test_admin_delete_equipment_retires_status(client, admin_token_headers, sample_equipment):
    """
    Mục đích: Kiểm thử ADMIN thu hồi thiết bị chuyển trạng thái RETIRED an toàn.
    """
    response = client.delete(
        f"/api/v1/equipment/{sample_equipment.id}",
        headers=admin_token_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "RETIRED"


def test_pessimistic_lock_success_when_available(db_session, sample_equipment):
    """
    Mục đích: Kiểm thử hàm khóa dòng `get_equipment_for_update` thành công khi thiết bị AVAILABLE.
    """
    locked_eq = get_equipment_for_update(db_session, sample_equipment.id)
    assert locked_eq.id == sample_equipment.id
    assert locked_eq.status == EquipmentStatus.AVAILABLE


def test_pessimistic_lock_fails_when_in_use_returns_409(db_session, sample_equipment):
    """
    Mục đích: Kiểm thử hàm khóa dòng từ chối (409 Conflict) khi thiết bị đang được mượn (IN_USE).
    """
    sample_equipment.status = EquipmentStatus.IN_USE
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        get_equipment_for_update(db_session, sample_equipment.id)

    assert exc_info.value.status_code == 409
    assert "không khả dụng" in exc_info.value.detail

