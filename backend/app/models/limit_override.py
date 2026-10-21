"""Разовое повышение дневного лимита: действует до конца текущего дня и не меняет сам лимит."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LimitOverride(Base):
    __tablename__ = "limit_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    extra_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)  # UTC naive, конец дня по Минску
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
