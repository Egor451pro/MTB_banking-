"""Схемы уроков финансовой грамотности."""
from typing import List, Optional

from pydantic import BaseModel, Field


class LessonVideo(BaseModel):
    url: str
    seconds: int
    captions: str


class LessonItem(BaseModel):
    id: int
    video: Optional[LessonVideo] = None
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
