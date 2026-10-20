"""Конфигурация pytest: фикстуры для тестов."""
from datetime import date
from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app
from app.models import Account, AccountStatus, AccountType, Family, User, UserRole

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="function")
async def prepare_db() -> AsyncGenerator[None, None]:
    """Гарантирует чистую схему БД на каждый тест."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(scope="function")
async def client(prepare_db: None) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def seed_test_data(prepare_db: None) -> dict[str, int]:
    async with TestingSessionLocal() as session:
        session.add(Family(id=1, name="Семья Ивановых", plan="basic"))
        session.add(Family(id=2, name="Семья Петровых", plan="basic"))
        await session.flush()

        session.add(
            User(
                id=1,
                family_id=1,
                role=UserRole.PARENT,
                name="Мама Иванова",
                birth_date=date(1988, 4, 10),
                xp=0,
                level=1,
            )
        )
        session.add(
            User(
                id=2,
                family_id=1,
                role=UserRole.CHILD,
                name="Миша",
                birth_date=date(2016, 3, 2),
                xp=100,
                level=2,
            )
        )
        session.add(
            User(
                id=3,
                family_id=2,
                role=UserRole.PARENT,
                name="Мама Петрова",
                birth_date=date(1990, 5, 15),
                xp=0,
                level=1,
            )
        )
        session.add(
            User(
                id=4,
                family_id=2,
                role=UserRole.CHILD,
                name="Ваня",
                birth_date=date(2014, 7, 20),
                xp=50,
                level=1,
            )
        )
        await session.flush()

        session.add(
            Account(
                id=10,
                owner_id=2,
                type=AccountType.CARD,
                balance_cents=1250,
                currency="BYN",
                status=AccountStatus.ACTIVE,
                card_last4="4412",
            )
        )
        session.add(
            Account(
                id=11,
                owner_id=4,
                type=AccountType.CARD,
                balance_cents=2000,
                currency="BYN",
                status=AccountStatus.ACTIVE,
                card_last4="5555",
            )
        )
        await session.commit()

    return {
        "family1_parent_id": 1,
        "family1_child_id": 2,
        "family2_parent_id": 3,
        "family2_child_id": 4,
    }


@pytest_asyncio.fixture(scope="function")
async def db_session(prepare_db: None) -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session
