"""Бизнес-логика карты: пополнение, блок, разблок."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import check_family_access
from app.models import (
    Account,
    AccountStatus,
    Transaction,
    TransactionDirection,
    TransactionStatus,
    User,
)
from app.schemas.user import CardStatusResponse, TopupResponse


class CardService:
    @staticmethod
    async def topup(child_id: int, amount_cents: int, db: AsyncSession) -> TopupResponse:
        result = await db.execute(select(Account).where(Account.owner_id == child_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})

        account.balance_cents += amount_cents
        db.add(
            Transaction(
                account_id=account.id,
                amount_cents=amount_cents,
                direction=TransactionDirection.IN,
                category=None,
                merchant="Пополнение от родителя",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
            )
        )
        await db.flush()
        return TopupResponse(balance_cents=account.balance_cents)

    @staticmethod
    async def set_status(parent: User, card_id: int, status: AccountStatus, db: AsyncSession) -> CardStatusResponse:
        result = await db.execute(select(Account).where(Account.id == card_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})

        await check_family_access(account.owner_id, parent, db)
        account.status = status
        await db.flush()
        return CardStatusResponse(id=account.id, status=account.status.value)
