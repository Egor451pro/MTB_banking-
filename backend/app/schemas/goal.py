"""
Pydantic схемы для целей (goals)
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Literal


GoalStatus = Literal["active", "done", "cancelled"]


class GoalItem(BaseModel):
    """Элемент цели в списке"""
    id: int
    title: str
    target_cents: int
    saved_cents: int
    parent_bonus_percent: int
    bonus_cents: int = 0  # сколько бонуса родителя уже вошло в saved_cents
    status: GoalStatus


class GoalsListResponse(BaseModel):
    """GET /children/{id}/goals - список целей ребенка"""
    items: List[GoalItem]
    bonus_month_cap_cents: int = 0   # месячный лимит бонуса родителя
    bonus_month_left_cents: int = 0  # сколько бонуса ещё можно начислить в этом месяце


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
    bonus_cents: int = 0             # бонус родителя, начисленный за этот взнос
    bonus_pending_cents: int = 0     # крупный бонус, ждёт подтверждения родителя
    bonus_left_cents: int = 0        # остаток месячного лимита бонуса
    status: GoalStatus


class SetBonusRequest(BaseModel):
    """PUT /goals/{id}/bonus - установить процент бонуса от родителя"""
    parent_bonus_percent: int = Field(..., ge=0, le=100)


class SetBonusResponse(BaseModel):
    """Ответ на установку бонуса"""
    parent_bonus_percent: int


class PendingBonusItem(BaseModel):
    """Крупный бонус, ждущий подтверждения родителя"""
    id: int
    child_id: int
    child_name: str
    goal_title: str
    amount_cents: int
    created_at: datetime


class PendingBonusesResponse(BaseModel):
    items: List[PendingBonusItem]


class BonusDecisionResponse(BaseModel):
    id: int
    status: Literal["credited", "rejected"]
    saved_cents: int
