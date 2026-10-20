"""Роутеры для запросов ребенка родителю."""
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_child, require_parent
from app.models import User
from app.schemas.request import (
    CreateRequestRequest,
    CreateRequestResponse,
    ListRequestsResponse,
    RequestStatusResponse,
)
from app.services.request_service import RequestService

router = APIRouter()


@router.post("/requests", response_model=CreateRequestResponse, status_code=201)
async def create_request(
    request: CreateRequestRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    return await RequestService.create_request(child=child, request=request, db=db)


@router.get("/requests", response_model=ListRequestsResponse)
async def list_requests(
    user: Annotated[User, Depends(get_current_user)],
    status: Optional[Literal["pending", "approved", "rejected"]] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await RequestService.list_requests(user=user, status=status, db=db)


@router.post("/requests/{request_id}/approve", response_model=RequestStatusResponse)
async def approve_request(
    request_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await RequestService.approve_request(parent=parent, request_id=request_id, db=db)


@router.post("/requests/{request_id}/reject", response_model=RequestStatusResponse)
async def reject_request(
    request_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await RequestService.reject_request(parent=parent, request_id=request_id, db=db)
