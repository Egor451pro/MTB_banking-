"""
Настройка подключения к базе данных SQLite через SQLAlchemy 2.x (async)
"""
import asyncio
import os
import re
from collections import OrderedDict
from pathlib import Path

from fastapi import Request
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

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


# ───────── Демо-песочницы: у каждого посетителя своя база ─────────
# Фронтенд присылает заголовок X-Demo-Session со случайным кодом. По коду выбираем отдельный
# SQLite-файл в DEMO_DIR; при первом запросе создаём таблицы и заливаем демо-семью.
# Без заголовка всё работает как раньше — с общей базой app.db.
DEMO_DIR = Path(os.getenv("DEMO_DIR", "./demo_dbs"))
DEMO_MAX_OPEN = int(os.getenv("DEMO_MAX_OPEN", "100"))   # сколько баз держим открытыми одновременно
DEMO_HEADER = "x-demo-session"
_DEMO_CODE = re.compile(r"^[a-z0-9]{4,32}$")

_demo_makers: "OrderedDict[str, async_sessionmaker]" = OrderedDict()
_demo_engines: dict[str, AsyncEngine] = {}
_demo_locks: dict[str, asyncio.Lock] = {}


def demo_code(request: Request | None) -> str | None:
    """Код песочницы из заголовка; некорректный код игнорируем (чтобы нельзя было подсунуть путь к файлу)"""
    if request is None:
        return None
    code = (request.headers.get(DEMO_HEADER) or "").strip().lower()
    return code if _DEMO_CODE.match(code) else None


async def _close_oldest() -> None:
    while len(_demo_makers) > DEMO_MAX_OPEN:
        old, _ = _demo_makers.popitem(last=False)
        eng = _demo_engines.pop(old, None)
        if eng is not None:
            await eng.dispose()   # файл остаётся на диске, при следующем запросе просто откроем снова


async def demo_engine(code: str) -> tuple[AsyncEngine, async_sessionmaker]:
    """Движок и фабрика сессий песочницы; при первом обращении база создаётся и заполняется демо-данными"""
    if code in _demo_makers:
        _demo_makers.move_to_end(code)
        return _demo_engines[code], _demo_makers[code]
    lock = _demo_locks.setdefault(code, asyncio.Lock())
    async with lock:
        if code in _demo_makers:
            return _demo_engines[code], _demo_makers[code]
        DEMO_DIR.mkdir(parents=True, exist_ok=True)
        path = DEMO_DIR / f"{code}.db"
        fresh = not path.exists()
        eng = create_async_engine(f"sqlite+aiosqlite:///{path.as_posix()}", echo=False, future=True)
        maker = async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False, autocommit=False, autoflush=False)
        if fresh:
            from app.seed import seed_data
            await seed_data(eng, maker)
        else:
            async with eng.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.run_sync(_add_missing_columns)
        _demo_engines[code] = eng
        _demo_makers[code] = maker
        await _close_oldest()
        return eng, maker


async def engine_for(request: Request | None) -> tuple[AsyncEngine, async_sessionmaker]:
    """Общая база или песочница посетителя — в зависимости от заголовка"""
    code = demo_code(request)
    if code is None:
        return engine, AsyncSessionLocal
    return await demo_engine(code)


async def get_db(request: Request) -> AsyncSession:
    """Dependency для получения сессии БД в эндпоинтах (своя база у каждой демо-сессии)"""
    _, maker = await engine_for(request)
    async with maker() as session:
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
