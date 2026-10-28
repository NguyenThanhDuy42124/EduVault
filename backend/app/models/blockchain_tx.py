import enum
from sqlalchemy import Column, Integer, BigInteger, String, Text, Enum, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class TxActionType(str, enum.Enum):
    CREATE_LOAN = "CREATE_LOAN"
    APPROVE_LOAN = "APPROVE_LOAN"
    REJECT_LOAN = "REJECT_LOAN"
    HANDOVER = "HANDOVER"
    RETURN_LOAN = "RETURN_LOAN"
    CANCEL_LOAN = "CANCEL_LOAN"


class TxStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    request_id = Column(Integer, ForeignKey("lending_requests.id", ondelete="SET NULL"), nullable=True, index=True)
    tx_hash = Column(String(66), nullable=False, unique=True, index=True)
    action_type = Column(Enum(TxActionType), nullable=False)
    from_address = Column(String(42), nullable=False)
    to_address = Column(String(42), nullable=False)
    block_number = Column(BigInteger, nullable=True)
    gas_used = Column(Integer, nullable=True)
    status = Column(Enum(TxStatus), nullable=False, default=TxStatus.PENDING, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    request = relationship("LendingRequest", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<BlockchainTransaction id={self.id} hash='{self.tx_hash}' status='{self.status}'>"

