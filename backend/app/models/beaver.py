"""Прогресс бобра: уровень плотины, склад брёвен, прочность. Хранится целиком одним JSON."""
from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class BeaverState(Base):
    __tablename__ = "beaver_states"

    child_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    # Состояние считает и понимает только фронтенд (src/beaverState.ts), сервер его просто хранит
    data: Mapped[str] = mapped_column(Text, nullable=False)
    # Время последнего изменения на клиенте (мс). Побеждает более новое состояние.
    updated_at: Mapped[float] = mapped_column(Float, nullable=False, default=0)
