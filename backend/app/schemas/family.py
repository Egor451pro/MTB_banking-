"""
Pydantic схемы для семьи
"""
from pydantic import BaseModel
from typing import List, Literal
from .user import AgeGroup, CardInfo


class FamilyInfo(BaseModel):
    """Информация о семье"""
    id: int
    name: str
    plan: str  # basic, premium


class FamilyChildSummary(BaseModel):
    """Краткая информация о ребенке для главного экрана родителя"""
    id: int
    name: str
    age_group: AgeGroup
    card: CardInfo
    pending_requests: int
    level: int


class FamilyResponse(BaseModel):
    """GET /family - семья и дети (только для родителя)"""
    family: FamilyInfo
    children: List[FamilyChildSummary]
