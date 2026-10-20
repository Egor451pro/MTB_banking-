"""Сервис служебных demo-эндпоинтов."""
from app.seed import seed_data


class DemoService:
    @staticmethod
    async def reset_demo_data() -> dict[str, str]:
        await seed_data()
        return {"status": "ok"}
