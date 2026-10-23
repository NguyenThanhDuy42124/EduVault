from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.api.v1.health import router as health_router

app = FastAPI(
    title="Educational Equipment Lending API",
    description="Smart Contract-Based Educational Equipment Lending Management System API",
    version="1.0.0",
    debug=settings.DEBUG,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(health_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "Smart Contract-Based Educational Equipment Lending API is online",
        "docs_url": "/docs",
        "health_check": "/api/v1/health"
    }
