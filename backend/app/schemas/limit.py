"""Схемы для лимитов."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Period = Literal["day", "week", "month"]
Category = Literal[
    "food",
    "transport",
    "games",
    "subscriptions",
    "shopping",
    "entertainment",
    "education",
    "adult18",
]


class LimitItem(BaseModel):
    id: int
    category: Optional[Category]
    period: Period
    amount_cents: int = Field(ge=0)
    is_blocked: bool


class LimitPutItem(BaseModel):
    category: Optional[Category]
    period: Period
    amount_cents: int = Field(ge=0)
    is_blocked: bool


class LimitsResponse(BaseModel):
    items: List[LimitItem]


class PutLimitsRequest(BaseModel):
    items: List[LimitPutItem]
