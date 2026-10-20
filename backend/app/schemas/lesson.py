"""Схемы уроков финансовой грамотности."""
from typing import List

from pydantic import BaseModel, Field


class LessonItem(BaseModel):
    id: int
    title: str
    description: str
    content: List[str]
    question: str
    options: List[str]
    xp_reward: int
    points_reward: int
    completed: bool


class LessonsListResponse(BaseModel):
    items: List[LessonItem]


class AnswerLessonRequest(BaseModel):
    option_index: int = Field(ge=0)


class AnswerLessonResponse(BaseModel):
    correct: bool
    explanation: str
    xp: int
    level: int
    points: int
