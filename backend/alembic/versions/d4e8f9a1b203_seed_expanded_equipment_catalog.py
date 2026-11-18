"""seed expanded equipment catalog

Revision ID: d4e8f9a1b203
Revises: c2d9e4f7a102
Create Date: 2026-11-18 15:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e8f9a1b203'
down_revision: Union[str, Sequence[str], None] = 'c2d9e4f7a102'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EXPANDED_EQUIPMENT = [
    (
        "LAPTOP-TP-003",
        "Lenovo ThinkPad X1 Carbon Gen 11",
        "LAPTOP",
        "Intel Core i7-1365U, 16GB LPDDR5, 512GB NVMe SSD, 14 inch IPS chống chói",
        850000.00,
        "/images/equipment/thinkpad-x1.jpg",
    ),
    (
        "LAPTOP-ROG-004",
        "ASUS ROG Zephyrus G14 AI",
        "LAPTOP",
        "AMD Ryzen 9 7940HS, RTX 4060 8GB, 16GB RAM, 1TB SSD - Phục vụ AI & Đồ họa",
        900000.00,
        "/images/equipment/asus-rog-g14.jpg",
    ),
    (
        "TABLET-S9-002",
        'Samsung Galaxy Tab S9 FE 10.9"',
        "TABLET",
        "Exynos 1380, RAM 6GB, ROM 128GB, Kèm bút S Pen cảm ứng thực hành",
        400000.00,
        "/images/equipment/galaxy-tab-s9.jpg",
    ),
    (
        "TABLET-AIR-003",
        'iPad Air M2 11" Wifi 256GB',
        "TABLET",
        "Chip Apple M2 8-core, Màn hình Liquid Retina 11 inch, Hỗ trợ Apple Pencil",
        450000.00,
        "/images/equipment/ipad-air.jpg",
    ),
    (
        "TABLET-PAD6-004",
        'Xiaomi Pad 6 Pro 11" 144Hz',
        "TABLET",
        "Snapdragon 8+ Gen 1, RAM 8GB, 256GB, Màn hình 2.8K kiểm thử App Mobile",
        350000.00,
        "/images/equipment/xiaomi-pad-6.jpg",
    ),
    (
        "PROJ-EPSON-002",
        "Máy Chiếu Epson EB-E01 XGA",
        "PROJECTOR",
        "Công nghệ 3LCD 3.300 Lumens, Kết nối HDMI/VGA, Kèm remote & cáp HDMI 5m",
        550000.00,
        "/images/equipment/epson-eb-e01.jpg",
    ),
    (
        "PROJ-VIEW-003",
        "Máy Chiếu ViewSonic PA503W HD",
        "PROJECTOR",
        "Độ sáng 3.800 ANSI Lumens, Độ phân giải WXGA, Thuyết trình giảng đường",
        500000.00,
        "/images/equipment/viewsonic-pa503w.jpg",
    ),
    (
        "EQ-105810",
        "Máy Chiếu 36 Chiều",
        "PROJECTOR",
        "Siêu Cấp Vip Pro",
        500000.00,
        "/images/equipment/sony-projector.jpg",
    ),
]


def upgrade() -> None:
    """Idempotently seed the 7 expanded equipment catalog items."""
    conn = op.get_bind()
    check_stmt = sa.text("SELECT id FROM equipment WHERE serial_number = :serial_number")
    insert_stmt = sa.text(
        """
        INSERT INTO equipment
            (serial_number, name, category, specifications, status, deposit_amount, image_url, created_at, updated_at)
        VALUES
            (:serial_number, :name, :category, :specifications, 'AVAILABLE', :deposit_amount, :image_url, NOW(), NOW())
        """
    )

    for serial, name, category, specs, deposit, image_url in EXPANDED_EQUIPMENT:
        existing = conn.execute(check_stmt, {"serial_number": serial}).first()
        if existing is None:
            conn.execute(
                insert_stmt,
                {
                    "serial_number": serial,
                    "name": name,
                    "category": category,
                    "specifications": specs,
                    "deposit_amount": deposit,
                    "image_url": image_url,
                },
            )


def downgrade() -> None:
    """Remove seeded expanded equipment rows if not referenced by any loan."""
    conn = op.get_bind()
    delete_stmt = sa.text(
        """
        DELETE FROM equipment
        WHERE serial_number = :serial_number
          AND NOT EXISTS (
              SELECT 1 FROM lending_requests WHERE equipment_id = equipment.id
          )
        """
    )
    for serial, *_ in EXPANDED_EQUIPMENT:
        conn.execute(delete_stmt, {"serial_number": serial})
