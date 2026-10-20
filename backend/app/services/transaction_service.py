"""Бизнес-логика истории транзакций и подтверждения покупок."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Account,
    AccountStatus,
    Transaction,
    TransactionDirection,
    TransactionStatus,
    User,
    UserRole,
)
from app.schemas.transaction import (
    PendingPurchaseItem,
    PendingPurchasesResponse,
    PurchaseDecisionResponse,
    TransactionItem,
    TransactionsResponse,
)


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

    @staticmethod
    async def list_pending_purchases(user: User, db: AsyncSession) -> PendingPurchasesResponse:
        stmt = (
            select(Transaction, User)
            .join(Account, Account.id == Transaction.account_id)
            .join(User, User.id == Account.owner_id)
            .where(
                Transaction.status == TransactionStatus.PENDING,
                Transaction.direction == TransactionDirection.OUT,
            )
        )
        if user.role == UserRole.PARENT:
            stmt = stmt.where(User.family_id == user.family_id)
        else:
            stmt = stmt.where(User.id == user.id)
        stmt = stmt.order_by(Transaction.created_at.desc())

        rows = (await db.execute(stmt)).all()
        return PendingPurchasesResponse(
            items=[
                PendingPurchaseItem(
                    id=tx.id,
                    amount_cents=tx.amount_cents,
                    direction=tx.direction.value,
                    category=tx.category,
                    merchant=tx.merchant,
                    status=tx.status.value,
                    decline_reason=tx.decline_reason,
                    created_at=tx.created_at,
                    child_id=child.id,
                    child_name=child.name,
                )
                for tx, child in rows
            ]
        )

    @staticmethod
    async def approve_purchase(parent: User, tx_id: int, db: AsyncSession) -> PurchaseDecisionResponse:
        tx, account, child = await TransactionService._get_parent_scoped_purchase(
            parent=parent, tx_id=tx_id, db=db
        )
        if tx.status != TransactionStatus.PENDING:
            raise HTTPException(
                status_code=409,
                detail={"error": "conflict", "message": "Операция уже обработана"},
            )

        if account.status == AccountStatus.BLOCKED:
            tx.status = TransactionStatus.DECLINED
            tx.decline_reason = "card_blocked"
            await db.flush()
            return PurchaseDecisionResponse(
                id=tx.id,
                status=tx.status.value,
                balance_cents=account.balance_cents,
                message="Карта заблокирована, покупка отклонена",
            )

        if account.balance_cents < tx.amount_cents:
            tx.status = TransactionStatus.DECLINED
            tx.decline_reason = "insufficient_funds"
            await db.flush()
            return PurchaseDecisionResponse(
                id=tx.id,
                status=tx.status.value,
                balance_cents=account.balance_cents,
                message="На карте не хватает денег, покупка отклонена",
            )

        account.balance_cents -= tx.amount_cents
        tx.status = TransactionStatus.APPROVED
        await TransactionService._award_cashback(child=child, tx=tx, db=db)
        await db.flush()
        return PurchaseDecisionResponse(
            id=tx.id,
            status=tx.status.value,
            balance_cents=account.balance_cents,
            message="Покупка подтверждена",
        )

    @staticmethod
    async def decline_purchase(parent: User, tx_id: int, db: AsyncSession) -> PurchaseDecisionResponse:
        tx, account, _ = await TransactionService._get_parent_scoped_purchase(
            parent=parent, tx_id=tx_id, db=db
        )
        if tx.status != TransactionStatus.PENDING:
            raise HTTPException(
                status_code=409,
                detail={"error": "conflict", "message": "Операция уже обработана"},
            )
        tx.status = TransactionStatus.DECLINED
        await db.flush()
        return PurchaseDecisionResponse(
            id=tx.id,
            status=tx.status.value,
            balance_cents=account.balance_cents,
            message="Покупка отклонена родителем",
        )

    @staticmethod
    async def _award_cashback(child: User, tx: Transaction, db: AsyncSession) -> None:
        from app.services.loyalty_service import cashback_points

        child.points += cashback_points(tx.category, tx.amount_cents)

    @staticmethod
    async def _get_parent_scoped_purchase(
        parent: User, tx_id: int, db: AsyncSession
    ) -> tuple[Transaction, Account, User]:
        result = await db.execute(
            select(Transaction, Account, User)
            .join(Account, Account.id == Transaction.account_id)
            .join(User, User.id == Account.owner_id)
            .where(Transaction.id == tx_id)
        )
        row = result.first()
        if row is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Операция не найдена"})
        tx, account, child = row
        if parent.role != UserRole.PARENT or child.family_id != parent.family_id:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Нет доступа"})
        return tx, account, child
