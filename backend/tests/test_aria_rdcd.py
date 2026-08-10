import pytest
import uuid
from sqlalchemy import select
from app.models.project import Project
from app.models.session import Session
from app.models.requirement_atom import RequirementAtom
from app.models.message import Message
from app.models.contradiction import Contradiction
from app.services.vector_store import VectorStore
from app.services.session_memory import SessionMemory
from app.services.impact_analyser import ImpactAnalyser
from app.services.srs_generator import SRSGenerator
from app.services.rdcd_layer import RDCDLayer

@pytest.mark.asyncio
async def test_vector_store_safe_query_empty():
    """Verify VectorStore.query_similar_atoms handles empty collection/nonexistent safely."""
    proj_id = uuid.uuid4()
    results = VectorStore.query_similar_atoms(
        session_id=proj_id,
        query_embedding=[0.1] * 384,
        limit=5,
        status_filter="active"
    )
    assert results == []

@pytest.mark.asyncio
async def test_session_memory_seeding_active(test_db):
    """Verify SessionMemory.seed_from_prior_session picks up context from active prior sessions."""
    proj_id = uuid.uuid4()
    
    # Create prior active session
    prior_sess = Session(id=uuid.uuid4(), project_id=proj_id, status="active")
    test_db.add(prior_sess)
    await test_db.flush()

    # Add client message to prior session
    msg1 = Message(
        session_id=prior_sess.id,
        sender="client",
        content="The system must support order placement.",
        message_type="normal"
    )
    test_db.add(msg1)
    await test_db.flush()
    await test_db.commit()

    # Create current session
    curr_sess = Session(id=uuid.uuid4(), project_id=proj_id, status="active")
    test_db.add(curr_sess)
    await test_db.flush()
    await test_db.commit()

    # Run seed
    await SessionMemory.seed_from_prior_session(curr_sess.id, proj_id, test_db)
    
    # Retrieve messages from memory
    messages = await SessionMemory.get_messages(curr_sess.id, test_db)
    assert len(messages) >= 2
    # Verify the marker or messages carry forward
    contents = [m["content"] for m in messages]
    assert any("captured" in c.lower() for c in contents)
    assert any("order" in c.lower() for c in contents)

@pytest.mark.asyncio
async def test_impact_analyser_keyword_fallback(test_db):
    """Verify ImpactAnalyser falls back to keyword-overlap conflict checks when Chroma is empty."""
    proj_id = uuid.uuid4()
    
    # Save a requirement atom in DB that triggers mock contradiction check
    atom = RequirementAtom(
        id=uuid.uuid4(),
        project_id=proj_id,
        subject="customer",
        action="place order",
        raw_text="The customer will deliver the order.",
        status="active"
    )
    test_db.add(atom)
    await test_db.commit()

    # Check requirement conflicts with overlapping keywords (e.g. order, deliver, manager)
    conflicts = await ImpactAnalyser._check_requirement_conflicts(
        title="Order management",
        description="The manager will deliver the order.",
        project_id=proj_id,
        db=test_db
    )
    # The keyword fallback finds it and mock RDCD flags the customer vs manager contradiction
    assert len(conflicts) > 0
    assert conflicts[0]["existing_atom_id"] == atom.id
    assert conflicts[0]["conflict_type"] == "direct_contradiction"
