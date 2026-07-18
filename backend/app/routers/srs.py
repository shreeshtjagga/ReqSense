import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.srs_version import SRSVersion
from app.models.user import User
from app.schemas.srs import SRSVersionRead
from app.services.storage_service import StorageService

router = APIRouter(prefix="/srs", tags=["srs"])

@router.get("/project/{project_id}/latest")
async def get_latest_srs(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the latest SRS version download URL for a project.
    """
    # Enforce scope check
    await get_scoped_project(project_id, current_user, db)

    # Query latest version
    q = (
        select(SRSVersion)
        .where(SRSVersion.project_id == project_id)
        .order_by(SRSVersion.created_at.desc())
        .limit(1)
    )
    result = await db.execute(q)
    srs = result.scalar_one_or_none()

    if not srs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No SRS document found for this project."
        )

    # Generate presigned download URL
    download_url = StorageService.get_download_url(srs.file_url)

    return {
        "id": srs.id,
        "version": srs.version,
        "download_url": download_url,
        "created_at": srs.created_at
    }


@router.get("/project/{project_id}/versions", response_model=List[SRSVersionRead])
async def list_srs_versions(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    List all SRS versions for a project.
    """
    # Enforce scope check
    await get_scoped_project(project_id, current_user, db)

    q = (
        select(SRSVersion)
        .where(SRSVersion.project_id == project_id)
        .order_by(SRSVersion.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(q)
    versions = result.scalars().all()
    return versions
