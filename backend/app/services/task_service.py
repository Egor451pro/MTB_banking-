"""Бизнес-логика заданий."""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Account,
    Task,
    TaskStatus,
    Transaction,
    TransactionDirection,
    TransactionStatus,
    User,
    UserRole,
)
from app.schemas.task import (
    CreateTaskRequest,
    CreateTaskResponse,
    ListTasksResponse,
    TaskConfirmResponse,
    TaskItem,
    TaskStatusResponse,
)
from app.services.user_service import UserService


class TaskService:
    @staticmethod
    async def create_task(parent: User, request: CreateTaskRequest, db: AsyncSession) -> CreateTaskResponse:
        child = await TaskService._get_user(request.assigned_to, db)
        if child.family_id != parent.family_id:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Нет доступа"})
        if child.role != UserRole.CHILD:
            raise HTTPException(status_code=422, detail={"error": "validation_error", "message": "Задание можно назначить только ребенку"})
        if not request.title.strip():
            raise HTTPException(status_code=422, detail={"error": "validation_error", "message": "Укажите задание"})

        task = Task(
            assigned_to=request.assigned_to,
            title=request.title.strip(),
            reward_cents=request.reward_cents,
            xp_reward=request.xp_reward,
            status=TaskStatus.NEW,
            due_date=request.due_date,
        )
        db.add(task)
        await db.flush()
        return CreateTaskResponse(id=task.id, status=task.status.value)

    @staticmethod
    async def list_tasks(current_user: User, child_id: int | None, db: AsyncSession) -> ListTasksResponse:
        stmt = select(Task).order_by(Task.id.asc())
        if current_user.role == UserRole.CHILD:
            stmt = stmt.where(Task.assigned_to == current_user.id)
        else:
            stmt = stmt.join(User, User.id == Task.assigned_to).where(User.family_id == current_user.family_id)
            if child_id is not None:
                stmt = stmt.where(Task.assigned_to == child_id)
        result = await db.execute(stmt)
        tasks = result.scalars().all()
        return ListTasksResponse(
            items=[
                TaskItem(
                    id=t.id,
                    assigned_to=t.assigned_to,
                    title=t.title,
                    reward_cents=t.reward_cents,
                    xp_reward=t.xp_reward,
                    status=t.status.value,
                    due_date=t.due_date,
                )
                for t in tasks
            ]
        )

    @staticmethod
    async def mark_done(child: User, task_id: int, db: AsyncSession) -> TaskStatusResponse:
        result = await db.execute(select(Task).where(Task.id == task_id, Task.assigned_to == child.id))
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Задание не найдено"})
        task.status = TaskStatus.DONE
        await db.flush()
        return TaskStatusResponse(id=task.id, status=task.status.value)

    @staticmethod
    async def confirm(parent: User, task_id: int, db: AsyncSession) -> TaskConfirmResponse:
        task, child = await TaskService._get_parent_scoped_task(parent, task_id, db)
        if task.status != TaskStatus.DONE:
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Задание ещё не выполнено"})

        account = await TaskService._get_child_card(child.id, db)
        account.balance_cents += task.reward_cents
        child.xp += task.xp_reward
        task.status = TaskStatus.CONFIRMED

        db.add(
            Transaction(
                account_id=account.id,
                amount_cents=task.reward_cents,
                direction=TransactionDirection.IN,
                category=None,
                merchant=f"За задание: {task.title}",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
            )
        )
        await db.flush()
        return TaskConfirmResponse(
            id=task.id,
            status="confirmed",
            balance_cents=account.balance_cents,
            xp=child.xp,
            level=UserService.calculate_level(child.xp),
        )

    @staticmethod
    async def reject(parent: User, task_id: int, db: AsyncSession) -> TaskStatusResponse:
        task, _ = await TaskService._get_parent_scoped_task(parent, task_id, db)
        task.status = TaskStatus.REJECTED
        await db.flush()
        return TaskStatusResponse(id=task.id, status=task.status.value)

    @staticmethod
    async def _get_parent_scoped_task(parent: User, task_id: int, db: AsyncSession) -> tuple[Task, User]:
        result = await db.execute(select(Task, User).join(User, User.id == Task.assigned_to).where(Task.id == task_id))
        row = result.first()
        if row is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Задание не найдено"})
        task, child = row
        if child.family_id != parent.family_id:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Нет доступа"})
        return task, child

    @staticmethod
    async def _get_user(user_id: int, db: AsyncSession) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Пользователь не найден"})
        return user

    @staticmethod
    async def _get_child_card(child_id: int, db: AsyncSession) -> Account:
        result = await db.execute(select(Account).where(Account.owner_id == child_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})
        return account
