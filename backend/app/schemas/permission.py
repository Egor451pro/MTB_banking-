"""Схемы прав ребёнка в Moby."""
from typing import List, Literal, Optional

from pydantic import BaseModel

PermissionKey = Literal["online_payments", "goals", "virtual_card", "savings", "partner_offers"]


class PermissionItem(BaseModel):
    key: PermissionKey
    enabled: bool
    locked_reason: Optional[str]


class PermissionsListResponse(BaseModel):
    items: List[PermissionItem]


class PutPermissionItem(BaseModel):
    key: PermissionKey
    enabled: bool


class PutPermissionsRequest(BaseModel):
    items: List[PutPermissionItem]
