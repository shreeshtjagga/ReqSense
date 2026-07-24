import pytest
import uuid
from app.models.project import Project
from app.models.organization import Organization
from app.models.change_request import ChangeRequest
from sqlalchemy import select

from app.services.auth_service import create_access_token

@pytest.mark.asyncio
async def test_create_change_request_with_fallback(client, dev_a, project_a):
    """Test creating a change request via API with automatic fallback analysis."""
    token, _ = create_access_token(dev_a)
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "project_id": str(project_a.id),
        "title": "Add multi-factor authentication",
        "description": "System should require MFA code via SMS or Authenticator App.",
        "affected_features": ["Login", "Authentication"],
        "severity": "medium"
    }

    response = await client.post("/api/v1/change-requests", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Add multi-factor authentication"
    assert data["status"] == "pending"
    assert data["project_id"] == str(project_a.id)
