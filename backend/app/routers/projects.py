"""Projects router — full Phase 2 CRUD with scoped access."""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_current_user, get_scoped_project, require_roles
from app.models.project import Project, ProjectClient
from app.schemas.project import (
    ProjectClientAdd,
    ProjectClientRead,
    ProjectCreate,
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
            select(Project)
            .where(
                Project.organization_id == current_user.organization_id,
                Project.developer_id == current_user.id
            )
        )
    else:
        # client — projects where they are invited
        result = await db.execute(
            select(Project)
            .join(ProjectClient, ProjectClient.project_id == Project.id)
            .where(
                Project.organization_id == current_user.organization_id,
                ProjectClient.client_id == current_user.id
            )
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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project: Project = Depends(get_scoped_project),
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
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
