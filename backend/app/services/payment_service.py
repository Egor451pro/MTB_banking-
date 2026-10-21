"""Бизнес-логика симуляции оплат."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Account,
    AccountStatus,
    Limit,
    LimitPeriod,
    Transaction,
    TransactionDirection,
    TransactionStatus,
    User,
)
from app.schemas.payment import SimulatePaymentRequest, SimulatePaymentResponse
from app.services.user_service import UserService

CATEGORY_LABEL = {
    "food": "Еда",
    "transport": "Транспорт",
    "games": "Игры",
    "subscriptions": "Подписки",
    "shopping": "Покупки",
    "entertainment": "Развлечения",
    "education": "Образование",
    "adult18": "18+",
}


class PaymentService:
    @staticmethod
    async def _get_account(card_id: int, db: AsyncSession) -> Account:
        result = await db.execute(select(Account).where(Account.id == card_id))
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})
        return account

    @staticmethod
    async def _get_limits(child_id: int, db: AsyncSession) -> list[Limit]:
        result = await db.execute(select(Limit).where(Limit.child_id == child_id))
        return result.scalars().all()

    @staticmethod
    async def simulate_payment(child: User, request: SimulatePaymentRequest, db: AsyncSession) -> SimulatePaymentResponse:
        account = await PaymentService._get_account(request.card_id, db)
        if account.owner_id != child.id:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Это не ваша карта"})

        limits = await PaymentService._get_limits(child.id, db)

        # 1) card_blocked
        if account.status == AccountStatus.BLOCKED:
            return await PaymentService._save_and_response(
                db=db,
                account=account,
                amount_cents=request.amount_cents,
                category=request.category,
                merchant=request.merchant,
                is_online=request.is_online,
                status=TransactionStatus.DECLINED,
                decline_reason="card_blocked",
                message="Карта заблокирована родителем",
            )

        # 2) category_blocked
        category_blocked = request.category == "adult18" or any(
            item.category == request.category and item.is_blocked for item in limits
        )
        if category_blocked:
            message = (
                "Категория 18+ запрещена банком"
                if request.category == "adult18"
                else f"Родитель запретил категорию «{CATEGORY_LABEL[request.category]}»"
            )
            return await PaymentService._save_and_response(
                db=db,
                account=account,
                amount_cents=request.amount_cents,
                category=request.category,
                merchant=request.merchant,
                is_online=request.is_online,
                status=TransactionStatus.DECLINED,
                decline_reason="category_blocked",
                message=message,
            )

        # 3) online_not_allowed — право online_payments в consents, с учётом возрастного замка
        from app.services.permission_service import PermissionService

        if request.is_online and not await PermissionService.is_enabled(db, child, "online_payments"):
            return await PaymentService._save_and_response(
                db=db,
                account=account,
                amount_cents=request.amount_cents,
                category=request.category,
                merchant=request.merchant,
                is_online=request.is_online,
                status=TransactionStatus.DECLINED,
                decline_reason="online_not_allowed",
                message="Онлайн-покупки пока недоступны",
            )

        # 4) insufficient_funds
        if account.balance_cents < request.amount_cents:
            return await PaymentService._save_and_response(
                db=db,
                account=account,
                amount_cents=request.amount_cents,
                category=request.category,
                merchant=request.merchant,
                is_online=request.is_online,
                status=TransactionStatus.DECLINED,
                decline_reason="insufficient_funds",
                message="На карте не хватает денег",
            )

        # 5) limit_exceeded
        general_limit = next(
            (
                item
                for item in limits
                if item.category is None and item.period == LimitPeriod.DAY and not item.is_blocked
            ),
            None,
        )
        if general_limit is not None:
            spent_today = await UserService.calculate_spent_today_cents(db=db, account_id=account.id)
            today_limit = general_limit.amount_cents + await UserService.extra_limit_today_cents(db, account.owner_id)
            if spent_today + request.amount_cents > today_limit:
                return await PaymentService._save_and_response(
                    db=db,
                    account=account,
                    amount_cents=request.amount_cents,
                    category=request.category,
                    merchant=request.merchant,
                    is_online=request.is_online,
                    status=TransactionStatus.DECLINED,
                    decline_reason="limit_exceeded",
                    message="Превышен дневной лимит",
                )

        category_limit = next(
            (
                item
                for item in limits
                if item.category == request.category
                and item.period == LimitPeriod.DAY
                and not item.is_blocked
                and item.amount_cents > 0
            ),
            None,
        )
        if category_limit is not None:
            category_spent = await UserService.calculate_spent_today_cents(
                db=db, account_id=account.id, category=request.category
            )
            if category_spent + request.amount_cents > category_limit.amount_cents:
                return await PaymentService._save_and_response(
                    db=db,
                    account=account,
                    amount_cents=request.amount_cents,
                    category=request.category,
                    merchant=request.merchant,
                    is_online=request.is_online,
                    status=TransactionStatus.DECLINED,
                    decline_reason="limit_exceeded",
                    message=f"Превышен лимит по категории «{CATEGORY_LABEL[request.category]}»",
                )

        # 6) pending (крупный онлайн)
        if request.is_online and request.amount_cents > 2000:
            return await PaymentService._save_and_response(
                db=db,
                account=account,
                amount_cents=request.amount_cents,
                category=request.category,
                merchant=request.merchant,
                is_online=request.is_online,
                status=TransactionStatus.PENDING,
                decline_reason=None,
                message="Покупка ждёт подтверждения родителя",
            )

        # 7) approved
        account.balance_cents -= request.amount_cents
        from app.services.loyalty_service import cashback_points

        child.points += cashback_points(request.category, request.amount_cents)
        return await PaymentService._save_and_response(
            db=db,
            account=account,
            amount_cents=request.amount_cents,
            category=request.category,
            merchant=request.merchant,
            is_online=request.is_online,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
            message="Оплата прошла",
        )

    @staticmethod
    async def _save_and_response(
        db: AsyncSession,
        account: Account,
        amount_cents: int,
        category: str,
        merchant: str,
        is_online: bool,
        status: TransactionStatus,
        decline_reason: str | None,
        message: str,
    ) -> SimulatePaymentResponse:
        tx = Transaction(
            account_id=account.id,
            amount_cents=amount_cents,
            direction=TransactionDirection.OUT,
            category=category,
            merchant=merchant,
            is_online=is_online,
            status=status,
            decline_reason=decline_reason,
        )
        db.add(tx)
        await db.flush()
        return SimulatePaymentResponse(
            transaction_id=tx.id,
            status=status.value,
            decline_reason=decline_reason,
            balance_cents=account.balance_cents,
            message=message,
        )
