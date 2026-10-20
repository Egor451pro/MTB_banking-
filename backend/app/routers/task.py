"""Роутеры для заданий."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_child, require_parent
from app.models import User
from app.schemas.task import (
    CreateTaskRequest,
    CreateTaskResponse,
    ListTasksResponse,
    TaskConfirmResponse,
    TaskStatusResponse,
)
from app.services.task_service import TaskService

router = APIRouter()


@router.post("/tasks", response_model=CreateTaskResponse, status_code=201)
async def create_task(
    request: CreateTaskRequest,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await TaskService.create_task(parent=parent, request=request, db=db)


@router.get("/tasks", response_model=ListTasksResponse)
async def list_tasks(
    current_user: Annotated[User, Depends(get_current_user)],
    child_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await TaskService.list_tasks(current_user=current_user, child_id=child_id, db=db)


@router.post("/tasks/{task_id}/done", response_model=TaskStatusResponse)
async def task_done(
    task_id: int,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    return await TaskService.mark_done(child=child, task_id=task_id, db=db)


@router.post("/tasks/{task_id}/confirm", response_model=TaskConfirmResponse)
async def task_confirm(
    task_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await TaskService.confirm(parent=parent, task_id=task_id, db=db)


@router.post("/tasks/{task_id}/reject", response_model=TaskStatusResponse)
async def task_reject(
    task_id: int,
    parent: Annotated[User, Depends(require_parent)],
    db: AsyncSession = Depends(get_db),
):
    return await TaskService.reject(parent=parent, task_id=task_id, db=db)
