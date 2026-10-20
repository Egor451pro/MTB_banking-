"""
Pydantic схемы для целей (goals)
"""
from pydantic import BaseModel, Field
from typing import List, Literal


GoalStatus = Literal["active", "done", "cancelled"]


class GoalItem(BaseModel):
    """Элемент цели в списке"""
    id: int
    title: str
    target_cents: int
    saved_cents: int
    parent_bonus_percent: int
    status: GoalStatus


class GoalsListResponse(BaseModel):
    """GET /children/{id}/goals - список целей ребенка"""
    items: List[GoalItem]


class CreateGoalRequest(BaseModel):
    """POST /goals - создание цели"""
    title: str = Field(..., min_length=1, max_length=255)
    target_cents: int = Field(..., gt=0)


class CreateGoalResponse(BaseModel):
    """Ответ на создание цели"""
    id: int
    title: str
    target_cents: int
    saved_cents: int
    parent_bonus_percent: int
    status: GoalStatus


class DepositGoalRequest(BaseModel):
    """POST /goals/{id}/deposit - внести деньги в цель"""
    amount_cents: int = Field(..., gt=0)


class DepositGoalResponse(BaseModel):
    """Ответ на внесение денег в цель"""
    saved_cents: int
    card_balance_cents: int
    status: GoalStatus


class SetBonusRequest(BaseModel):
    """PUT /goals/{id}/bonus - установить процент бонуса от родителя"""
    parent_bonus_percent: int = Field(..., ge=0, le=100)


class SetBonusResponse(BaseModel):
    """Ответ на установку бонуса"""
    parent_bonus_percent: int
