import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.feature_status import FeatureStatus
from app.models.user import User
from app.schemas.feature_status import FeatureStatusCreate, FeatureStatusRead, FeatureStatusUpdate

router = APIRouter(prefix="/feature-status", tags=["feature-status"])

@router.post("", response_model=FeatureStatusRead, status_code=status.HTTP_201_CREATED)
async def create_feature_status(
    body: FeatureStatusCreate,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new feature status.
    """
    project_id = body.project_id
    if not project_id and not body.atom_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either project_id or atom_id."
        )

    # Check access to the project
    await get_scoped_project(project_id, current_user, db)

    feature = FeatureStatus(
        project_id=project_id,
        atom_id=body.atom_id,
        title=body.title,
        description=body.description,
        status="planned",
        version=1,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    return feature


@router.get("/project/{project_id}", response_model=List[FeatureStatusRead])
async def list_features(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    List all features for a project.
    """
    await get_scoped_project(project_id, current_user, db)

    q = (
        select(FeatureStatus)
        .where(FeatureStatus.project_id == project_id)
        .order_by(FeatureStatus.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{id}", response_model=FeatureStatusRead)
async def get_feature(
    id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db)
):
    """
    Get feature status details.
    """
    feature = await db.get(FeatureStatus, id)
    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found."
        )

    await get_scoped_project(feature.project_id, current_user, db)
    return feature


@router.patch("/{id}", response_model=FeatureStatusRead)
async def update_feature_status(
    id: uuid.UUID,
    body: FeatureStatusUpdate,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db)
):
    """
    Update feature status with optimistic locking.
    """
    feature = await db.get(FeatureStatus, id)
    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found."
        )

    await get_scoped_project(feature.project_id, current_user, db)

    # Optimistic locking check
    if feature.version != body.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="STALE_VERSION"
        )

    if body.status is not None:
        feature.status = body.status
    if body.description is not None:
        feature.description = body.description

    # Increment version
    feature.version += 1
    feature.updated_by = current_user.id

    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    return feature
