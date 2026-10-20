"""Схемы для заданий."""
from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

TaskStatus = Literal["new", "done", "confirmed", "rejected"]


class CreateTaskRequest(BaseModel):
    assigned_to: int
    title: str = Field(min_length=1, max_length=255)
    reward_cents: int = Field(ge=0)
    xp_reward: int = Field(ge=0)
    due_date: Optional[date] = None


class CreateTaskResponse(BaseModel):
    id: int
    status: TaskStatus


class TaskItem(BaseModel):
    id: int
    assigned_to: int
    title: str
    reward_cents: int
    xp_reward: int
    status: TaskStatus
    due_date: Optional[date]


class ListTasksResponse(BaseModel):
    items: List[TaskItem]


class TaskStatusResponse(BaseModel):
    id: int
    status: TaskStatus


class TaskConfirmResponse(BaseModel):
    id: int
    status: Literal["confirmed"]
    balance_cents: int
    xp: int
    level: int
