from datetime import date

import pytest
from httpx import AsyncClient

from app.models import Account, AccountStatus, AccountType, Consent, User, UserRole


def h(uid: int) -> dict:
    return {"X-User-Id": str(uid)}


async def _teen(db_session, balance_cents: int = 3000, allowed: bool = True) -> int:
    """Подросток в семье 1: id 5, счёт 12."""
    db_session.add(User(id=5, family_id=1, role=UserRole.CHILD, name="Аня", birth_date=date(2010, 6, 20), xp=0, level=1))
    await db_session.flush()
    db_session.add(Account(id=12, owner_id=5, type=AccountType.CARD, balance_cents=balance_cents, currency="BYN",
                           status=AccountStatus.ACTIVE, card_last4="7781"))
    if allowed:
        db_session.add(Consent(child_id=5, consent_type="virtual_card"))
    await db_session.commit()
    return 5


@pytest.mark.asyncio
async def test_child_under_14_cannot_issue(client: AsyncClient, seed_test_data):
    child = seed_test_data["family1_child_id"]
    r = await client.get(f"/children/{child}/virtual-card", headers=h(child))
    assert r.status_code == 200
    assert r.json()["available"] is False
    assert r.json()["locked_reason"] == "Доступно с 14 лет"
    r = await client.post(f"/children/{child}/virtual-card", headers=h(child), json={})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_teen_needs_parent_permission(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session, allowed=False)
    r = await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_issue_and_parent_sees_masked_number(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session)
    r = await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={"holder": "anna ivanova"})
    assert r.status_code == 200
    body = r.json()
    assert body["issued"] is True
    assert body["holder"] == "ANNA IVANOVA"
    assert len(body["number"]) == 16 and len(body["cvc"]) == 3
    assert body["status"] == "active"
    assert body["plastic"]["status"] == "none"

    # Повторный выпуск возвращает ту же карту
    again = await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    assert again.json()["number"] == body["number"]

    parent = await client.get(f"/children/{teen}/virtual-card", headers=h(seed_test_data["family1_parent_id"]))
    assert parent.status_code == 200
    assert parent.json()["cvc"] is None
    assert parent.json()["number"].endswith(body["number"][-4:])
    assert parent.json()["number"] != body["number"]


@pytest.mark.asyncio
async def test_freeze_by_parent(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    parent = seed_test_data["family1_parent_id"]
    r = await client.post(f"/children/{teen}/virtual-card/status", headers=h(parent), json={"status": "frozen"})
    assert r.status_code == 200
    assert r.json()["status"] == "frozen"


@pytest.mark.asyncio
async def test_plastic_is_paid_from_balance(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session, balance_cents=3000)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    r = await client.post(f"/children/{teen}/virtual-card/plastic", headers=h(teen),
                          json={"method": "delivery", "address": "Минск, пр. Независимости 1"})
    assert r.status_code == 200
    assert r.json()["plastic"]["status"] == "ordered"

    me = await client.get(f"/children/{teen}", headers=h(teen))
    assert me.json()["card"]["balance_cents"] == 3000 - 2000  # 15 BYN пластик + 5 BYN курьер

    twice = await client.post(f"/children/{teen}/virtual-card/plastic", headers=h(teen), json={"method": "pickup"})
    assert twice.status_code == 409


@pytest.mark.asyncio
async def test_plastic_needs_money(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session, balance_cents=1000)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    r = await client.post(f"/children/{teen}/virtual-card/plastic", headers=h(teen), json={"method": "pickup"})
    assert r.status_code == 400
    assert r.json()["error"] == "insufficient_funds"


@pytest.mark.asyncio
async def test_delivery_needs_address(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    r = await client.post(f"/children/{teen}/virtual-card/plastic", headers=h(teen), json={"method": "delivery"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_transfer_to_card_and_back(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session, balance_cents=3000)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})

    r = await client.post(f"/children/{teen}/virtual-card/transfer", headers=h(teen),
                          json={"direction": "to_card", "amount_cents": 1000})
    assert r.status_code == 200
    assert r.json()["balance_cents"] == 1000
    me = await client.get(f"/children/{teen}", headers=h(teen))
    assert me.json()["card"]["balance_cents"] == 2000
    # перевод себе не расходует дневной лимит
    assert me.json()["limits_today"]["spent_cents"] == 0

    back = await client.post(f"/children/{teen}/virtual-card/transfer", headers=h(teen),
                             json={"direction": "to_account", "amount_cents": 400})
    assert back.json()["balance_cents"] == 600
    me = await client.get(f"/children/{teen}", headers=h(teen))
    assert me.json()["card"]["balance_cents"] == 2400


@pytest.mark.asyncio
async def test_transfer_checks_funds(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session, balance_cents=500)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    r = await client.post(f"/children/{teen}/virtual-card/transfer", headers=h(teen),
                          json={"direction": "to_card", "amount_cents": 1000})
    assert r.status_code == 400 and r.json()["error"] == "insufficient_funds"
    r = await client.post(f"/children/{teen}/virtual-card/transfer", headers=h(teen),
                          json={"direction": "to_account", "amount_cents": 100})
    assert r.status_code == 400 and r.json()["error"] == "insufficient_funds"
    r = await client.post(f"/children/{teen}/virtual-card/transfer", headers=h(teen),
                          json={"direction": "to_card", "amount_cents": 0})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_parent_cannot_transfer(client: AsyncClient, seed_test_data, db_session):
    teen = await _teen(db_session)
    await client.post(f"/children/{teen}/virtual-card", headers=h(teen), json={})
    parent = seed_test_data["family1_parent_id"]
    r = await client.post(f"/children/{teen}/virtual-card/transfer", headers=h(parent),
                          json={"direction": "to_card", "amount_cents": 100})
    assert r.status_code == 403

