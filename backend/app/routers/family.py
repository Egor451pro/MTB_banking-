"""
Роутеры для семьи
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.db import get_db
from app.deps import require_parent
from app.models import User
from app.schemas.family import CreatePackageRequest, CreatePackageResponse, FamilyResponse
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


@router.post("/family/package", response_model=CreatePackageResponse, status_code=201)
async def create_family_package(
    request: CreatePackageRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await FamilyService.create_package(parent=parent, request=request, db=db)
