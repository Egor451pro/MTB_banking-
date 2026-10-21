"""Сервис служебных demo-эндпоинтов."""
from fastapi import Request

from app.db import engine_for
from app.seed import seed_data


class DemoService:
    @staticmethod
    async def reset_demo_data(request: Request | None = None) -> dict[str, str]:
        # Сбрасываем только базу этого посетителя (или общую, если заголовка нет)
        eng, maker = await engine_for(request)
        await seed_data(eng, maker)
        return {"status": "ok"}
