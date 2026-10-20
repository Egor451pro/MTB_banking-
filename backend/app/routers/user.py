"""
Роутеры для пользователей и детей
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.db import get_db
from app.deps import get_current_user, check_family_access, require_parent
from app.models import AccountStatus, User
from app.schemas.allowance import AllowanceResponse, PayAllowanceResponse, PutAllowanceRequest
from app.schemas.permission import PermissionsListResponse, PutPermissionsRequest
from app.schemas.user import (
    CardReissueResponse,
    CardStatusResponse,
    ChildProfileResponse,
    MeResponse,
    TopupRequest,
    TopupResponse,
)
from app.services.allowance_service import AllowanceService
from app.services.card_service import CardService
from app.services.permission_service import PermissionService
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


@router.post("/children/{child_id}/topup", response_model=TopupResponse)
async def topup_child(
    child_id: int,
    request: TopupRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    """POST /children/{id}/topup — пополнить карту ребёнка. Только родитель своей семьи."""
    await check_family_access(child_id, parent, db)
    return await CardService.topup(child_id=child_id, amount_cents=request.amount_cents, db=db)


@router.post("/cards/{card_id}/block", response_model=CardStatusResponse)
async def block_card(
    card_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    """POST /cards/{id}/block — заблокировать карту. Только родитель своей семьи."""
    return await CardService.set_status(parent=parent, card_id=card_id, status=AccountStatus.BLOCKED, db=db)


@router.post("/cards/{card_id}/unblock", response_model=CardStatusResponse)
async def unblock_card(
    card_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    """POST /cards/{id}/unblock — разблокировать карту. Только родитель своей семьи."""
    return await CardService.set_status(parent=parent, card_id=card_id, status=AccountStatus.ACTIVE, db=db)


@router.post("/cards/{card_id}/reissue", response_model=CardReissueResponse)
async def reissue_card(
    card_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await CardService.reissue(parent=parent, card_id=card_id, db=db)


@router.get("/children/{child_id}/permissions", response_model=PermissionsListResponse)
async def get_permissions(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    child = await check_family_access(child_id, current_user, db)
    return await PermissionService.list_permissions(child=child, db=db)


@router.put("/children/{child_id}/permissions", response_model=PermissionsListResponse)
async def put_permissions(
    child_id: int,
    request: PutPermissionsRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    child = await check_family_access(child_id, parent, db)
    return await PermissionService.put_permissions(child=child, items=request.items, db=db)


@router.get("/children/{child_id}/allowance", response_model=AllowanceResponse)
async def get_allowance(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await check_family_access(child_id, current_user, db)
    return await AllowanceService.get_allowance(child_id=child_id, db=db)


@router.put("/children/{child_id}/allowance", response_model=AllowanceResponse)
async def put_allowance(
    child_id: int,
    request: PutAllowanceRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    await check_family_access(child_id, parent, db)
    return await AllowanceService.put_allowance(child_id=child_id, request=request, db=db)


@router.post("/children/{child_id}/allowance/pay", response_model=PayAllowanceResponse)
async def pay_allowance(
    child_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    await check_family_access(child_id, parent, db)
    return await AllowanceService.pay_allowance(child_id=child_id, db=db)
