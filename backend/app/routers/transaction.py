"""Роутеры для транзакций."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import check_family_access, get_current_user
from app.models import User
from app.schemas.transaction import TransactionsResponse
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
