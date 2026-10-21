"""Виртуальная карта подростка: выпуск, заморозка, заказ пластика."""
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import check_family_access, get_current_user, require_child
from app.models import User
from app.services.virtual_card_service import VirtualCardResponse, VirtualCardService

router = APIRouter()


class IssueRequest(BaseModel):
    holder: Optional[str] = None


class StatusRequest(BaseModel):
    status: Literal["active", "frozen"]


class TransferRequest(BaseModel):
    direction: Literal["to_card", "to_account"]
    amount_cents: int


class PlasticRequest(BaseModel):
    method: Literal["pickup", "delivery"]
    address: Optional[str] = None


def _own(child: User, child_id: int) -> None:
    if child.id != child_id:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Нет доступа к профилю другого пользователя"},
        )


@router.get("/children/{child_id}/virtual-card", response_model=VirtualCardResponse)
async def get_virtual_card(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    child = await check_family_access(child_id, current_user, db)
    return await VirtualCardService.get(child, current_user, db)


@router.post("/children/{child_id}/virtual-card", response_model=VirtualCardResponse)
async def issue_virtual_card(
    child_id: int,
    body: IssueRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    _own(child, child_id)
    return await VirtualCardService.issue(child, body.holder, db)


@router.post("/children/{child_id}/virtual-card/status", response_model=VirtualCardResponse)
async def set_virtual_card_status(
    child_id: int,
    body: StatusRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Заморозить или разморозить может сам ребёнок и родитель."""
    child = await check_family_access(child_id, current_user, db)
    return await VirtualCardService.set_status(child, current_user, body.status, db)


@router.post("/children/{child_id}/virtual-card/plastic", response_model=VirtualCardResponse)
async def order_plastic(
    child_id: int,
    body: PlasticRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    _own(child, child_id)
    return await VirtualCardService.order_plastic(child, body.method, body.address, db)


@router.post("/children/{child_id}/virtual-card/transfer", response_model=VirtualCardResponse)
async def transfer_virtual_card(
    child_id: int,
    body: TransferRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    """Перевод со счёта на виртуальную карту и обратно (только сам ребёнок)."""
    _own(child, child_id)
    return await VirtualCardService.transfer(child, body.direction, body.amount_cents, db)
