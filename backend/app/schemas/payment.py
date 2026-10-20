"""Схемы для симуляции платежей."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

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
PaymentStatus = Literal["approved", "declined", "pending"]
DeclineReason = Literal[
    "card_blocked",
    "category_blocked",
    "online_not_allowed",
    "insufficient_funds",
    "limit_exceeded",
]


class SimulatePaymentRequest(BaseModel):
    card_id: int
    amount_cents: int = Field(gt=0)
    category: Category
    merchant: str = Field(min_length=1, max_length=255)
    is_online: bool


class SimulatePaymentResponse(BaseModel):
    transaction_id: int
    status: PaymentStatus
    decline_reason: Optional[DeclineReason]
    balance_cents: int
    message: str
