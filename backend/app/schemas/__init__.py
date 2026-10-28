"""
Module: backend.app.schemas
Mục đích: Gom và xuất các Schema DTO của toàn bộ ứng dụng.
"""
from backend.app.schemas.token import Token, TokenPayload
from backend.app.schemas.user import UserBase, UserCreate, UserLoginRequest, UserResponse
from backend.app.schemas.equipment import (
    EquipmentBase,
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentResponse,
)
from backend.app.schemas.loan import (
    LoanCreateRequest,
    LoanReturnRequest,
    LoanCancelRequest,
    LoanResponse,
)
from backend.app.schemas.audit import (
    BlockchainTxResponse,
    AuditLogResponse,
    LoanVerificationResponse,
    ReconcileResultResponse,
)

__all__ = [
    "Token",
    "TokenPayload",
    "UserBase",
    "UserCreate",
    "UserLoginRequest",
    "UserResponse",
    "EquipmentBase",
    "EquipmentCreate",
    "EquipmentUpdate",
    "EquipmentResponse",
    "LoanCreateRequest",
    "LoanReturnRequest",
    "LoanCancelRequest",
    "LoanResponse",
    "BlockchainTxResponse",
    "AuditLogResponse",
    "LoanVerificationResponse",
    "ReconcileResultResponse",
]
