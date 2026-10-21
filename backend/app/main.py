"""
Главное приложение FastAPI для бэкенда "Семейный банкинг в Moby"
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os

from sqlalchemy import func, select

from app.db import AsyncSessionLocal, init_db
from app.models import User
from app.routers import (
    demo_router,
    family_router,
    lesson_router,
    loyalty_router,
    beaver_router,
    virtual_card_router,
    goal_router,
    limit_router,
    payment_router,
    request_router,
    task_router,
    transaction_router,
    user_router,
)
from app.schemas.common import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация БД при старте приложения"""
    await init_db()
    # Пустая база (первый запуск) — сразу заполняем демо-семьёй,
    # чтобы не нужно было помнить про `python -m app.seed`
    async with AsyncSessionLocal() as session:
        users = (await session.execute(select(func.count(User.id)))).scalar() or 0
    if users == 0:
        from app.seed import seed_data
        await seed_data()
    yield


# Создание приложения
app = FastAPI(
    title="Moby Family Banking API",
    description="API для хакатонного прототипа 'Семейный банкинг в Moby'",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS для фронтенда.
# По умолчанию разрешены все адреса: прототип открывают с ноутбука, телефона и через туннель.
# Авторизации по cookie нет (только X-User-Id), поэтому credentials не нужны.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGIN", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials="*" not in CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(user_router, tags=["Users"])
app.include_router(family_router, tags=["Family"])
app.include_router(goal_router, tags=["Goals"])
app.include_router(limit_router, tags=["Limits"])
app.include_router(payment_router, tags=["Payments"])
app.include_router(request_router, tags=["Requests"])
app.include_router(task_router, tags=["Tasks"])
app.include_router(transaction_router, tags=["Transactions"])
app.include_router(demo_router, tags=["Demo"])
app.include_router(lesson_router, tags=["Lessons"])
app.include_router(loyalty_router, tags=["Loyalty"])
app.include_router(beaver_router, tags=["Beaver"])
app.include_router(virtual_card_router, tags=["VirtualCard"])


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    # Все ошибки API отдаем в едином формате контракта
    if isinstance(exc.detail, dict) and "error" in exc.detail and "message" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    fallback_map = {
        403: ("forbidden", "Доступ запрещен"),
        404: ("not_found", "Ресурс не найден"),
        409: ("conflict", "Конфликт данных"),
        422: ("validation_error", "Некорректный запрос"),
    }
    error, message = fallback_map.get(exc.status_code, ("validation_error", str(exc.detail)))
    return JSONResponse(status_code=exc.status_code, content={"error": error, "message": message})


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(_: Request, __: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "message": "Некорректный запрос"},
    )


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    GET /health
    Health check эндпоинт для проверки работоспособности сервера.
    """
    return HealthResponse(status="ok")
