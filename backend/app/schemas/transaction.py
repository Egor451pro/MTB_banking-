"""Схемы для истории транзакций."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, field_serializer

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

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return value.replace(tzinfo=timezone.utc).isoformat()


class TransactionsResponse(BaseModel):
    items: List[TransactionItem]


class PendingPurchaseItem(TransactionItem):
    child_id: int
    child_name: str


class PendingPurchasesResponse(BaseModel):
    items: List[PendingPurchaseItem]


class PurchaseDecisionResponse(BaseModel):
    id: int
    status: PaymentStatus
    balance_cents: int
    message: str
