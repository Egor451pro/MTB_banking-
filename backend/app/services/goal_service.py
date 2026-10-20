"""
Бизнес-логика для работы с целями (goals)
"""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from fastapi import HTTPException
from typing import List

from app.models import Goal, GoalBonus, GoalStatus, User, Account
from app.schemas.goal import (
    GoalItem, GoalsListResponse, CreateGoalResponse,
    DepositGoalResponse, SetBonusResponse,
    PendingBonusItem, PendingBonusesResponse, BonusDecisionResponse,
)


# Если один взнос больше этой суммы, бонус к нему не начисляется сам — его подтверждает родитель
BONUS_CONFIRM_DEPOSIT_CENTS = 1000


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
            .where(GoalBonus.child_id == child_id, GoalBonus.status == "credited")
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
        
        # Бонус родителя: процент от взноса, без ограничения по сумме
        bonus = amount_cents * goal.parent_bonus_percent // 100

        # Бонус к крупному взносу (больше 10 BYN) ждёт подтверждения родителя, остальные начисляются сразу
        needs_confirm = bonus > 0 and amount_cents > BONUS_CONFIRM_DEPOSIT_CENTS
        credited = 0 if needs_confirm else bonus

        # Списываем с карты и добавляем в цель
        account.balance_cents -= amount_cents
        goal.saved_cents += amount_cents + credited
        if bonus > 0:
            db.add(GoalBonus(
                goal_id=goal.id, child_id=child.id, amount_cents=bonus,
                status="pending" if needs_confirm else "credited",
            ))
        
        # Если цель достигнута, меняем статус
        if goal.saved_cents >= goal.target_cents:
            goal.status = GoalStatus.DONE
        
        await db.flush()
        
        return DepositGoalResponse(
            saved_cents=goal.saved_cents,
            card_balance_cents=account.balance_cents,
            bonus_cents=credited,
            bonus_pending_cents=bonus if needs_confirm else 0,
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


    @staticmethod
    async def list_pending_bonuses(parent: User, db: AsyncSession) -> PendingBonusesResponse:
        """GET /bonuses/pending — крупные бонусы семьи, ждущие подтверждения."""
        rows = (await db.execute(
            select(GoalBonus, Goal, User)
            .join(Goal, Goal.id == GoalBonus.goal_id)
            .join(User, User.id == GoalBonus.child_id)
            .where(GoalBonus.status == "pending", User.family_id == parent.family_id)
            .order_by(GoalBonus.created_at.desc())
        )).all()
        return PendingBonusesResponse(items=[
            PendingBonusItem(
                id=b.id, child_id=c.id, child_name=c.name, goal_title=g.title,
                amount_cents=b.amount_cents, created_at=b.created_at,
            )
            for b, g, c in rows
        ])

    @staticmethod
    async def decide_bonus(parent: User, bonus_id: int, approve: bool, db: AsyncSession) -> BonusDecisionResponse:
        """POST /bonuses/{id}/approve | reject"""
        row = (await db.execute(
            select(GoalBonus, Goal, User)
            .join(Goal, Goal.id == GoalBonus.goal_id)
            .join(User, User.id == GoalBonus.child_id)
            .where(GoalBonus.id == bonus_id)
        )).first()
        if not row or row[2].family_id != parent.family_id:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Бонус не найден"})
        bonus, goal, _child = row
        if bonus.status != "pending":
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Бонус уже обработан"})
        if approve:
            bonus.status = "credited"
            goal.saved_cents += bonus.amount_cents
            if goal.saved_cents >= goal.target_cents:
                goal.status = GoalStatus.DONE
        else:
            bonus.status = "rejected"
        await db.flush()
        return BonusDecisionResponse(id=bonus.id, status=bonus.status, saved_cents=goal.saved_cents)
