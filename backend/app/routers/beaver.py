"""Хранение прогресса бобра на сервере, чтобы он был одним и тем же на всех устройствах ребёнка."""
import json
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import check_family_access, get_current_user, require_child
from app.models import User
from app.models.beaver import BeaverState

router = APIRouter()


class BeaverPayload(BaseModel):
    data: dict[str, Any]
    updated_at: float


class BeaverResponse(BaseModel):
    data: Optional[dict[str, Any]] = None
    updated_at: float = 0


def _response(row: Optional[BeaverState]) -> BeaverResponse:
    if row is None:
        return BeaverResponse()
    return BeaverResponse(data=json.loads(row.data), updated_at=row.updated_at)


@router.get("/children/{child_id}/beaver", response_model=BeaverResponse)
async def get_beaver(
    child_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Ребёнок видит своего бобра, родитель бобров своих детей."""
    await check_family_access(child_id, current_user, db)
    return _response(await db.get(BeaverState, child_id))


@router.put("/children/{child_id}/beaver", response_model=BeaverResponse)
async def put_beaver(
    child_id: int,
    body: BeaverPayload,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    """Сохраняет бобра. Менять его может только сам ребёнок.
    Если на сервере уже лежит более новое состояние, оно возвращается в ответе, и клиент принимает его."""
    if child.id != child_id:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Нет доступа к профилю другого пользователя"},
        )
    row = await db.get(BeaverState, child_id)
    if row is not None and row.updated_at > body.updated_at:
        return _response(row)
    if row is None:
        row = BeaverState(child_id=child_id, data=json.dumps(body.data), updated_at=body.updated_at)
        db.add(row)
    else:
        row.data = json.dumps(body.data)
        row.updated_at = body.updated_at
    await db.flush()
    return _response(row)
