"""Бизнес-логика истории транзакций."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Transaction
from app.schemas.transaction import TransactionItem, TransactionsResponse


class TransactionService:
    @staticmethod
    async def get_child_transactions(child_id: int, limit: int, db: AsyncSession) -> TransactionsResponse:
        result = await db.execute(select(Account).where(Account.owner_id == child_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})

        tx_result = await db.execute(
            select(Transaction)
            .where(Transaction.account_id == account.id)
            .order_by(Transaction.created_at.desc())
            .limit(limit)
        )
        txs = tx_result.scalars().all()
        return TransactionsResponse(
            items=[
                TransactionItem(
                    id=tx.id,
                    amount_cents=tx.amount_cents,
                    direction=tx.direction.value,
                    category=tx.category,
                    merchant=tx.merchant,
                    status=tx.status.value,
                    decline_reason=tx.decline_reason,
                    created_at=tx.created_at,
                )
                for tx in txs
            ]
        )
