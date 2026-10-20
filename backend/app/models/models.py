"""
SQLAlchemy модели для всех таблиц.
Важно: деньги хранятся как Integer в копейках с суффиксом _cents.
Возраст не хранится, только birth_date.
"""
from sqlalchemy import Integer, String, ForeignKey, DateTime, Boolean, Date, Text, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from typing import Optional, List
import enum

from app.db import Base


class UserRole(str, enum.Enum):
    """Роль пользователя"""
    PARENT = "parent"
    CHILD = "child"


class AccountType(str, enum.Enum):
    """Тип счета"""
    CARD = "card"
    SAVINGS = "savings"


class AccountStatus(str, enum.Enum):
    """Статус карты/счета"""
    ACTIVE = "active"
    BLOCKED = "blocked"


class LimitPeriod(str, enum.Enum):
    """Период лимита"""
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class TransactionDirection(str, enum.Enum):
    """Направление транзакции"""
    IN = "in"
    OUT = "out"


class TransactionStatus(str, enum.Enum):
    """Статус транзакции"""
    APPROVED = "approved"
    DECLINED = "declined"
    PENDING = "pending"


class RequestType(str, enum.Enum):
    """Тип запроса ребенка"""
    MONEY = "money"
    LIMIT_INCREASE = "limit_increase"
    CATEGORY_UNLOCK = "category_unlock"
    PRODUCT_ACCESS = "product_access"


class RequestStatus(str, enum.Enum):
    """Статус запроса"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TaskStatus(str, enum.Enum):
    """Статус задания"""
    NEW = "new"
    DONE = "done"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class GoalStatus(str, enum.Enum):
    """Статус цели"""
    ACTIVE = "active"
    DONE = "done"
    CANCELLED = "cancelled"


class Family(Base):
    """Семья"""
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="basic")  # basic, premium
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="family")


class User(Base):
    """Пользователь (родитель или ребенок)"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)  # Возраст рассчитывается динамически!
    xp: Mapped[int] = mapped_column(Integer, default=0)  # Опыт для детей
    level: Mapped[int] = mapped_column(Integer, default=1)  # Уровень доверия
    points: Mapped[int] = mapped_column(Integer, default=0)  # Баллы (не используется пока)

    # Relationships
    family: Mapped["Family"] = relationship("Family", back_populates="users")
    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="owner")
    limits: Mapped[List["Limit"]] = relationship("Limit", back_populates="child", foreign_keys="Limit.child_id")
    goals: Mapped[List["Goal"]] = relationship("Goal", back_populates="child")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="assigned_child")
    access_requests: Mapped[List["AccessRequest"]] = relationship("AccessRequest", back_populates="child")
    lesson_progress: Mapped[List["LessonProgress"]] = relationship("LessonProgress", back_populates="user")


class Consent(Base):
    """Согласия родителя при оформлении пакета"""
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    consent_type: Mapped[str] = mapped_column(String(100), nullable=False)  # card_issue, moby_access, online_payments
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Account(Base):
    """Счет/карта"""
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[AccountType] = mapped_column(Enum(AccountType), default=AccountType.CARD)
    balance_cents: Mapped[int] = mapped_column(Integer, default=0)  # Баланс в копейках!
    currency: Mapped[str] = mapped_column(String(3), default="BYN")
    status: Mapped[AccountStatus] = mapped_column(Enum(AccountStatus), default=AccountStatus.ACTIVE)
    card_last4: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)  # Последние 4 цифры карты

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="accounts")
    transactions: Mapped[List["Transaction"]] = relationship("Transaction", back_populates="account")


class Limit(Base):
    """Лимит на траты (общий или по категории)"""
    __tablename__ = "limits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # NULL = общий лимит
    period: Mapped[LimitPeriod] = mapped_column(Enum(LimitPeriod), default=LimitPeriod.DAY)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)  # Сумма лимита в копейках
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)  # Категория заблокирована полностью

    # Relationships
    child: Mapped["User"] = relationship("User", back_populates="limits", foreign_keys=[child_id])


class Transaction(Base):
    """Транзакция (пополнение или оплата)"""
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)  # Сумма в копейках
    direction: Mapped[TransactionDirection] = mapped_column(Enum(TransactionDirection), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # food, games, transport и т.д.
    merchant: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Название магазина
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.APPROVED)
    decline_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Причина отказа
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    account: Mapped["Account"] = relationship("Account", back_populates="transactions")


class Goal(Base):
    """Финансовая цель ребенка (копилка)"""
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_cents: Mapped[int] = mapped_column(Integer, nullable=False)  # Целевая сумма в копейках
    saved_cents: Mapped[int] = mapped_column(Integer, default=0)  # Накоплено в копейках
    parent_bonus_percent: Mapped[int] = mapped_column(Integer, default=0)  # Процент бонуса от родителя
    status: Mapped[GoalStatus] = mapped_column(Enum(GoalStatus), default=GoalStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    child: Mapped["User"] = relationship("User", back_populates="goals")


class Task(Base):
    """Задание от родителя ребенку"""
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assigned_to: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    reward_cents: Mapped[int] = mapped_column(Integer, default=0)  # Награда в копейках
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)  # Награда опытом
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.NEW)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    assigned_child: Mapped["User"] = relationship("User", back_populates="tasks")


class AccessRequest(Base):
    """Запрос ребенка родителю (деньги, лимит, разблокировка категории)"""
    __tablename__ = "access_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[RequestType] = mapped_column(Enum(RequestType), nullable=False)
    amount_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Для money и limit_increase
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Для category_unlock
    permission: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Для product_access
    comment: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus), default=RequestStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    child: Mapped["User"] = relationship("User", back_populates="access_requests")


class Allowance(Base):
    """Карманные деньги ребёнка"""
    __tablename__ = "allowances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    period: Mapped[str] = mapped_column(String(10), default="week")  # day | week
    active: Mapped[bool] = mapped_column(Boolean, default=False)


class Lesson(Base):
    """Урок финансовой грамотности"""
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    content: Mapped[list] = mapped_column(JSON, nullable=False)  # список абзацев
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)
    answer_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    min_level: Mapped[int] = mapped_column(Integer, default=1)
    xp_reward: Mapped[int] = mapped_column(Integer, default=0)
    points_reward: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    progress: Mapped[List["LessonProgress"]] = relationship("LessonProgress", back_populates="lesson")


class LessonProgress(Base):
    """Прогресс ребенка по урокам"""
    __tablename__ = "lesson_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="lesson_progress")
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="progress")
