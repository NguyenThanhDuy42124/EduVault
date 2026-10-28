import enum
from sqlalchemy import Column, Integer, String, Text, Numeric, Enum, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class EquipmentStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    IN_USE = "IN_USE"
    MAINTENANCE = "MAINTENANCE"
    RETIRED = "RETIRED"


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    serial_number = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    specifications = Column(Text, nullable=True)
    status = Column(Enum(EquipmentStatus), nullable=False, default=EquipmentStatus.AVAILABLE, index=True)
    deposit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    lending_requests = relationship("LendingRequest", back_populates="equipment")

    def __repr__(self) -> str:
        return f"<Equipment id={self.id} serial='{self.serial_number}' status='{self.status}'>"

