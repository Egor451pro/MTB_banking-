"""Виртуальная карта подростка (14–17 лет): выпускается в приложении, к ней можно заказать пластик."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class VirtualCard(Base):
    __tablename__ = "virtual_cards"

    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    holder: Mapped[str] = mapped_column(String(64), nullable=False)
    number: Mapped[str] = mapped_column(String(16), nullable=False)
    expires: Mapped[str] = mapped_column(String(5), nullable=False)  # MM/YY
    cvc: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | frozen
    # Пластик: пока plastic_ordered_at пустой, пластик не заказывали
    plastic_method: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # pickup | delivery
    plastic_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    plastic_ordered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
