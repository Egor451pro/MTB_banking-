"""Виртуальная карта: выпуск, заморозка, заказ пластика за деньги со счёта ребёнка."""
import random
import re
from datetime import datetime
from typing import Literal, Optional

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, AccountStatus, Transaction, TransactionDirection, TransactionStatus, User
from app.models.virtual_card import VirtualCard
from app.services.permission_service import PermissionService

PLASTIC_PRICE_CENTS = 1500   # 15 BYN, как перевыпуск карты по тарифам банка
COURIER_FEE_CENTS = 500      # доставка курьером
TRANSFER_TO_CARD = "Перевод на виртуальную карту"
TRANSFER_FROM_CARD = "Перевод с виртуальной карты"
MAX_TRANSFER_CENTS = 1_000_000
PLASTIC_READY_SECONDS = 60   # в демо «изготовление» занимает минуту


class PlasticInfo(BaseModel):
    status: Literal["none", "ordered", "ready"]
    method: Optional[str] = None
    address: Optional[str] = None
    ordered_at: Optional[datetime] = None


class VirtualCardResponse(BaseModel):
    available: bool                       # можно ли выпустить или пользоваться
    locked_reason: Optional[str] = None   # почему нельзя
    issued: bool
    holder: Optional[str] = None
    number: Optional[str] = None          # полностью только владельцу, родителю маска
    last4: Optional[str] = None
    expires: Optional[str] = None
    cvc: Optional[str] = None             # только владельцу
    status: Optional[str] = None
    balance_cents: int = 0                # свой баланс карты
    plastic: PlasticInfo
    plastic_price_cents: int = PLASTIC_PRICE_CENTS
    courier_fee_cents: int = COURIER_FEE_CENTS


def _luhn_number(prefix: str = "9112", length: int = 16) -> str:
    body = prefix + "".join(str(random.randint(0, 9)) for _ in range(length - len(prefix) - 1))
    total = 0
    for i, ch in enumerate(reversed(body)):
        d = int(ch)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return body + str((10 - total % 10) % 10)


def _fail(status: int, error: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": error, "message": message})


def _money(cents: int) -> str:
    return f"{cents / 100:.2f}".replace(".", ",") + " BYN"


def _plastic(card: Optional[VirtualCard]) -> PlasticInfo:
    if card is None or card.plastic_ordered_at is None:
        return PlasticInfo(status="none")
    age = (datetime.utcnow() - card.plastic_ordered_at).total_seconds()
    return PlasticInfo(
        status="ready" if age >= PLASTIC_READY_SECONDS else "ordered",
        method=card.plastic_method,
        address=card.plastic_address,
        ordered_at=card.plastic_ordered_at,
    )


class VirtualCardService:
    @staticmethod
    async def _gate(child: User, db: AsyncSession) -> tuple[bool, Optional[str]]:
        reason = PermissionService.locked_reason(child, "virtual_card")
        if reason:
            return False, reason
        if not await PermissionService.has_consent(db, child.id, "virtual_card"):
            return False, "Родитель ещё не разрешил виртуальную карту"
        return True, None

    @staticmethod
    async def get(child: User, viewer: User, db: AsyncSession) -> VirtualCardResponse:
        card = await db.get(VirtualCard, child.id)
        available, reason = await VirtualCardService._gate(child, db)
        if card is None:
            return VirtualCardResponse(available=available, locked_reason=reason, issued=False, plastic=_plastic(None))
        owner = viewer.id == child.id
        return VirtualCardResponse(
            available=available,
            locked_reason=reason,
            issued=True,
            holder=card.holder,
            number=card.number if owner else f"•••• •••• •••• {card.number[-4:]}",
            last4=card.number[-4:],
            expires=card.expires if owner else None,
            cvc=card.cvc if owner else None,
            status=card.status,
            balance_cents=card.balance_cents or 0,
            plastic=_plastic(card),
        )

    @staticmethod
    async def issue(child: User, holder: Optional[str], db: AsyncSession) -> VirtualCardResponse:
        available, reason = await VirtualCardService._gate(child, db)
        if not available:
            raise _fail(403, "forbidden", reason or "Виртуальная карта недоступна")
        if await db.get(VirtualCard, child.id) is None:
            name = re.sub(r"\s+", " ", (holder or child.name).strip()).upper()[:26]
            if len(name) < 2:
                raise _fail(400, "validation_error", "Укажите имя на карте")
            today = datetime.utcnow()
            db.add(
                VirtualCard(
                    child_id=child.id,
                    holder=name,
                    number=_luhn_number(),
                    expires=f"{today.month:02d}/{(today.year + 4) % 100:02d}",
                    cvc=f"{random.randint(0, 999):03d}",
                )
            )
            await db.flush()
        return await VirtualCardService.get(child, child, db)

    @staticmethod
    async def set_status(child: User, viewer: User, status: str, db: AsyncSession) -> VirtualCardResponse:
        card = await db.get(VirtualCard, child.id)
        if card is None:
            raise _fail(404, "not_found", "Виртуальная карта ещё не выпущена")
        card.status = status
        await db.flush()
        return await VirtualCardService.get(child, viewer, db)

    @staticmethod
    async def transfer(
        child: User, direction: str, amount_cents: int, db: AsyncSession
    ) -> VirtualCardResponse:
        """Перевод между счётом ребёнка и его виртуальной картой. Это свои деньги, лимиты трат не расходуются."""
        card = await db.get(VirtualCard, child.id)
        if card is None:
            raise _fail(404, "not_found", "Сначала выпустите виртуальную карту")
        if amount_cents <= 0 or amount_cents > MAX_TRANSFER_CENTS:
            raise _fail(400, "validation_error", "Укажите сумму перевода")
        account = (await db.execute(select(Account).where(Account.owner_id == child.id))).scalar_one_or_none()
        if account is None:
            raise _fail(404, "not_found", "Карта не найдена")
        if account.status == AccountStatus.BLOCKED:
            raise _fail(403, "card_blocked", "Карта заблокирована")

        if direction == "to_card":
            if account.balance_cents < amount_cents:
                raise _fail(400, "insufficient_funds", f"На счёте не хватает денег: доступно {_money(account.balance_cents)}")
            account.balance_cents -= amount_cents
            card.balance_cents = (card.balance_cents or 0) + amount_cents
            tx_direction, merchant = TransactionDirection.OUT, TRANSFER_TO_CARD
        else:
            if (card.balance_cents or 0) < amount_cents:
                raise _fail(400, "insufficient_funds", f"На карте не хватает денег: доступно {_money(card.balance_cents or 0)}")
            card.balance_cents -= amount_cents
            account.balance_cents += amount_cents
            tx_direction, merchant = TransactionDirection.IN, TRANSFER_FROM_CARD

        db.add(
            Transaction(
                account_id=account.id,
                amount_cents=amount_cents,
                direction=tx_direction,
                category=None,
                merchant=merchant,
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
            )
        )
        await db.flush()
        return await VirtualCardService.get(child, child, db)

    @staticmethod
    async def order_plastic(
        child: User, method: str, address: Optional[str], db: AsyncSession
    ) -> VirtualCardResponse:
        card = await db.get(VirtualCard, child.id)
        if card is None:
            raise _fail(404, "not_found", "Сначала выпустите виртуальную карту")
        if card.plastic_ordered_at is not None:
            raise _fail(409, "conflict", "Пластиковая карта уже заказана")
        address = (address or "").strip()
        if method == "delivery" and len(address) < 5:
            raise _fail(400, "validation_error", "Укажите адрес доставки")

        price = PLASTIC_PRICE_CENTS + (COURIER_FEE_CENTS if method == "delivery" else 0)
        account = (await db.execute(select(Account).where(Account.owner_id == child.id))).scalar_one_or_none()
        if account is None:
            raise _fail(404, "not_found", "Карта не найдена")
        if account.status == AccountStatus.BLOCKED:
            raise _fail(403, "card_blocked", "Карта заблокирована")
        if account.balance_cents < price:
            raise _fail(400, "insufficient_funds", f"На карте не хватает денег: нужно {_money(price)}")

        account.balance_cents -= price
        db.add(
            Transaction(
                account_id=account.id,
                amount_cents=price,
                direction=TransactionDirection.OUT,
                category=None,
                merchant="МТБанк · пластиковая карта",
                is_online=False,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
            )
        )
        card.plastic_method = method
        card.plastic_address = address if method == "delivery" else None
        card.plastic_ordered_at = datetime.utcnow()
        await db.flush()
        return await VirtualCardService.get(child, child, db)
