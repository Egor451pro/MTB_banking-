"""
Бизнес-логика для работы с целями (goals)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from typing import List

from app.models import Goal, GoalStatus, User, Account
from app.schemas.goal import (
    GoalItem, GoalsListResponse, CreateGoalResponse,
    DepositGoalResponse, SetBonusResponse
)


class GoalService:
    """Сервис для работы с целями"""
    
    @staticmethod
    async def get_child_goals(child_id: int, db: AsyncSession) -> GoalsListResponse:
        """
        Получить список целей ребенка.
        GET /children/{id}/goals
        """
        result = await db.execute(
            select(Goal).where(Goal.child_id == child_id).order_by(Goal.created_at.desc())
        )
        goals = result.scalars().all()
        
        items = [
            GoalItem(
                id=goal.id,
                title=goal.title,
                target_cents=goal.target_cents,
                saved_cents=goal.saved_cents,
                parent_bonus_percent=goal.parent_bonus_percent,
                status=goal.status.value
            )
            for goal in goals
        ]
        
        return GoalsListResponse(items=items)
    
    @staticmethod
    async def create_goal(
        child: User,
        title: str,
        target_cents: int,
        db: AsyncSession
    ) -> CreateGoalResponse:
        """
        Создать новую цель (ребенок).
        POST /goals
        """
        if not title.strip():
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Укажите название цели"}
            )
        
        if target_cents <= 0:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Сумма должна быть больше нуля"}
            )
        
        # Создаем цель
        goal = Goal(
            child_id=child.id,
            title=title.strip(),
            target_cents=target_cents,
            saved_cents=0,
            parent_bonus_percent=0,
            status=GoalStatus.ACTIVE
        )
        
        db.add(goal)
        await db.flush()
        await db.refresh(goal)
        
        return CreateGoalResponse(
            id=goal.id,
            title=goal.title,
            target_cents=goal.target_cents,
            saved_cents=goal.saved_cents,
            parent_bonus_percent=goal.parent_bonus_percent,
            status=goal.status.value
        )
    
    @staticmethod
    async def deposit_to_goal(
        goal_id: int,
        child: User,
        amount_cents: int,
        db: AsyncSession
    ) -> DepositGoalResponse:
        """
        Внести деньги в цель (списать с карты ребенка).
        POST /goals/{id}/deposit
        """
        # Находим цель
        result = await db.execute(
            select(Goal).where(Goal.id == goal_id, Goal.child_id == child.id)
        )
        goal = result.scalar_one_or_none()
        
        if not goal:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": "Цель не найдена"}
            )
        
        if goal.status != GoalStatus.ACTIVE:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Цель уже завершена или отменена"}
            )
        
        # Находим карту ребенка
        result = await db.execute(
            select(Account).where(Account.owner_id == child.id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": "Карта не найдена"}
            )
        
        # Проверяем баланс
        if account.balance_cents < amount_cents:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "На карте не хватает денег"}
            )
        
        # Списываем с карты и добавляем в цель
        account.balance_cents -= amount_cents
        goal.saved_cents += amount_cents
        
        # Если цель достигнута, меняем статус
        if goal.saved_cents >= goal.target_cents:
            goal.status = GoalStatus.DONE
        
        await db.flush()
        
        return DepositGoalResponse(
            saved_cents=goal.saved_cents,
            card_balance_cents=account.balance_cents,
            status=goal.status.value
        )
    
    @staticmethod
    async def set_parent_bonus(
        goal_id: int,
        parent: User,
        bonus_percent: int,
        db: AsyncSession
    ) -> SetBonusResponse:
        """
        Установить процент бонуса от родителя к цели.
        PUT /goals/{id}/bonus
        """
        # Находим цель
        result = await db.execute(
            select(Goal).where(Goal.id == goal_id)
        )
        goal = result.scalar_one_or_none()
        
        if not goal:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": "Цель не найдена"}
            )
        
        # Проверяем, что ребенок из той же семьи
        result = await db.execute(
            select(User).where(User.id == goal.child_id)
        )
        child = result.scalar_one_or_none()
        
        if not child or child.family_id != parent.family_id:
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Нет доступа к этой цели"}
            )
        
        # Устанавливаем бонус
        goal.parent_bonus_percent = bonus_percent
        await db.flush()
        
        return SetBonusResponse(parent_bonus_percent=goal.parent_bonus_percent)
