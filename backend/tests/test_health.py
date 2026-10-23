from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "eduvault-api"


def test_health_db_endpoint():
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    data = response.json()
    assert "database" in data
    assert "status" in data["database"]
