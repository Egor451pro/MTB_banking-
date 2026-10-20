"""Права ребёнка в Moby: хранятся в consents (строка есть ⇔ право включено)."""
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Consent, User
from app.schemas.permission import (
    PermissionItem,
    PermissionsListResponse,
    PutPermissionItem,
)
from app.services.user_service import UserService

PERM_KEYS = ("online_payments", "goals", "virtual_card", "savings", "partner_offers")
AGE_LOCKED_KEYS = ("online_payments", "virtual_card")
LOCKED_REASON = "Доступно с 14 лет"
DEFAULT_ON_KEYS = ("goals",)


class PermissionService:
    @staticmethod
    def is_teen(user: User) -> bool:
        return UserService.calculate_age_group(user.birth_date) == "14-17"

    @staticmethod
    def locked_reason(user: User, key: str) -> str | None:
        if key in AGE_LOCKED_KEYS and not PermissionService.is_teen(user):
            return LOCKED_REASON
        return None

    @staticmethod
    async def has_consent(db: AsyncSession, child_id: int, key: str) -> bool:
        result = await db.execute(
            select(Consent).where(Consent.child_id == child_id, Consent.consent_type == key)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def is_enabled(db: AsyncSession, child: User, key: str) -> bool:
        if PermissionService.locked_reason(child, key):
            return False
        return await PermissionService.has_consent(db, child.id, key)

    @staticmethod
    async def list_permissions(child: User, db: AsyncSession) -> PermissionsListResponse:
        items: list[PermissionItem] = []
        for key in PERM_KEYS:
            locked = PermissionService.locked_reason(child, key)
            enabled = (locked is None) and await PermissionService.has_consent(db, child.id, key)
            items.append(PermissionItem(key=key, enabled=enabled, locked_reason=locked))
        return PermissionsListResponse(items=items)

    @staticmethod
    async def put_permissions(
        child: User, items: list[PutPermissionItem], db: AsyncSession
    ) -> PermissionsListResponse:
        current = await PermissionService.list_permissions(child, db)
        current_by_key = {item.key: item for item in current.items}

        for item in items:
            locked = current_by_key[item.key].locked_reason
            if item.enabled and locked:
                raise HTTPException(
                    status_code=403,
                    detail={"error": "forbidden", "message": f"Нельзя включить: {locked.lower()}"},
                )
            if item.enabled:
                await PermissionService.enable(db, child.id, item.key)
            else:
                await db.execute(
                    delete(Consent).where(
                        Consent.child_id == child.id,
                        Consent.consent_type == item.key,
                    )
                )
        await db.flush()
        return await PermissionService.list_permissions(child, db)

    @staticmethod
    async def enable(db: AsyncSession, child_id: int, key: str) -> None:
        if await PermissionService.has_consent(db, child_id, key):
            return
        db.add(Consent(child_id=child_id, consent_type=key))
        await db.flush()

    @staticmethod
    async def grant_defaults(db: AsyncSession, child: User, extra: list[str] | None = None) -> None:
        for key in DEFAULT_ON_KEYS:
            await PermissionService.enable(db, child.id, key)
        for key in extra or []:
            if key in PERM_KEYS and PermissionService.locked_reason(child, key) is None:
                await PermissionService.enable(db, child.id, key)
