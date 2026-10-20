"""
Роутеры для целей (goals)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.db import get_db
from app.deps import get_current_user, require_child, require_parent, check_family_access
from app.models import User
from app.schemas.goal import (
    GoalsListResponse, CreateGoalRequest, CreateGoalResponse,
    DepositGoalRequest, DepositGoalResponse,
    SetBonusRequest, SetBonusResponse,
    PendingBonusesResponse, BonusDecisionResponse,
)
from app.services.goal_service import GoalService

router = APIRouter()


@router.get("/children/{child_id}/goals", response_model=GoalsListResponse)
async def get_child_goals(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    GET /children/{id}/goals
    Получить список целей ребенка.
    Доступ: родитель своей семьи или сам ребенок.
    """
    # Проверяем доступ к ребенку
    await check_family_access(child_id, current_user, db)
    
    return await GoalService.get_child_goals(child_id, db)


@router.post("/goals", response_model=CreateGoalResponse, status_code=201)
async def create_goal(
    request: CreateGoalRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db)
):
    """
    POST /goals
    Создать новую цель (только ребенок).
    """
    return await GoalService.create_goal(
        child=child,
        title=request.title,
        target_cents=request.target_cents,
        db=db
    )


@router.post("/goals/{goal_id}/deposit", response_model=DepositGoalResponse)
async def deposit_to_goal(
    goal_id: int,
    request: DepositGoalRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db)
):
    """
    POST /goals/{id}/deposit
    Внести деньги в цель (списать с карты ребенка).
    Только ребенок.
    """
    return await GoalService.deposit_to_goal(
        goal_id=goal_id,
        child=child,
        amount_cents=request.amount_cents,
        db=db
    )


@router.put("/goals/{goal_id}/bonus", response_model=SetBonusResponse)
async def set_goal_bonus(
    goal_id: int,
    request: SetBonusRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db)
):
    """
    PUT /goals/{id}/bonus
    Установить процент бонуса от родителя к цели.
    Только родитель.
    """
    return await GoalService.set_parent_bonus(
        goal_id=goal_id,
        parent=parent,
        bonus_percent=request.parent_bonus_percent,
        db=db
    )


@router.get("/bonuses/pending", response_model=PendingBonusesResponse)
async def list_pending_bonuses(
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db)
):
    """GET /bonuses/pending — крупные бонусы, ждущие подтверждения родителя."""
    return await GoalService.list_pending_bonuses(parent=parent, db=db)


@router.post("/bonuses/{bonus_id}/approve", response_model=BonusDecisionResponse)
async def approve_bonus(
    bonus_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db)
):
    return await GoalService.decide_bonus(parent=parent, bonus_id=bonus_id, approve=True, db=db)


@router.post("/bonuses/{bonus_id}/reject", response_model=BonusDecisionResponse)
async def reject_bonus(
    bonus_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db)
):
    return await GoalService.decide_bonus(parent=parent, bonus_id=bonus_id, approve=False, db=db)
