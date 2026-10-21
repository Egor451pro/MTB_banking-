"""Служебные demo-роутеры."""
from fastapi import APIRouter, Request

from app.services.demo_service import DemoService

router = APIRouter()


@router.post("/demo/reset")
async def demo_reset(request: Request):
    return await DemoService.reset_demo_data(request)
