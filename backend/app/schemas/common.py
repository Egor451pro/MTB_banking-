"""
Общие Pydantic схемы (ошибки, health check и т.д.)
"""
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Стандартный формат ошибки согласно контракту API"""
    error: str  # Код ошибки: forbidden, not_found, validation_error, conflict
    message: str  # Человекочитаемое сообщение


class HealthResponse(BaseModel):
    """Ответ health check"""
    status: str  # "ok"
