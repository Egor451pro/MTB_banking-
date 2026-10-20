"""
Главное приложение FastAPI для бэкенда "Семейный банкинг в Moby"
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.db import init_db
from app.routers import user_router, family_router
from app.schemas.common import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация БД при старте приложения"""
    await init_db()
    yield


# Создание приложения
app = FastAPI(
    title="Moby Family Banking API",
    description="API для хакатонного прототипа 'Семейный банкинг в Moby'",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS для фронтенда
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(user_router, tags=["Users"])
app.include_router(family_router, tags=["Family"])


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    GET /health
    Health check эндпоинт для проверки работоспособности сервера.
    """
    return HealthResponse(status="ok")
