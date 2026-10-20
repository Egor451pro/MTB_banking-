"""
Бизнес-логика для работы с пользователями и детьми
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime
from typing import Optional
import pytz

from app.models import User, Account, Limit, Transaction, TransactionStatus, TransactionDirection, Consent
from app.schemas.user import (
    MeResponse, ChildProfileResponse, AgeGroup,
    CardInfo, LimitsToday, LevelInfo, Permissions
)


class UserService:
    """Сервис для работы с пользователями"""
    
    @staticmethod
    def calculate_age_group(birth_date: date) -> AgeGroup:
        """
        Динамически рассчитывает возрастную группу из даты рождения.
        Возраст НЕ хранится в БД!
        """
        today = date.today()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
        
        if 7 <= age <= 13:
            return "7-13"
        elif 14 <= age <= 17:
            return "14-17"
        else:
            # На случай некорректных данных (не должно происходить)
            return "7-13"
    
    @staticmethod
    def calculate_xp_to_next(xp: int) -> int:
        """Рассчитывает опыт до следующего уровня"""
        # Пороги опыта из mock.ts
        XP_STEPS = [0, 50, 120, 200, 320, 500]
        level = UserService.calculate_level(xp)
        
        if level >= len(XP_STEPS):
            return 0  # Достигнут максимальный уровень
        
        return XP_STEPS[level] - xp
    
    @staticmethod
    def calculate_level(xp: int) -> int:
        """Рассчитывает уровень на основе опыта"""
        XP_STEPS = [0, 50, 120, 200, 320, 500]
        level = 1
        for i, step in enumerate(XP_STEPS):
            if xp >= step:
                level = i + 1
        return level

    @staticmethod
    def get_start_of_day_utc_naive(now_minsk: Optional[datetime] = None) -> datetime:
        """
        Возвращает начало текущего дня по Europe/Minsk в виде наивного UTC datetime.
        Это нужно для корректного сравнения с Transaction.created_at, который хранится как UTC naive.
        """
        minsk_tz = pytz.timezone("Europe/Minsk")
        now = now_minsk or datetime.now(minsk_tz)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_day_utc = start_of_day.astimezone(pytz.utc).replace(tzinfo=None)
        return start_of_day_utc

    @staticmethod
    async def calculate_spent_today_cents(
        db: AsyncSession,
        account_id: int,
        category: Optional[str] = None,
        now_minsk: Optional[datetime] = None,
    ) -> int:
        """
        Считает одобренные траты за текущий день (Europe/Minsk).
        """
        start_of_day_utc = UserService.get_start_of_day_utc_naive(now_minsk=now_minsk)
        filters = [
            Transaction.account_id == account_id,
            Transaction.direction == TransactionDirection.OUT,
            Transaction.status == TransactionStatus.APPROVED,
            Transaction.created_at >= start_of_day_utc,
        ]
        if category is not None:
            filters.append(Transaction.category == category)

        result = await db.execute(select(func.sum(Transaction.amount_cents)).where(*filters))
        return result.scalar() or 0

    @staticmethod
    async def has_online_payments_permission(db: AsyncSession, child_id: int) -> bool:
        result = await db.execute(
            select(Consent).where(
                Consent.child_id == child_id,
                Consent.consent_type == "online_payments",
            )
        )
        return result.scalar_one_or_none() is not None
    
    @staticmethod
    async def get_me(user: User) -> MeResponse:
        """Возвращает информацию о текущем пользователе"""
        return MeResponse(
            id=user.id,
            role=user.role.value,
            name=user.name,
            family_id=user.family_id,
            birth_date=user.birth_date,
            age_group=UserService.calculate_age_group(user.birth_date)
        )
    
    @staticmethod
    async def get_child_profile(child: User, db: AsyncSession) -> ChildProfileResponse:
        """
        Возвращает полный профиль ребенка для GET /children/{id}.
        Рассчитывает лимиты на сегодня с учетом таймзоны Europe/Minsk.
        """
        # Получаем карту ребенка
        result = await db.execute(
            select(Account).where(Account.owner_id == child.id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            # Если карты нет, создаем пустую (не должно случиться после seed)
            card_info = CardInfo(id=0, last4="0000", balance_cents=0, status="active")
        else:
            card_info = CardInfo(
                id=account.id,
                last4=account.card_last4 or "0000",
                balance_cents=account.balance_cents,
                status=account.status.value
            )
        
        # Получаем общий дневной лимит
        result = await db.execute(
            select(Limit).where(
                Limit.child_id == child.id,
                Limit.category.is_(None),
                Limit.period == "day",
                Limit.is_blocked == False
            )
        )
        general_limit = result.scalar_one_or_none()
        
        # Рассчитываем траты за сегодня (Europe/Minsk)
        if account:
            spent_cents = await UserService.calculate_spent_today_cents(db=db, account_id=account.id)
        else:
            spent_cents = 0
        
        # Формируем информацию о лимитах
        if general_limit:
            limits_today = LimitsToday(
                limit_cents=general_limit.amount_cents,
                spent_cents=spent_cents,
                left_cents=max(0, general_limit.amount_cents - spent_cents)
            )
        else:
            limits_today = LimitsToday(
                limit_cents=None,
                spent_cents=spent_cents,
                left_cents=None
            )
        
        # Информация об уровне
        level_info = LevelInfo(
            level=UserService.calculate_level(child.xp),
            xp=child.xp,
            xp_to_next=UserService.calculate_xp_to_next(child.xp)
        )
        
        # Проверяем разрешение на онлайн-платежи (из таблицы consents)
        permissions = Permissions(online_payments=await UserService.has_online_payments_permission(db, child.id))
        
        return ChildProfileResponse(
            id=child.id,
            name=child.name,
            age_group=UserService.calculate_age_group(child.birth_date),
            card=card_info,
            limits_today=limits_today,
            level=level_info,
            permissions=permissions
        )
