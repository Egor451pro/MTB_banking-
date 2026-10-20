import pytest
from httpx import AsyncClient

from app.models import Limit, LimitPeriod


@pytest.mark.asyncio
async def test_simulate_payment_blocked_category_has_priority(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    db_session.add(Limit(child_id=child_id, category="games", period=LimitPeriod.DAY, amount_cents=0, is_blocked=True))
    await db_session.commit()

    response = await client.post(
        "/payments/simulate",
        headers={"X-User-Id": str(child_id)},
        json={
            "card_id": 10,
            "amount_cents": 5000,  # заведомо больше баланса, но категория должна сработать раньше
            "category": "games",
            "merchant": "Игровой магазин",
            "is_online": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "declined"
    assert body["decline_reason"] == "category_blocked"


@pytest.mark.asyncio
async def test_simulate_payment_approved_deducts_balance(client: AsyncClient, seed_test_data, db_session):
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
            "merchant": "Столовая",
            "is_online": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["balance_cents"] == 950
