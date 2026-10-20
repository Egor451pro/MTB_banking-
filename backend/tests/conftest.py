"""
Конфигурация pytest: фикстуры для тестов
"""
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db import Base, get_db
from app.models import Family, User, UserRole, Account, AccountType, AccountStatus
from datetime import date


# Используем in-memory SQLite для тестов
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override для dependency get_db в тестах"""
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest.fixture(scope="session")
def event_loop():
    """Создаем event loop для всех тестов"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Фикстура для сессии БД (пересоздается для каждого теста)"""
    # Создаем таблицы
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        yield session
    
    # Очищаем таблицы после теста
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Фикстура для HTTP клиента"""
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def seed_test_data(db_session: AsyncSession):
    """
    Фикстура для заполнения БД тестовыми данными.
    Создает две семьи для тестирования доступа.
    """
    # Семья 1 (Ивановы)
    family1 = Family(id=1, name="Семья Ивановых", plan="basic")
    db_session.add(family1)
    
    # Семья 2 (Петровы)
    family2 = Family(id=2, name="Семья Петровых", plan="basic")
    db_session.add(family2)
    
    await db_session.flush()
    
    # Пользователи семьи 1
    mama1 = User(
        id=1,
        family_id=1,
        role=UserRole.PARENT,
        name="Мама Иванова",
        birth_date=date(1988, 4, 10),
        xp=0, level=1
    )
    misha = User(
        id=2,
        family_id=1,
        role=UserRole.CHILD,
        name="Миша",
        birth_date=date(2016, 3, 2),
        xp=100, level=2
    )
    db_session.add(mama1)
    db_session.add(misha)
    
    # Пользователи семьи 2
    mama2 = User(
        id=3,
        family_id=2,
        role=UserRole.PARENT,
        name="Мама Петрова",
        birth_date=date(1990, 5, 15),
        xp=0, level=1
    )
    vanya = User(
        id=4,
        family_id=2,
        role=UserRole.CHILD,
        name="Ваня",
        birth_date=date(2014, 7, 20),
        xp=50, level=1
    )
    db_session.add(mama2)
    db_session.add(vanya)
    
    await db_session.flush()
    
    # Карты для детей
    misha_card = Account(
        id=10,
        owner_id=2,
        type=AccountType.CARD,
        balance_cents=1250,
        currency="BYN",
        status=AccountStatus.ACTIVE,
        card_last4="4412"
    )
    vanya_card = Account(
        id=11,
        owner_id=4,
        type=AccountType.CARD,
        balance_cents=2000,
        currency="BYN",
        status=AccountStatus.ACTIVE,
        card_last4="5555"
    )
    db_session.add(misha_card)
    db_session.add(vanya_card)
    
    await db_session.commit()
    
    return {
        "family1_parent_id": 1,
        "family1_child_id": 2,
        "family2_parent_id": 3,
        "family2_child_id": 4
    }
