"""Схемы программы лояльности."""
from typing import List, Literal

from pydantic import BaseModel

from app.schemas.transaction import Category

Audience = Literal["child", "parent", "family"]


class CashbackItem(BaseModel):
    category: Category
    percent: int


class OfferItem(BaseModel):
    id: int
    partner: str
    title: str
    description: str
    audience: Audience
    points_cost: int


class LoyaltyResponse(BaseModel):
    points: int
    cashback: List[CashbackItem]
    offers: List[OfferItem]


class RedeemOfferResponse(BaseModel):
    points: int
    code: str
