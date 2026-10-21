"""
Настройка подключения к базе данных SQLite через SQLAlchemy 2.x (async)
"""
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./app.db")

# Async engine для SQLite
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Логирование SQL-запросов (включи для отладки)
    future=True
)

# Фабрика сессий
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


class Base(DeclarativeBase):
    """Базовый класс для всех моделей"""
    pass


async def get_db() -> AsyncSession:
    """Dependency для получения сессии БД в эндпоинтах"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def _add_missing_columns(sync_conn) -> None:
    """create_all не меняет уже созданные таблицы: новую колонку добавляем вручную, чтобы старая app.db не ломалась"""
    insp = inspect(sync_conn)
    if "virtual_cards" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("virtual_cards")}
        if "balance_cents" not in cols:
            sync_conn.execute(text("ALTER TABLE virtual_cards ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0"))


async def init_db():
    """Создание всех таблиц (для первого запуска)"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
