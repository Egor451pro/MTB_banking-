"""
Зависимости для роутеров: авторизация, проверка ролей, доступа к семье
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated

from app.db import get_db
from app.models import User, UserRole


async def get_current_user(
    x_user_id: Annotated[int, Header()],
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Извлекает текущего пользователя из заголовка X-User-Id.
    Настоящей авторизации нет — это демо-режим.
    """
    result = await db.execute(select(User).where(User.id == x_user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Пользователь не найден"}
        )
    
    return user


async def require_parent(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Проверяет, что текущий пользователь — родитель"""
    if current_user.role != UserRole.PARENT:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Только для родителя"}
        )
    return current_user


async def require_child(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Проверяет, что текущий пользователь — ребенок"""
    if current_user.role != UserRole.CHILD:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Только для ребенка"}
        )
    return current_user


async def check_family_access(
    child_id: int,
    current_user: User,
    db: AsyncSession
) -> User:
    """
    Проверяет доступ к ребенку:
    - Родитель может просматривать детей из своей семьи
    - Ребенок может просматривать только себя
    Возвращает объект ребенка, если доступ разрешен.
    """
    result = await db.execute(select(User).where(User.id == child_id))
    child = result.scalar_one_or_none()
    
    if not child:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Пользователь не найден"}
        )
    
    # Родитель может смотреть детей своей семьи
    if current_user.role == UserRole.PARENT:
        if child.family_id != current_user.family_id:
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Нет доступа к этому ребенку"}
            )
    # Ребенок может смотреть только себя
    elif current_user.role == UserRole.CHILD:
        if child.id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Нет доступа к профилю другого пользователя"}
            )
    
    return child
