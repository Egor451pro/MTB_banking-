"""
Бизнес-логика для работы с семьей
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.models import User, Family, Account, AccessRequest, RequestStatus, UserRole
from app.schemas.family import FamilyResponse, FamilyInfo, FamilyChildSummary
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
