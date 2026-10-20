"""Программа лояльности: баллы, кешбэк и предложения партнёров."""
import random

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import check_family_access
from app.models import User, UserRole
from app.schemas.loyalty import CashbackItem, LoyaltyResponse, OfferItem, RedeemOfferResponse
from app.services.permission_service import PermissionService

CASHBACK: list[dict[str, object]] = [
    {"category": "education", "percent": 5},
    {"category": "transport", "percent": 3},
    {"category": "food", "percent": 2},
    {"category": "entertainment", "percent": 2},
]

OFFERS: list[dict[str, object]] = [
    {
        "id": 1,
        "partner": "Детский развлекательный центр",
        "title": "Скидка 20% на батуты",
        "description": "Для всей семьи по выходным",
        "audience": "family",
        "points_cost": 300,
    },
    {
        "id": 2,
        "partner": "Книжный магазин",
        "title": "Скидка 10% на книги",
        "description": "Учебники и художественная литература",
        "audience": "child",
        "points_cost": 150,
    },
    {
        "id": 3,
        "partner": "Спортивная секция",
        "title": "Пробное занятие бесплатно",
        "description": "Плавание, футбол, танцы",
        "audience": "child",
        "points_cost": 200,
    },
    {
        "id": 4,
        "partner": "Медицинский центр",
        "title": "Скидка 15% на детского врача",
        "description": "Плановые осмотры и справки",
        "audience": "parent",
        "points_cost": 500,
    },
    {
        "id": 5,
        "partner": "Онлайн-школа",
        "title": "Месяц курса со скидкой 25%",
        "description": "Программирование и английский",
        "audience": "family",
        "points_cost": 400,
    },
]


def cashback_points(category: str | None, amount_cents: int) -> int:
    for item in CASHBACK:
        if item["category"] == category:
            return amount_cents * int(item["percent"]) // 100
    return 0


class LoyaltyService:
    @staticmethod
    async def get_loyalty(user: User, child_id: int | None, db: AsyncSession) -> LoyaltyResponse:
        target = user
        if user.role == UserRole.PARENT and child_id is not None:
            target = await check_family_access(child_id, user, db)

        audience = {"parent", "family"} if target.role == UserRole.PARENT else {"child", "family"}
        offers_on = target.role == UserRole.PARENT or await PermissionService.is_enabled(
            db, target, "partner_offers"
        )
        offers = [
            OfferItem(**offer)  # type: ignore[arg-type]
            for offer in OFFERS
            if offers_on and offer["audience"] in audience
        ]
        return LoyaltyResponse(
            points=target.points,
            cashback=[CashbackItem(**item) for item in CASHBACK],  # type: ignore[arg-type]
            offers=offers,
        )

    @staticmethod
    async def redeem_offer(user: User, offer_id: int, db: AsyncSession) -> RedeemOfferResponse:
        offer = next((item for item in OFFERS if item["id"] == offer_id), None)
        if offer is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Предложение не найдено"})

        if user.role == UserRole.CHILD and not await PermissionService.is_enabled(db, user, "partner_offers"):
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Предложения партнёров выключены родителем"},
            )

        cost = int(offer["points_cost"])
        if user.points < cost:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Не хватает баллов"},
            )

        user.points -= cost
        await db.flush()
        code = f"MT-{offer['id']}{random.randint(1000, 9999)}"
        return RedeemOfferResponse(points=user.points, code=code)
