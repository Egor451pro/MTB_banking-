"""
Роутеры для семьи
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.db import get_db
from app.deps import require_parent
from app.models import User
from app.schemas.family import FamilyResponse
from app.services.family_service import FamilyService

router = APIRouter()


@router.get("/family", response_model=FamilyResponse)
async def get_family(
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db)
):
    """
    GET /family
    Возвращает информацию о семье и детях.
    Доступ: только родитель.
    """
    return await FamilyService.get_family(parent, db)
