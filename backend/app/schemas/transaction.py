"""Схемы для истории транзакций."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

Direction = Literal["in", "out"]
PaymentStatus = Literal["approved", "declined", "pending"]
DeclineReason = Literal[
    "card_blocked",
    "category_blocked",
    "online_not_allowed",
    "insufficient_funds",
    "limit_exceeded",
]
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


class TransactionItem(BaseModel):
    id: int
    amount_cents: int
    direction: Direction
    category: Optional[Category]
    merchant: Optional[str]
    status: PaymentStatus
    decline_reason: Optional[DeclineReason]
    created_at: datetime


class TransactionsResponse(BaseModel):
    items: List[TransactionItem]
