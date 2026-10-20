"""
Главное приложение FastAPI для бэкенда "Семейный банкинг в Moby"
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os

from app.db import init_db
from app.routers import (
    demo_router,
    family_router,
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
app.include_router(goal_router, tags=["Goals"])
app.include_router(limit_router, tags=["Limits"])
app.include_router(payment_router, tags=["Payments"])
app.include_router(request_router, tags=["Requests"])
app.include_router(task_router, tags=["Tasks"])
app.include_router(transaction_router, tags=["Transactions"])
app.include_router(demo_router, tags=["Demo"])


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
