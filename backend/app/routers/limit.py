"""Роутеры для лимитов."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import check_family_access, get_current_user, require_parent
from app.models import User
from app.schemas.limit import LimitsResponse, PutLimitsRequest
from app.services.limit_service import LimitService

router = APIRouter()


@router.get("/children/{child_id}/limits", response_model=LimitsResponse)
async def get_limits(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await check_family_access(child_id, current_user, db)
    return await LimitService.get_limits(child_id=child_id, db=db)


@router.put("/children/{child_id}/limits", response_model=LimitsResponse)
async def put_limits(
    child_id: int,
    request: PutLimitsRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    await check_family_access(child_id, parent, db)
    return await LimitService.replace_limits(child_id=child_id, items=request.items, db=db)
