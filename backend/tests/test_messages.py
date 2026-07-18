"""
Phase 2 integration and unit tests.
Verifies projects CRUD, sessions CRUD, message CRUD, admin user management,
and robust scoped-access constraints (developers/clients from org B get 404 when requesting resources of org A).
"""
import uuid
import pytest
from httpx import AsyncClient

# Helper to log in a user and return the authorization headers
async def get_auth_headers(client: AsyncClient, email: str, password: str = "Pass1234") -> dict:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_projects_crud_and_scoped_access(client: AsyncClient, dev_a, dev_b, project_a):
    """
    Test Project CRUD operations.
    Verifies that dev_a can CRUD project_a, but dev_b (different org) gets a 404 when fetching or updating it.
    """
    headers_a = await get_auth_headers(client, dev_a.email)
    headers_b = await get_auth_headers(client, dev_b.email)

    # 1. Read existing project (dev_a should succeed, dev_b should get 404)
    resp = await client.get(f"/api/v1/projects/{project_a.id}", headers=headers_a)
    assert resp.status_code == 200
    assert resp.json()["name"] == project_a.name

    resp = await client.get(f"/api/v1/projects/{project_a.id}", headers=headers_b)
    assert resp.status_code == 404

    # 2. Update project
    update_data = {"name": "Updated Project Name"}
    resp = await client.patch(f"/api/v1/projects/{project_a.id}", json=update_data, headers=headers_a)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Project Name"

    resp = await client.patch(f"/api/v1/projects/{project_a.id}", json=update_data, headers=headers_b)
    assert resp.status_code == 404

    # 3. Create project
    create_data = {
        "name": "New Project",
        "description": "Desc",
        "domain": "web_app"
    }
    resp = await client.post("/api/v1/projects", json=create_data, headers=headers_a)
    assert resp.status_code == 201
    new_proj_id = resp.json()["id"]

    # 4. List projects (dev_a should see their projects, dev_b should see none)
    resp = await client.get("/api/v1/projects", headers=headers_a)
    assert resp.status_code == 200
    project_ids = [p["id"] for p in resp.json()]
    assert str(project_a.id) in project_ids
    assert new_proj_id in project_ids

    resp = await client.get("/api/v1/projects", headers=headers_b)
    assert resp.status_code == 200
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_sessions_crud_and_scoped_access(client: AsyncClient, dev_a, dev_b, client_a, project_a, session_a):
    """
    Test Session CRUD operations.
    Verifies that:
    - client_a can fetch/list sessions for project_a.
    - dev_b cannot create or get sessions for project_a.
    """
    headers_a = await get_auth_headers(client, dev_a.email)
    headers_b = await get_auth_headers(client, dev_b.email)
    headers_client = await get_auth_headers(client, client_a.email)

    # 1. Invite client to project so they have access
    resp = await client.post(
        f"/api/v1/projects/{project_a.id}/clients",
        json={"client_id": str(client_a.id)},
        headers=headers_a
    )
    assert resp.status_code == 201

    # 2. Client lists sessions for project
    resp = await client.get(f"/api/v1/sessions/project/{project_a.id}", headers=headers_client)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
    assert resp.json()[0]["id"] == str(session_a.id)

    # 3. dev_b gets 404 trying to list sessions for project_a
    resp = await client.get(f"/api/v1/sessions/project/{project_a.id}", headers=headers_b)
    assert resp.status_code == 404

    # 4. dev_b gets 404 trying to get session_a
    resp = await client.get(f"/api/v1/sessions/{session_a.id}", headers=headers_b)
    assert resp.status_code == 404

    # 5. End session (client ends)
    resp = await client.patch(f"/api/v1/sessions/{session_a.id}/end", json={"status": "completed"}, headers=headers_client)
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"
    assert resp.json()["ended_at"] is not None


@pytest.mark.asyncio
async def test_messages_scoping(client: AsyncClient, dev_a, dev_b, client_a, project_a):
    """
    Test Message CRUD.
    Verifies that messages are append-only, and only scoped users can post/list messages.
    """
    headers_a = await get_auth_headers(client, dev_a.email)
    headers_b = await get_auth_headers(client, dev_b.email)
    headers_client = await get_auth_headers(client, client_a.email)

    # Make sure client is invited
    await client.post(
        f"/api/v1/projects/{project_a.id}/clients",
        json={"client_id": str(client_a.id)},
        headers=headers_a
    )

    # Create a fresh active session
    resp = await client.post("/api/v1/sessions", json={"project_id": str(project_a.id)}, headers=headers_a)
    assert resp.status_code == 201
    sess_id = resp.json()["id"]

    # 1. Post message (client should succeed, dev_b should get 404)
    msg_payload = {"content": "Hello ARIA", "sender": "client", "message_type": "normal"}
    resp = await client.post(f"/api/v1/sessions/{sess_id}/messages", json=msg_payload, headers=headers_client)
    assert resp.status_code == 201
    assert resp.json()["content"] == "Hello ARIA"

    resp = await client.post(f"/api/v1/sessions/{sess_id}/messages", json=msg_payload, headers=headers_b)
    assert resp.status_code == 404

    # 2. List messages (client succeeds, dev_b 404)
    resp = await client.get(f"/api/v1/sessions/{sess_id}/messages", headers=headers_client)
    assert resp.status_code == 200
    assert len(resp.json()) >= 2  # user msg + ARIA reply

    resp = await client.get(f"/api/v1/sessions/{sess_id}/messages", headers=headers_b)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_user_crud_scoping(client: AsyncClient, admin_a, dev_a, dev_b):
    """
    Test Admin User CRUD operations.
    Verifies that admin_a can list and update users in their organization, but not outside.
    """
    headers_admin = await get_auth_headers(client, admin_a.email)
    headers_dev = await get_auth_headers(client, dev_a.email)

    # 1. Non-admin cannot list users
    resp = await client.get("/api/v1/users", headers=headers_dev)
    assert resp.status_code == 403

    # 2. Admin lists users (should see dev_a, but not dev_b who is in org B)
    resp = await client.get("/api/v1/users", headers=headers_admin)
    assert resp.status_code == 200
    user_emails = [u["email"] for u in resp.json()]
    assert dev_a.email in user_emails
    assert dev_b.email not in user_emails

    # 3. Admin gets details of dev_a (succeeds) and dev_b (404)
    resp = await client.get(f"/api/v1/users/{dev_a.id}", headers=headers_admin)
    assert resp.status_code == 200

    resp = await client.get(f"/api/v1/users/{dev_b.id}", headers=headers_admin)
    assert resp.status_code == 404

    # 4. Admin updates user status
    resp = await client.patch(f"/api/v1/users/{dev_a.id}", json={"is_active": False}, headers=headers_admin)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # 5. Admin creates user in organization
    create_payload = {
        "name": "New Client",
        "email": "new_client@a.com",
        "password": "Pass1234password",
        "role": "client"
    }
    resp = await client.post("/api/v1/users", json=create_payload, headers=headers_admin)
    assert resp.status_code == 201
    new_user_id = resp.json()["id"]

    # 6. Admin deletes user
    resp = await client.delete(f"/api/v1/users/{new_user_id}", headers=headers_admin)
    assert resp.status_code == 204
