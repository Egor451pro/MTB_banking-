"""Роутеры для транзакций."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import check_family_access, get_current_user, require_parent
from app.models import User
from app.schemas.transaction import (
    PendingPurchasesResponse,
    PurchaseDecisionResponse,
    TransactionsResponse,
)
from app.services.transaction_service import TransactionService

router = APIRouter()


@router.get("/children/{child_id}/transactions", response_model=TransactionsResponse)
async def get_child_transactions(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    await check_family_access(child_id=child_id, current_user=current_user, db=db)
    return await TransactionService.get_child_transactions(child_id=child_id, limit=limit, db=db)


@router.get("/purchases/pending", response_model=PendingPurchasesResponse)
async def list_pending_purchases(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    return await TransactionService.list_pending_purchases(user=current_user, db=db)


@router.post("/transactions/{tx_id}/approve", response_model=PurchaseDecisionResponse)
async def approve_purchase(
    tx_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await TransactionService.approve_purchase(parent=parent, tx_id=tx_id, db=db)


@router.post("/transactions/{tx_id}/decline", response_model=PurchaseDecisionResponse)
async def decline_purchase(
    tx_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await TransactionService.decline_purchase(parent=parent, tx_id=tx_id, db=db)
