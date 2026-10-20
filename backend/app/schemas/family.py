"""
Pydantic схемы для семьи
"""
from datetime import date
from pydantic import BaseModel, Field
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


ConsentType = Literal["card_issue", "moby_access", "online_payments"]


class CreatePackageRequest(BaseModel):
    child_name: str = Field(min_length=1, max_length=255)
    child_birth_date: date
    consents: List[ConsentType]


class CreatePackageResponse(BaseModel):
    child_id: int
    card_id: int
    age_group: AgeGroup
    consents: List[ConsentType]
