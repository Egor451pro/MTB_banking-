"""Уроки финансовой грамотности."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import check_family_access
from app.models import Lesson, LessonProgress, User, UserRole
from app.schemas.lesson import (
    AnswerLessonResponse,
    LessonItem,
    LessonsListResponse,
)
from app.services.user_service import UserService

WRONG_EXPLANATION = "Не совсем. Перечитай урок и попробуй ещё раз."


class LessonService:
    @staticmethod
    async def list_lessons(user: User, child_id: int | None, db: AsyncSession) -> LessonsListResponse:
        target_id = user.id if user.role == UserRole.CHILD else child_id
        if target_id is None:
            raise HTTPException(
                status_code=422,
                detail={"error": "validation_error", "message": "Укажите ребёнка"},
            )
        if user.role == UserRole.PARENT:
            await check_family_access(target_id, user, db)

        lessons = (await db.execute(select(Lesson).order_by(Lesson.id.asc()))).scalars().all()
        done_rows = (
            await db.execute(
                select(LessonProgress.lesson_id).where(
                    LessonProgress.user_id == target_id,
                    LessonProgress.completed.is_(True),
                )
            )
        ).scalars().all()
        done = set(done_rows)

        return LessonsListResponse(
            items=[
                LessonItem(
                    id=lesson.id,
                    title=lesson.title,
                    description=lesson.description or "",
                    content=list(lesson.content or []),
                    question=lesson.question,
                    options=list(lesson.options or []),
                    xp_reward=lesson.xp_reward,
                    points_reward=lesson.points_reward,
                    completed=lesson.id in done,
                )
                for lesson in lessons
            ]
        )

    @staticmethod
    async def answer_lesson(child: User, lesson_id: int, option_index: int, db: AsyncSession) -> AnswerLessonResponse:
        lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
        if lesson is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Урок не найден"})

        progress = (
            await db.execute(
                select(LessonProgress).where(
                    LessonProgress.user_id == child.id,
                    LessonProgress.lesson_id == lesson.id,
                )
            )
        ).scalar_one_or_none()
        already_done = bool(progress and progress.completed)
        correct = option_index == lesson.answer_index

        if correct and not already_done:
            if progress is None:
                progress = LessonProgress(user_id=child.id, lesson_id=lesson.id)
                db.add(progress)
            progress.completed = True
            progress.completed_at = datetime.utcnow()
            child.xp += lesson.xp_reward
            child.points += lesson.points_reward
            child.level = UserService.calculate_level(child.xp)
            await db.flush()

        return AnswerLessonResponse(
            correct=correct,
            explanation=lesson.explanation if correct else WRONG_EXPLANATION,
            xp=child.xp,
            level=UserService.calculate_level(child.xp),
            points=child.points,
        )
