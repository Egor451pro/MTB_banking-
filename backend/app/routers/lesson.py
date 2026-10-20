"""Роутеры уроков финансовой грамотности."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_child
from app.models import User
from app.schemas.lesson import AnswerLessonRequest, AnswerLessonResponse, LessonsListResponse
from app.services.lesson_service import LessonService

router = APIRouter()


@router.get("/lessons", response_model=LessonsListResponse)
async def get_lessons(
    current_user: Annotated[User, Depends(get_current_user)],
    child_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    return await LessonService.list_lessons(user=current_user, child_id=child_id, db=db)


@router.post("/lessons/{lesson_id}/answer", response_model=AnswerLessonResponse)
async def answer_lesson(
    lesson_id: int,
    request: AnswerLessonRequest,
    child: Annotated[User, Depends(require_child)],
    db: AsyncSession = Depends(get_db),
):
    return await LessonService.answer_lesson(
        child=child,
        lesson_id=lesson_id,
        option_index=request.option_index,
        db=db,
    )
