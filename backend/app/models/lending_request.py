import enum
from sqlalchemy import Column, Integer, String, Text, Numeric, Enum, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class LoanStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"
    DISPUTED = "DISPUTED"
    CANCELLED = "CANCELLED"


class ReturnCondition(str, enum.Enum):
    GOOD = "GOOD"
    DAMAGED = "DAMAGED"
    LOST = "LOST"


class DepositStatus(str, enum.Enum):
    PENDING = "PENDING"
    LOCKED = "LOCKED"
    REFUNDED = "REFUNDED"
    FORFEITED = "FORFEITED"


class LendingRequest(Base):
    __tablename__ = "lending_requests"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="RESTRICT"), nullable=False, index=True)
    request_date = Column(DateTime, server_default=func.now(), nullable=False)
    expected_handover_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime, nullable=False)
    actual_handover_date = Column(DateTime, nullable=True)
    actual_return_date = Column(DateTime, nullable=True)
    status = Column(Enum(LoanStatus), nullable=False, default=LoanStatus.PENDING, index=True)
    return_condition = Column(Enum(ReturnCondition), nullable=True)
    deposit_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    deposit_status = Column(Enum(DepositStatus), nullable=False, default=DepositStatus.PENDING)
    on_chain_loan_id = Column(String(66), nullable=True, unique=True, index=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="lending_requests")
    equipment = relationship("Equipment", back_populates="lending_requests")
    transactions = relationship("BlockchainTransaction", back_populates="request", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<LendingRequest id={self.id} user_id={self.user_id} eq_id={self.equipment_id} status='{self.status}'>"

