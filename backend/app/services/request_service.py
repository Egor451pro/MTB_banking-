"""Бизнес-логика запросов ребенка."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AccessRequest,
    Account,
    Limit,
    LimitPeriod,
    RequestStatus,
    RequestType,
    Transaction,
    TransactionDirection,
    TransactionStatus,
    User,
    UserRole,
)
from app.schemas.request import (
    CreateRequestRequest,
    CreateRequestResponse,
    ListRequestsResponse,
    RequestItem,
    RequestStatusResponse,
)


class RequestService:
    @staticmethod
    async def create_request(child: User, request: CreateRequestRequest, db: AsyncSession) -> CreateRequestResponse:
        row = AccessRequest(
            child_id=child.id,
            type=RequestType(request.type),
            amount_cents=request.amount_cents,
            category=request.category,
            comment=request.comment,
            status=RequestStatus.PENDING,
        )
        db.add(row)
        await db.flush()
        return CreateRequestResponse(id=row.id, status=row.status.value)

    @staticmethod
    async def list_requests(user: User, status: str | None, db: AsyncSession) -> ListRequestsResponse:
        stmt: Select[tuple[AccessRequest, User]] = select(AccessRequest, User).join(User, User.id == AccessRequest.child_id)
        if user.role == UserRole.PARENT:
            stmt = stmt.where(User.family_id == user.family_id)
        else:
            stmt = stmt.where(AccessRequest.child_id == user.id)
        if status:
            stmt = stmt.where(AccessRequest.status == RequestStatus(status))
        stmt = stmt.order_by(AccessRequest.created_at.desc())

        result = await db.execute(stmt)
        rows = result.all()

        return ListRequestsResponse(
            items=[
                RequestItem(
                    id=req.id,
                    child_id=child.id,
                    child_name=child.name,
                    type=req.type.value,
                    amount_cents=req.amount_cents,
                    category=req.category,
                    comment=req.comment,
                    status=req.status.value,
                    created_at=req.created_at,
                )
                for req, child in rows
            ]
        )

    @staticmethod
    async def approve_request(parent: User, request_id: int, db: AsyncSession) -> RequestStatusResponse:
        req, child = await RequestService._get_parent_scoped_request(parent=parent, request_id=request_id, db=db)
        if req.status != RequestStatus.PENDING:
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Запрос уже обработан"})

        if req.type == RequestType.MONEY:
            if req.amount_cents is None:
                raise HTTPException(status_code=422, detail={"error": "validation_error", "message": "Сумма не указана"})
            account = await RequestService._get_child_card(child.id, db)
            account.balance_cents += req.amount_cents
            db.add(
                Transaction(
                    account_id=account.id,
                    amount_cents=req.amount_cents,
                    direction=TransactionDirection.IN,
                    category=None,
                    merchant="По запросу ребёнка",
                    is_online=False,
                    status=TransactionStatus.APPROVED,
                    decline_reason=None,
                )
            )
        elif req.type == RequestType.LIMIT_INCREASE:
            if req.amount_cents is None:
                raise HTTPException(status_code=422, detail={"error": "validation_error", "message": "Сумма не указана"})
            result = await db.execute(
                select(Limit).where(
                    Limit.child_id == child.id,
                    Limit.category.is_(None),
                    Limit.period == LimitPeriod.DAY,
                )
            )
            general_limit = result.scalar_one_or_none()
            if general_limit:
                general_limit.amount_cents = req.amount_cents
                general_limit.is_blocked = False
            else:
                db.add(
                    Limit(
                        child_id=child.id,
                        category=None,
                        period=LimitPeriod.DAY,
                        amount_cents=req.amount_cents,
                        is_blocked=False,
                    )
                )
        elif req.type == RequestType.CATEGORY_UNLOCK:
            if req.category == "adult18":
                raise HTTPException(
                    status_code=403,
                    detail={"error": "forbidden", "message": "Категорию 18+ нельзя открыть: она запрещена банком"},
                )
            await db.execute(
                select(Limit).where(
                    Limit.child_id == child.id,
                    Limit.category == req.category,
                )
            )
            await db.execute(
                Limit.__table__.delete().where(
                    Limit.child_id == child.id,
                    Limit.category == req.category,
                )
            )

        req.status = RequestStatus.APPROVED
        req.processed_at = datetime.utcnow()
        await db.flush()
        return RequestStatusResponse(id=req.id, status=req.status.value)

    @staticmethod
    async def reject_request(parent: User, request_id: int, db: AsyncSession) -> RequestStatusResponse:
        req, _ = await RequestService._get_parent_scoped_request(parent=parent, request_id=request_id, db=db)
        if req.status != RequestStatus.PENDING:
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Запрос уже обработан"})
        req.status = RequestStatus.REJECTED
        req.processed_at = datetime.utcnow()
        await db.flush()
        return RequestStatusResponse(id=req.id, status=req.status.value)

    @staticmethod
    async def _get_parent_scoped_request(parent: User, request_id: int, db: AsyncSession) -> tuple[AccessRequest, User]:
        result = await db.execute(
            select(AccessRequest, User).join(User, User.id == AccessRequest.child_id).where(AccessRequest.id == request_id)
        )
        row = result.first()
        if row is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Запрос не найден"})
        req, child = row
        if parent.role != UserRole.PARENT or child.family_id != parent.family_id:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Нет доступа"})
        return req, child

    @staticmethod
    async def _get_child_card(child_id: int, db: AsyncSession) -> Account:
        result = await db.execute(select(Account).where(Account.owner_id == child_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Карта не найдена"})
        return account
