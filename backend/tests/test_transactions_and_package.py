import pytest
from httpx import AsyncClient

from app.models import Transaction, TransactionDirection, TransactionStatus


@pytest.mark.asyncio
async def test_get_transactions_returns_latest_first(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    db_session.add(
        Transaction(
            account_id=10,
            amount_cents=100,
            direction=TransactionDirection.OUT,
            category="food",
            merchant="Первая",
            is_online=False,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
        )
    )
    db_session.add(
        Transaction(
            account_id=10,
            amount_cents=200,
            direction=TransactionDirection.OUT,
            category="transport",
            merchant="Вторая",
            is_online=False,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
        )
    )
    await db_session.commit()

    response = await client.get(
        f"/children/{child_id}/transactions?limit=1",
        headers={"X-User-Id": str(parent_id)},
    )
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["amount_cents"] == 200
    created_at = response.json()["items"][0]["created_at"]
    assert created_at.endswith("+00:00") or created_at.endswith("Z")


@pytest.mark.asyncio
async def test_family_package_creates_child(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]

    response = await client.post(
        "/family/package",
        headers={"X-User-Id": str(parent_id)},
        json={
            "child_name": "Петя",
            "child_birth_date": "2014-05-10",
            "consents": ["card_issue", "moby_access"],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["child_id"] > 0
    assert body["card_id"] > 0
