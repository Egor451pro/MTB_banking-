"""Роутеры для симуляции оплат."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_child
from app.models import User
from app.schemas.payment import SimulatePaymentRequest, SimulatePaymentResponse
from app.services.payment_service import PaymentService

router = APIRouter()


@router.post("/payments/simulate", response_model=SimulatePaymentResponse)
async def simulate_payment(
    request: SimulatePaymentRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    return await PaymentService.simulate_payment(child=child, request=request, db=db)
