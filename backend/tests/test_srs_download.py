import pytest
import uuid
from app.models.project import Project
from app.models.organization import Organization
from app.models.session import Session
from app.services.srs_generator import SRSGenerator
from app.services.auth_service import create_access_token

@pytest.mark.asyncio
async def test_srs_download_endpoint(client, test_db, dev_a):
    """Test GET /api/v1/srs/download-file downloads the docx file."""
    # Create org, project & session
    org = Organization(id=uuid.uuid4(), name="Download Org")
    test_db.add(org)
    await test_db.commit()

    proj = Project(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Download Project",
        description="Desc"
    )
    test_db.add(proj)
    await test_db.commit()

    sess = Session(id=uuid.uuid4(), project_id=proj.id, status="completed")
    test_db.add(sess)
    await test_db.commit()

    # Generate SRS
    srs = await SRSGenerator.generate_srs(sess.id, test_db)

    # Test download endpoint
    token, _ = create_access_token(dev_a)
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get(f"/api/v1/srs/download-file?key={srs.file_url}", headers=headers)
    assert response.status_code == 200, response.text
    assert "wordprocessingml.document" in response.headers.get("content-type", "")
