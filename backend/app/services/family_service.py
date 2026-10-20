"""
Бизнес-логика для работы с семьей
"""
import random
from datetime import date

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.models import (
    User,
    Family,
    Account,
    AccessRequest,
    RequestStatus,
    UserRole,
    AccountType,
    AccountStatus,
    Limit,
    LimitPeriod,
    Consent,
)
from app.schemas.family import (
    FamilyResponse,
    FamilyInfo,
    FamilyChildSummary,
    CreatePackageRequest,
    CreatePackageResponse,
)
from app.schemas.user import CardInfo
from app.services.user_service import UserService


class FamilyService:
    """Сервис для работы с семьей"""
    
    @staticmethod
    async def get_family(parent: User, db: AsyncSession) -> FamilyResponse:
        """
        Возвращает информацию о семье и детях (только для родителя).
        GET /family
        """
        # Получаем информацию о семье
        result = await db.execute(
            select(Family).where(Family.id == parent.family_id)
        )
        family = result.scalar_one_or_none()
        
        if not family:
            # Не должно происходить, но на всякий случай
            family_info = FamilyInfo(id=parent.family_id, name="Семья", plan="basic")
        else:
            family_info = FamilyInfo(
                id=family.id,
                name=family.name,
                plan=family.plan
            )
        
        # Получаем всех детей из семьи
        result = await db.execute(
            select(User).where(
                User.family_id == parent.family_id,
                User.role == UserRole.CHILD
            )
        )
        children = result.scalars().all()
        
        # Формируем краткую сводку по каждому ребенку
        children_summaries: List[FamilyChildSummary] = []
        
        for child in children:
            # Получаем карту ребенка
            result = await db.execute(
                select(Account).where(Account.owner_id == child.id)
            )
            account = result.scalar_one_or_none()
            
            if account:
                card_info = CardInfo(
                    id=account.id,
                    last4=account.card_last4 or "0000",
                    balance_cents=account.balance_cents,
                    status=account.status.value
                )
            else:
                # Если карты нет (не должно быть)
                card_info = CardInfo(id=0, last4="0000", balance_cents=0, status="active")
            
            # Считаем количество pending запросов
            result = await db.execute(
                select(func.count(AccessRequest.id)).where(
                    AccessRequest.child_id == child.id,
                    AccessRequest.status == RequestStatus.PENDING
                )
            )
            pending_count = result.scalar() or 0
            
            # Рассчитываем уровень
            level = UserService.calculate_level(child.xp)
            
            children_summaries.append(
                FamilyChildSummary(
                    id=child.id,
                    name=child.name,
                    age_group=UserService.calculate_age_group(child.birth_date),
                    card=card_info,
                    pending_requests=pending_count,
                    level=level
                )
            )
        
        return FamilyResponse(
            family=family_info,
            children=children_summaries
        )

    @staticmethod
    async def create_package(parent: User, request: CreatePackageRequest, db: AsyncSession) -> CreatePackageResponse:
        child_age = FamilyService._calculate_age(request.child_birth_date)
        if child_age < 7 or child_age > 17:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Пакет выпускается для детей 7–17 лет"},
            )
        child_name = request.child_name.strip()
        if not child_name:
            raise HTTPException(status_code=422, detail={"error": "validation_error", "message": "Укажите имя ребёнка"})

        child = User(
            family_id=parent.family_id,
            role=UserRole.CHILD,
            name=child_name,
            birth_date=request.child_birth_date,
            xp=0,
            level=1,
            points=0,
        )
        db.add(child)
        await db.flush()

        account = Account(
            owner_id=child.id,
            type=AccountType.CARD,
            balance_cents=0,
            currency="BYN",
            status=AccountStatus.ACTIVE,
            card_last4=f"{random.randint(1000, 9999)}",
        )
        db.add(account)

        # Базовые лимиты для нового ребёнка.
        db.add(
            Limit(
                child_id=child.id,
                category=None,
                period=LimitPeriod.DAY,
                amount_cents=1000,
                is_blocked=False,
            )
        )
        db.add(
            Limit(
                child_id=child.id,
                category="games",
                period=LimitPeriod.DAY,
                amount_cents=0,
                is_blocked=True,
            )
        )

        if child_age < 14 and "online_payments" in request.consents:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Онлайн-платежи доступны только для 14-17 лет"},
            )

        for consent in request.consents:
            db.add(Consent(child_id=child.id, consent_type=consent))

        await db.flush()
        return CreatePackageResponse(
            child_id=child.id,
            card_id=account.id,
            age_group=UserService.calculate_age_group(child.birth_date),
            consents=request.consents,
        )

    @staticmethod
    def _calculate_age(birth_date: date) -> int:
        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
