import pytest
import uuid
from app.models.project import Project
from app.models.session import Session
from app.models.requirement_atom import RequirementAtom
from app.models.organization import Organization
from app.services.srs_generator import SRSGenerator
from app.models.srs_version import SRSVersion
from sqlalchemy import select

@pytest.mark.asyncio
async def test_srs_generation_flow(test_db):
    """Test generating an SRS document for a session with requirement atoms."""
    db_session = test_db
    # Create organization & project
    org = Organization(id=uuid.uuid4(), name="SRS Test Org")
    db_session.add(org)
    await db_session.commit()

    proj = Project(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="SRS Test Project",
        description="Test description"
    )
    db_session.add(proj)
    await db_session.commit()

    sess = Session(
        id=uuid.uuid4(),
        project_id=proj.id,
        status="completed"
    )
    db_session.add(sess)
    await db_session.commit()

    # Add requirement atoms
    atom1 = RequirementAtom(
        id=uuid.uuid4(),
        session_id=sess.id,
        project_id=proj.id,
        subject="System",
        action="MUST log all user activities for security compliance.",
        raw_text="The system must log all user activities for security compliance.",
        status="active"
    )
    db_session.add(atom1)
    await db_session.commit()

    # Run SRS generation
    srs = await SRSGenerator.generate_srs(sess.id, db_session)
    assert srs is not None
    assert srs.project_id == proj.id
    assert srs.session_id == sess.id
    assert srs.version == "1.0"
    assert srs.file_url is not None

    # Verify query in DB
    res = await db_session.execute(
        select(SRSVersion).where(SRSVersion.project_id == proj.id)
    )
    versions = res.scalars().all()
    assert len(versions) == 1
    assert versions[0].version == "1.0"


@pytest.mark.asyncio
async def test_srs_generation_with_conflicted_atoms(test_db):
    """Test generating an SRS document when conflicted atoms exist."""
    db_session = test_db
    org = Organization(id=uuid.uuid4(), name="SRS Conflict Org")
    db_session.add(org)
    await db_session.commit()

    proj = Project(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="SRS Conflict Project",
        description="Test project with conflicts"
    )
    db_session.add(proj)
    await db_session.commit()

    sess = Session(id=uuid.uuid4(), project_id=proj.id, status="completed")
    db_session.add(sess)
    await db_session.commit()

    atom_active = RequirementAtom(
        id=uuid.uuid4(),
        session_id=sess.id,
        project_id=proj.id,
        subject="Order",
        action="Customer places order",
        raw_text="The customer must place the order.",
        status="active"
    )
    atom_conflicted = RequirementAtom(
        id=uuid.uuid4(),
        session_id=sess.id,
        project_id=proj.id,
        subject="Order",
        action="Manager delivers order",
        raw_text="The manager will deliver the order.",
        status="conflicted"
    )
    db_session.add_all([atom_active, atom_conflicted])
    await db_session.commit()

    srs = await SRSGenerator.generate_srs(sess.id, db_session)
    assert srs is not None
    assert srs.version == "1.0"
