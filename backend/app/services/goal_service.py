"""
Бизнес-логика для работы с целями (goals)
"""
from datetime import datetime

import pytz
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from fastapi import HTTPException
from typing import List

from app.models import Goal, GoalBonus, GoalStatus, User, Account
from app.schemas.goal import (
    GoalItem, GoalsListResponse, CreateGoalResponse,
    DepositGoalResponse, SetBonusResponse
)


# Бонус родителя начисляется при каждом взносе, но не больше этой суммы в месяц на ребёнка
MONTHLY_BONUS_CAP_CENTS = 1000


def _month_start_utc() -> datetime:
    """Начало текущего месяца по Минску в naive UTC (как хранятся даты в БД)."""
    minsk = pytz.timezone("Europe/Minsk")
    now = datetime.now(minsk)
    start = minsk.localize(datetime(now.year, now.month, 1))
    return start.astimezone(pytz.utc).replace(tzinfo=None)


async def _bonus_spent_this_month(child_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(GoalBonus.amount_cents), 0)).where(
            GoalBonus.child_id == child_id,
            GoalBonus.created_at >= _month_start_utc(),
        )
    )
    return int(result.scalar_one())


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

        bonus_rows = await db.execute(
            select(GoalBonus.goal_id, func.sum(GoalBonus.amount_cents))
            .where(GoalBonus.child_id == child_id)
            .group_by(GoalBonus.goal_id)
        )
        bonus_by_goal = {goal_id: int(total) for goal_id, total in bonus_rows.all()}

        items = [
            GoalItem(
                id=goal.id,
                title=goal.title,
                target_cents=goal.target_cents,
                saved_cents=goal.saved_cents,
                parent_bonus_percent=goal.parent_bonus_percent,
                bonus_cents=bonus_by_goal.get(goal.id, 0),
                status=goal.status.value
            )
            for goal in goals
        ]

        spent = await _bonus_spent_this_month(child_id, db)
        return GoalsListResponse(
            items=items,
            bonus_month_cap_cents=MONTHLY_BONUS_CAP_CENTS,
            bonus_month_left_cents=max(0, MONTHLY_BONUS_CAP_CENTS - spent),
        )
    
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
        from app.services.permission_service import PermissionService

        if not await PermissionService.is_enabled(db, child, "goals"):
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Цели выключены родителем — попроси доступ"},
            )

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
        
        # Бонус родителя: процент от взноса, но не больше остатка месячного лимита
        bonus_left = max(0, MONTHLY_BONUS_CAP_CENTS - await _bonus_spent_this_month(child.id, db))
        bonus = 0
        if goal.parent_bonus_percent > 0:
            bonus = min(amount_cents * goal.parent_bonus_percent // 100, bonus_left)

        # Списываем с карты и добавляем в цель (вместе с бонусом)
        account.balance_cents -= amount_cents
        goal.saved_cents += amount_cents + bonus
        if bonus > 0:
            db.add(GoalBonus(goal_id=goal.id, child_id=child.id, amount_cents=bonus))
        
        # Если цель достигнута, меняем статус
        if goal.saved_cents >= goal.target_cents:
            goal.status = GoalStatus.DONE
        
        await db.flush()
        
        return DepositGoalResponse(
            saved_cents=goal.saved_cents,
            card_balance_cents=account.balance_cents,
            bonus_cents=bonus,
            bonus_left_cents=bonus_left - bonus,
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
