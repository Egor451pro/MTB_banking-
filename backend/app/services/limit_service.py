"""Бизнес-логика лимитов."""
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Limit, LimitPeriod
from app.schemas.limit import LimitItem, LimitPutItem, LimitsResponse


class LimitService:
    @staticmethod
    async def get_limits(child_id: int, db: AsyncSession) -> LimitsResponse:
        result = await db.execute(select(Limit).where(Limit.child_id == child_id).order_by(Limit.id.asc()))
        limits = result.scalars().all()
        return LimitsResponse(
            items=[
                LimitItem(
                    id=item.id,
                    category=item.category,
                    period=item.period.value,
                    amount_cents=item.amount_cents,
                    is_blocked=item.is_blocked,
                )
                for item in limits
            ]
        )

    @staticmethod
    async def replace_limits(child_id: int, items: list[LimitPutItem], db: AsyncSession) -> LimitsResponse:
        for item in items:
            if item.category == "adult18" and not item.is_blocked:
                raise HTTPException(
                    status_code=403,
                    detail={"error": "forbidden", "message": "Категорию 18+ нельзя открыть: она запрещена банком"},
                )

        await db.execute(delete(Limit).where(Limit.child_id == child_id))
        for item in items:
            db.add(
                Limit(
                    child_id=child_id,
                    category=item.category,
                    period=LimitPeriod(item.period),
                    amount_cents=item.amount_cents,
                    is_blocked=item.is_blocked,
                )
            )

        await db.flush()
        return await LimitService.get_limits(child_id=child_id, db=db)
