"""Projects router — full Phase 2 CRUD with scoped access."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_current_user, get_scoped_project, require_roles
from app.models.audit_log import AuditLog
from app.models.project import Project, ProjectClient
from app.models.project_invite_token import ProjectInviteToken
from app.schemas.project import (
    ProjectClientAdd,
    ProjectClientRead,
    ProjectCreate,
    ProjectInviteCreate,
    ProjectInviteRead,
    ProjectRead,
    ProjectUpdate,
)

from app.models.user import User

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        name=body.name,
        description=body.description,
        domain=body.domain,
        organization_id=body.organization_id or current_user.organization_id,
        developer_id=body.developer_id
        or (current_user.id if current_user.role == "developer" else None),
    )
    db.add(project)
    await db.flush()  # Get the project ID before commit
    db.add(AuditLog(
        user_id=current_user.id,
        action="create_project",
        entity_type="project",
        entity_id=project.id,
        metadata={"name": project.name, "domain": project.domain},
    ))
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=List[ProjectRead])
async def list_projects(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "admin":
        result = await db.execute(select(Project))
    elif current_user.role == "developer":
        result = await db.execute(
            select(Project).where(Project.developer_id == current_user.id)
        )
    else:
        # client — projects where they are invited
        result = await db.execute(
            select(Project)
            .join(ProjectClient, ProjectClient.project_id == Project.id)
            .where(ProjectClient.client_id == current_user.id)
        )
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project: Project = Depends(get_scoped_project),
):
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    body: ProjectUpdate,
    project: Project = Depends(get_scoped_project),
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(project, field, value)
    db.add(AuditLog(
        user_id=current_user.id,
        action="update_project",
        entity_type="project",
        entity_id=project.id,
        metadata={"fields_changed": list(updates.keys())},
    ))
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project: Project = Depends(get_scoped_project),
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    db.add(AuditLog(
        user_id=current_user.id,
        action="delete_project",
        entity_type="project",
        entity_id=project.id,
        metadata={"name": project.name},
    ))
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/clients", response_model=ProjectClientRead, status_code=201)
async def add_client_to_project(
    body: ProjectClientAdd,
    project: Project = Depends(get_scoped_project),
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    # Ensure the client being added exists and belongs to the same org
    from app.models.user import User
    client_res = await db.execute(select(User).where(User.id == body.client_id))
    client_user = client_res.scalar_one_or_none()
    if not client_user or (current_user.role != "admin" and client_user.organization_id != current_user.organization_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client_id or client belongs to a different organization."
        )
    if client_user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That user is not a client account. Each email has one role — use a separate client email.",
        )

    # Check if client is already invited
    existing_res = await db.execute(
        select(ProjectClient).where(
            ProjectClient.project_id == project.id,
            ProjectClient.client_id == body.client_id
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client is already added to this project."
        )

    pc = ProjectClient(project_id=project.id, client_id=body.client_id)
    db.add(pc)
    await db.commit()
    await db.refresh(pc)

    # Queue invite email via Celery task
    from app.services.notification_service import send_project_invite_email
    from app.config import get_settings
    settings = get_settings()
    send_project_invite_email(
        to_email=client_user.email,
        project_name=project.name,
        invite_url=f"{settings.FRONTEND_URL}/projects/{project.id}"
    )

    return pc


@router.delete("/{project_id}/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_client_from_project(
    client_id: uuid.UUID,
    project: Project = Depends(get_scoped_project),
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectClient).where(
            ProjectClient.project_id == project.id,
            ProjectClient.client_id == client_id,
        )
    )
    pc = result.scalar_one_or_none()
    if not pc:
        raise HTTPException(status_code=404, detail="Client not on project")
    await db.delete(pc)
    await db.commit()


@router.post(
    "/{project_id}/invites",
    response_model=ProjectInviteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a one-time signup invite for a client email",
)
async def create_project_invite(
    body: ProjectInviteCreate,
    project: Project = Depends(get_scoped_project),
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    if not project.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project must belong to an organization before inviting clients.",
        )

    email = body.email.strip().lower()

    # If user already exists in this org, tell the developer to use Add Client instead
    existing = await db.execute(select(User).where(User.email == email))
    existing_user = existing.scalar_one_or_none()
    if existing_user:
        if existing_user.organization_id == project.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already registered. Use Add Client with their email lookup instead.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That email is already registered to another organization.",
        )

    token = str(uuid.uuid4())
    invite = ProjectInviteToken(
        email=email,
        project_id=project.id,
        organization_id=project.organization_id,
        role=body.role,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        used=False,
    )
    db.add(invite)
    await db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="create_project_invite",
        entity_type="project",
        entity_id=project.id,
        metadata={"email": email, "role": body.role, "invite_id": str(invite.id), "token": token},
    ))
    await db.commit()
    await db.refresh(invite)

    from app.config import get_settings
    from app.services.notification_service import send_project_invite_email
    settings = get_settings()
    invite_url = f"{settings.FRONTEND_URL}/accept-invite?token={token}"
    send_project_invite_email(
        to_email=email,
        project_name=project.name,
        invite_url=invite_url,
    )

    return invite


from pydantic import BaseModel

class AcceptInviteRequest(BaseModel):
    token: str


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/invites/accept", summary="Accept a project invite token")
async def accept_project_invite(
    body: AcceptInviteRequest,
    db: AsyncSession = Depends(get_db),
):
    token_str = body.token.strip()
    is_uuid = False
    try:
        parsed_uuid = uuid.UUID(token_str)
        is_uuid = True
    except ValueError:
        parsed_uuid = None

    if is_uuid:
        q = select(ProjectInviteToken).where(
            (ProjectInviteToken.token == token_str) | (ProjectInviteToken.id == parsed_uuid)
        )
    else:
        q = select(ProjectInviteToken).where(ProjectInviteToken.token == token_str)

    result = await db.execute(q)
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite token not found.",
        )
    if invite.used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite token has already been used.",
        )
    if _as_utc(invite.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite token has expired.",
        )

    user_res = await db.execute(select(User).where(User.email == invite.email.lower()))
    user = user_res.scalar_one_or_none()

    if user:
        pc_res = await db.execute(
            select(ProjectClient).where(
                ProjectClient.project_id == invite.project_id,
                ProjectClient.client_id == user.id,
            )
        )
        if not pc_res.scalar_one_or_none():
            db.add(ProjectClient(project_id=invite.project_id, client_id=user.id))

        invite.used = True
        invite.accepted_at = datetime.now(timezone.utc)
        await db.commit()

        return {
            "status": "accepted",
            "user_exists": True,
            "project_id": str(invite.project_id),
            "email": invite.email,
        }
    else:
        return {
            "status": "pending_registration",
            "user_exists": False,
            "project_id": str(invite.project_id),
            "email": invite.email,
            "invite_token": str(invite.token or invite.id),
        }
