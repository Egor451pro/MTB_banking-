"""Схемы карманных денег."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

AllowancePeriod = Literal["day", "week"]


class AllowanceResponse(BaseModel):
    amount_cents: int
    period: AllowancePeriod
    active: bool
    next_date: Optional[str]


class PutAllowanceRequest(BaseModel):
    amount_cents: int = Field(ge=0)
    period: AllowancePeriod
    active: bool


class PayAllowanceResponse(BaseModel):
    balance_cents: int
