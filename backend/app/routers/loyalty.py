"""Роутеры программы лояльности."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.loyalty import LoyaltyResponse, RedeemOfferResponse
from app.services.loyalty_service import LoyaltyService

router = APIRouter()


@router.get("/loyalty", response_model=LoyaltyResponse)
async def get_loyalty(
    current_user: Annotated[User, Depends(get_current_user)],
    child_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await LoyaltyService.get_loyalty(user=current_user, child_id=child_id, db=db)


@router.post("/loyalty/offers/{offer_id}/redeem", response_model=RedeemOfferResponse)
async def redeem_offer(
    offer_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    return await LoyaltyService.redeem_offer(user=current_user, offer_id=offer_id, db=db)
