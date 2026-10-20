"""Схемы для запросов ребенка родителю."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, field_serializer, model_validator

Category = Literal[
    "food",
    "transport",
    "games",
    "subscriptions",
    "shopping",
    "entertainment",
    "education",
    "adult18",
]
RequestType = Literal["money", "limit_increase", "category_unlock"]
RequestStatus = Literal["pending", "approved", "rejected"]


class CreateRequestRequest(BaseModel):
    type: RequestType
    amount_cents: Optional[int] = None
    category: Optional[Category] = None
    comment: str

    @model_validator(mode="after")
    def validate_payload(self):
        if self.type in ("money", "limit_increase"):
            if self.amount_cents is None or self.amount_cents <= 0:
                raise ValueError("amount_cents is required and must be > 0")
            self.category = None
        elif self.type == "category_unlock":
            if self.category is None:
                raise ValueError("category is required for category_unlock")
            self.amount_cents = None
        return self


class CreateRequestResponse(BaseModel):
    id: int
    status: RequestStatus


class RequestItem(BaseModel):
    id: int
    child_id: int
    child_name: str
    type: RequestType
    amount_cents: Optional[int]
    category: Optional[Category]
    comment: str
    status: RequestStatus
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return value.replace(tzinfo=timezone.utc).isoformat()


class ListRequestsResponse(BaseModel):
    items: List[RequestItem]


class RequestStatusResponse(BaseModel):
    id: int
    status: RequestStatus
