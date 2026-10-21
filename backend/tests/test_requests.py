import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_money_approve_tops_up_balance(client: AsyncClient, seed_test_data):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    create_response = await client.post(
        "/requests",
        headers={"X-User-Id": str(child_id)},
        json={"type": "money", "amount_cents": 500, "comment": "На кружок"},
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    approve_response = await client.post(f"/requests/{request_id}/approve", headers={"X-User-Id": str(parent_id)})
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    child_profile = await client.get(f"/children/{child_id}", headers={"X-User-Id": str(parent_id)})
    assert child_profile.status_code == 200
    assert child_profile.json()["card"]["balance_cents"] == 1750

    listed = await client.get("/requests", headers={"X-User-Id": str(parent_id)})
    assert listed.status_code == 200
    created_at = listed.json()["items"][0]["created_at"]
    assert created_at.endswith("+00:00") or created_at.endswith("Z")


@pytest.mark.asyncio
async def test_approve_category_unlock_removes_limit(client: AsyncClient, seed_test_data, db_session):
    from app.models import Limit, LimitPeriod

    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    db_session.add(
        Limit(
            child_id=child_id,
            category="subscriptions",
            period=LimitPeriod.DAY,
            amount_cents=0,
            is_blocked=True,
        )
    )
    await db_session.commit()

    create_response = await client.post(
        "/requests",
        headers={"X-User-Id": str(child_id)},
        json={"type": "category_unlock", "category": "subscriptions", "comment": ""},
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    approve_response = await client.post(
        f"/requests/{request_id}/approve",
        headers={"X-User-Id": str(parent_id)},
    )
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "approved"

    limits = await client.get(f"/children/{child_id}/limits", headers={"X-User-Id": str(parent_id)})
    assert limits.status_code == 200
    categories = [item["category"] for item in limits.json()["items"]]
    assert "subscriptions" not in categories


@pytest.mark.asyncio
async def test_limit_once_raises_only_today(client: AsyncClient, seed_test_data, db_session):
    from app.models import Limit, LimitPeriod

    child_id = seed_test_data["family1_child_id"]
    parent_id = seed_test_data["family1_parent_id"]
    db_session.add(Limit(child_id=child_id, category=None, period=LimitPeriod.DAY, amount_cents=100, is_blocked=False))
    await db_session.commit()

    pay = {"card_id": 10, "amount_cents": 300, "category": "food", "merchant": "Столовая", "is_online": False}
    first = await client.post("/payments/simulate", headers={"X-User-Id": str(child_id)}, json=pay)
    assert first.json()["decline_reason"] == "limit_exceeded"

    created = await client.post(
        "/requests", headers={"X-User-Id": str(child_id)},
        json={"type": "limit_once", "amount_cents": 300, "comment": "Разово"},
    )
    assert created.status_code == 201
    approved = await client.post(f"/requests/{created.json()['id']}/approve", headers={"X-User-Id": str(parent_id)})
    assert approved.status_code == 200

    second = await client.post("/payments/simulate", headers={"X-User-Id": str(child_id)}, json=pay)
    assert second.json()["status"] == "approved"

    # Лимит на сегодня вырос на разовую сумму, сам дневной лимит остался прежним
    me = await client.get(f"/children/{child_id}", headers={"X-User-Id": str(parent_id)})
    assert me.json()["limits_today"]["limit_cents"] == 400
    from sqlalchemy import select
    stored = (await db_session.execute(select(Limit).where(Limit.child_id == child_id, Limit.category.is_(None)))).scalar_one()
    assert stored.amount_cents == 100


@pytest.mark.asyncio
async def test_limit_once_also_covers_category_limit(client: AsyncClient, seed_test_data, db_session):
    from app.models import Limit, LimitPeriod

    child_id = seed_test_data["family1_child_id"]
    parent_id = seed_test_data["family1_parent_id"]
    db_session.add(Limit(child_id=child_id, category="food", period=LimitPeriod.DAY, amount_cents=100, is_blocked=False))
    await db_session.commit()

    pay = {"card_id": 10, "amount_cents": 300, "category": "food", "merchant": "Столовая", "is_online": False}
    first = await client.post("/payments/simulate", headers={"X-User-Id": str(child_id)}, json=pay)
    assert first.json()["decline_reason"] == "limit_exceeded"

    created = await client.post(
        "/requests", headers={"X-User-Id": str(child_id)},
        json={"type": "limit_once", "amount_cents": 300, "comment": "Разово"},
    )
    await client.post(f"/requests/{created.json()['id']}/approve", headers={"X-User-Id": str(parent_id)})

    second = await client.post("/payments/simulate", headers={"X-User-Id": str(child_id)}, json=pay)
    assert second.json()["status"] == "approved"

