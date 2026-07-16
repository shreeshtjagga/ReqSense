"""
Users router — user self-service endpoints.
Full user management (admin CRUD) is in Phase 2.
"""

from fastapi import APIRouter, Depends

from app.dependencies import CurrentUser
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)
