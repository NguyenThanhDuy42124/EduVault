from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.db.session import check_db_connection

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
def health_check():
    """System liveness health check."""
    return {
        "status": "healthy",
        "service": "eduvault-api",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }


@router.get("/db")
def health_db_check():
    """Database connectivity health check without exposing credentials."""
    db_status = check_db_connection()
    return {
        "database": db_status
    }
