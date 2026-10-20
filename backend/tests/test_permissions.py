from datetime import date

import pytest
from httpx import AsyncClient

from app.models import Account, AccountStatus, AccountType, Limit, LimitPeriod, User, UserRole


def _perm_map(items: list[dict]) -> dict[str, dict]:
    return {item["key"]: item for item in items}


@pytest.mark.asyncio
async def test_get_permissions_age_lock_for_young_child(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.get(
        f"/children/{data['family1_child_id']}/permissions",
        headers={"X-User-Id": str(data["family1_parent_id"])},
    )
    assert response.status_code == 200
    perms = _perm_map(response.json()["items"])
    assert perms["online_payments"]["enabled"] is False
    assert perms["online_payments"]["locked_reason"] == "Доступно с 14 лет"
    assert perms["virtual_card"]["enabled"] is False
    assert perms["virtual_card"]["locked_reason"] == "Доступно с 14 лет"
    assert perms["goals"]["enabled"] is True
    assert perms["goals"]["locked_reason"] is None
    assert perms["partner_offers"]["enabled"] is False


@pytest.mark.asyncio
async def test_cannot_enable_locked_permission(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.put(
        f"/children/{data['family1_child_id']}/permissions",
        headers={"X-User-Id": str(data["family1_parent_id"])},
        json={"items": [{"key": "online_payments", "enabled": True}]},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"


@pytest.mark.asyncio
async def test_disable_goals_blocks_create_goal(client: AsyncClient, seed_test_data):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    turned_off = await client.put(
        f"/children/{child_id}/permissions",
        headers={"X-User-Id": str(parent_id)},
        json={"items": [{"key": "goals", "enabled": False}]},
    )
    assert turned_off.status_code == 200
    assert _perm_map(turned_off.json()["items"])["goals"]["enabled"] is False

    create = await client.post(
        "/goals",
        headers={"X-User-Id": str(child_id)},
        json={"title": "Велосипед", "target_cents": 30000},
    )
    assert create.status_code == 403
    assert create.json()["error"] == "forbidden"
    assert "цели выключены" in create.json()["message"].lower()


@pytest.mark.asyncio
async def test_product_access_request_approve_enables_permission(client: AsyncClient, seed_test_data):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    created = await client.post(
        "/requests",
        headers={"X-User-Id": str(child_id)},
        json={"type": "product_access", "permission": "savings", "comment": "Хочу вклад"},
    )
    assert created.status_code == 201
    request_id = created.json()["id"]

    listed = await client.get("/requests", headers={"X-User-Id": str(parent_id)})
    assert listed.status_code == 200
    item = next(r for r in listed.json()["items"] if r["id"] == request_id)
    assert item["type"] == "product_access"
    assert item["permission"] == "savings"

    approved = await client.post(
        f"/requests/{request_id}/approve",
        headers={"X-User-Id": str(parent_id)},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    perms = await client.get(
        f"/children/{child_id}/permissions",
        headers={"X-User-Id": str(parent_id)},
    )
    assert _perm_map(perms.json()["items"])["savings"]["enabled"] is True


@pytest.mark.asyncio
async def test_online_payment_without_permission_declined(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    db_session.add(Limit(child_id=child_id, category=None, period=LimitPeriod.DAY, amount_cents=5000, is_blocked=False))
    await db_session.commit()

    response = await client.post(
        "/payments/simulate",
        headers={"X-User-Id": str(child_id)},
        json={
            "card_id": 10,
            "amount_cents": 300,
            "category": "food",
            "merchant": "Онлайн-магазин",
            "is_online": True,
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "declined"
    assert response.json()["decline_reason"] == "online_not_allowed"


@pytest.mark.asyncio
async def test_teen_can_enable_online_payments(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    teen = User(
        id=5,
        family_id=1,
        role=UserRole.CHILD,
        name="Аня",
        birth_date=date(2011, 6, 20),
        xp=0,
        level=1,
    )
    db_session.add(teen)
    db_session.add(
        Account(
            id=12,
            owner_id=5,
            type=AccountType.CARD,
            balance_cents=5000,
            currency="BYN",
            status=AccountStatus.ACTIVE,
            card_last4="7781",
        )
    )
    await db_session.commit()

    parent_id = data["family1_parent_id"]
    before = await client.get("/children/5/permissions", headers={"X-User-Id": str(parent_id)})
    assert before.status_code == 200
    assert _perm_map(before.json()["items"])["online_payments"]["locked_reason"] is None
    assert _perm_map(before.json()["items"])["online_payments"]["enabled"] is False

    enabled = await client.put(
        "/children/5/permissions",
        headers={"X-User-Id": str(parent_id)},
        json={"items": [{"key": "online_payments", "enabled": True}]},
    )
    assert enabled.status_code == 200
    assert _perm_map(enabled.json()["items"])["online_payments"]["enabled"] is True


@pytest.mark.asyncio
async def test_create_package_enables_goals_by_default(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]

    created = await client.post(
        "/family/package",
        headers={"X-User-Id": str(parent_id)},
        json={
            "child_name": "Петя",
            "child_birth_date": "2014-05-10",
            "consents": ["card_issue", "moby_access"],
        },
    )
    assert created.status_code == 201
    child_id = created.json()["child_id"]

    perms = await client.get(
        f"/children/{child_id}/permissions",
        headers={"X-User-Id": str(parent_id)},
    )
    mapped = _perm_map(perms.json()["items"])
    assert mapped["goals"]["enabled"] is True
    assert mapped["partner_offers"]["enabled"] is False
    assert mapped["online_payments"]["enabled"] is False
