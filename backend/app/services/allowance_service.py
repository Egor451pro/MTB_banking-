"""Карманные деньги: настройка и демо-выплата."""
from datetime import datetime, timedelta

import pytz
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Account,
    Allowance,
    Transaction,
    TransactionDirection,
    TransactionStatus,
)
from app.schemas.allowance import AllowanceResponse, PutAllowanceRequest, PayAllowanceResponse


class AllowanceService:
    @staticmethod
    def next_date(period: str, active: bool) -> str | None:
        if not active:
            return None
        minsk = pytz.timezone("Europe/Minsk")
        today = datetime.now(minsk).date()
        day = today + timedelta(days=1)
        if period == "week":
            while day.weekday() != 0:  # ближайший понедельник
                day += timedelta(days=1)
        return day.isoformat()

    @staticmethod
    def _to_response(row: Allowance | None) -> AllowanceResponse:
        if row is None:
            return AllowanceResponse(amount_cents=0, period="week", active=False, next_date=None)
        return AllowanceResponse(
            amount_cents=row.amount_cents,
            period=row.period,  # type: ignore[arg-type]
            active=row.active,
            next_date=AllowanceService.next_date(row.period, row.active),
        )

    @staticmethod
    async def _get_row(child_id: int, db: AsyncSession) -> Allowance | None:
        result = await db.execute(select(Allowance).where(Allowance.child_id == child_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_allowance(child_id: int, db: AsyncSession) -> AllowanceResponse:
        return AllowanceService._to_response(await AllowanceService._get_row(child_id, db))

    @staticmethod
    async def put_allowance(child_id: int, request: PutAllowanceRequest, db: AsyncSession) -> AllowanceResponse:
        if request.active and request.amount_cents <= 0:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Укажите сумму карманных денег"},
            )
        row = await AllowanceService._get_row(child_id, db)
        if row is None:
            row = Allowance(child_id=child_id)
            db.add(row)
        row.amount_cents = request.amount_cents
        row.period = request.period
        row.active = request.active
        await db.flush()
        return AllowanceService._to_response(row)

    @staticmethod
    async def pay_allowance(child_id: int, db: AsyncSession) -> PayAllowanceResponse:
        row = await AllowanceService._get_row(child_id, db)
        if row is None or not row.active or row.amount_cents <= 0:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Карманные деньги не настроены"},
            )
        result = await db.execute(select(Account).where(Account.owner_id == child_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})

        account.balance_cents += row.amount_cents
        db.add(
            Transaction(
                account_id=account.id,
                amount_cents=row.amount_cents,
                direction=TransactionDirection.IN,
                category=None,
                merchant="Карманные деньги",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
            )
        )
        await db.flush()
        return PayAllowanceResponse(balance_cents=account.balance_cents)
