"""
Pydantic схемы для пользователей и детей
"""
from pydantic import BaseModel, Field
from datetime import date
from typing import Literal, Optional


AgeGroup = Literal["7-13", "14-17"]


class CardInfo(BaseModel):
    """Информация о карте"""
    id: int
    last4: str = Field(..., min_length=4, max_length=4)
    balance_cents: int
    status: Literal["active", "blocked"]


class LimitsToday(BaseModel):
    """Лимиты на сегодня"""
    limit_cents: Optional[int]  # None если общий лимит не установлен
    spent_cents: int
    left_cents: Optional[int]  # None если лимита нет


class LevelInfo(BaseModel):
    """Информация об уровне"""
    level: int
    xp: int
    xp_to_next: int


class Permissions(BaseModel):
    """Разрешения ребенка"""
    online_payments: bool


class MeResponse(BaseModel):
    """GET /me - информация о текущем пользователе"""
    id: int
    role: Literal["parent", "child"]
    name: str
    family_id: int
    birth_date: date
    age_group: AgeGroup


class ChildProfileResponse(BaseModel):
    """GET /children/{id} - полный профиль ребенка"""
    id: int
    name: str
    age_group: AgeGroup
    card: CardInfo
    limits_today: LimitsToday
    level: LevelInfo
    permissions: Permissions


class TopupRequest(BaseModel):
    amount_cents: int = Field(..., gt=0)


class TopupResponse(BaseModel):
    balance_cents: int


class CardStatusResponse(BaseModel):
    id: int
    status: Literal["active", "blocked"]


class CardReissueResponse(BaseModel):
    id: int
    last4: str
    status: Literal["active", "blocked"]
