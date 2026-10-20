"""
Роутеры для пользователей и детей
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.db import get_db
from app.deps import get_current_user, check_family_access
from app.models import User
from app.schemas.user import MeResponse, ChildProfileResponse
from app.services.user_service import UserService

router = APIRouter()


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)]
):
    """
    GET /me
    Возвращает информацию о текущем пользователе (родитель или ребенок).
    """
    return await UserService.get_me(current_user)


@router.get("/children/{child_id}", response_model=ChildProfileResponse)
async def get_child_profile(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    GET /children/{id}
    Возвращает полный профиль ребенка.
    Доступ: родитель своей семьи или сам ребенок.
    """
    # Проверяем доступ к ребенку
    child = await check_family_access(child_id, current_user, db)
    
    # Возвращаем профиль через сервис
    return await UserService.get_child_profile(child, db)
