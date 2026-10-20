import pytest
from httpx import AsyncClient

from app.models import (
    Transaction,
    TransactionDirection,
    TransactionStatus,
)


async def _add_pending(db_session, account_id: int = 10, amount_cents: int = 500) -> int:
    tx = Transaction(
        account_id=account_id,
        amount_cents=amount_cents,
        direction=TransactionDirection.OUT,
        category="shopping",
        merchant="Магазин одежды",
        is_online=True,
        status=TransactionStatus.PENDING,
        decline_reason=None,
    )
    db_session.add(tx)
    await db_session.commit()
    await db_session.refresh(tx)
    return tx.id


@pytest.mark.asyncio
async def test_parent_lists_pending_purchases(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    tx_id = await _add_pending(db_session)

    response = await client.get("/purchases/pending", headers={"X-User-Id": str(parent_id)})
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == tx_id
    assert items[0]["child_id"] == data["family1_child_id"]
    assert items[0]["child_name"] == "Миша"
    assert items[0]["status"] == "pending"
    assert items[0]["amount_cents"] == 500
    created_at = items[0]["created_at"]
    assert created_at.endswith("+00:00") or created_at.endswith("Z")


@pytest.mark.asyncio
async def test_other_family_does_not_see_pending_purchase(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    await _add_pending(db_session)

    response = await client.get(
        "/purchases/pending",
        headers={"X-User-Id": str(data["family2_parent_id"])},
    )
    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_child_sees_own_pending_purchase(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    tx_id = await _add_pending(db_session)

    response = await client.get(
        "/purchases/pending",
        headers={"X-User-Id": str(data["family1_child_id"])},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == tx_id


@pytest.mark.asyncio
async def test_approve_purchase_deducts_balance(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    tx_id = await _add_pending(db_session, amount_cents=500)

    response = await client.post(
        f"/transactions/{tx_id}/approve",
        headers={"X-User-Id": str(parent_id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == tx_id
    assert body["status"] == "approved"
    assert body["balance_cents"] == 750
    assert body["message"] == "Покупка подтверждена"


@pytest.mark.asyncio
async def test_approve_blocked_card_declines(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    tx_id = await _add_pending(db_session)

    blocked = await client.post("/cards/10/block", headers={"X-User-Id": str(parent_id)})
    assert blocked.status_code == 200

    response = await client.post(
        f"/transactions/{tx_id}/approve",
        headers={"X-User-Id": str(parent_id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "declined"
    assert body["balance_cents"] == 1250
    assert "заблокирована" in body["message"].lower()


@pytest.mark.asyncio
async def test_approve_insufficient_funds_declines(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    tx_id = await _add_pending(db_session, amount_cents=5000)

    response = await client.post(
        f"/transactions/{tx_id}/approve",
        headers={"X-User-Id": str(parent_id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "declined"
    assert body["balance_cents"] == 1250
    assert "не хватает" in body["message"].lower()

    listed = await client.get(
        f"/children/{data['family1_child_id']}/transactions",
        headers={"X-User-Id": str(parent_id)},
    )
    assert listed.json()["items"][0]["decline_reason"] == "insufficient_funds"


@pytest.mark.asyncio
async def test_approve_twice_conflict(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    tx_id = await _add_pending(db_session)

    first = await client.post(f"/transactions/{tx_id}/approve", headers={"X-User-Id": str(parent_id)})
    assert first.status_code == 200

    second = await client.post(f"/transactions/{tx_id}/approve", headers={"X-User-Id": str(parent_id)})
    assert second.status_code == 409
    assert second.json()["error"] == "conflict"


@pytest.mark.asyncio
async def test_decline_purchase(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    tx_id = await _add_pending(db_session)

    response = await client.post(
        f"/transactions/{tx_id}/decline",
        headers={"X-User-Id": str(parent_id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "declined"
    assert body["balance_cents"] == 1250
    assert body["message"] == "Покупка отклонена родителем"


@pytest.mark.asyncio
async def test_child_cannot_approve_purchase(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    tx_id = await _add_pending(db_session)

    response = await client.post(
        f"/transactions/{tx_id}/approve",
        headers={"X-User-Id": str(data["family1_child_id"])},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"


@pytest.mark.asyncio
async def test_approve_other_family_forbidden(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    tx_id = await _add_pending(db_session)

    response = await client.post(
        f"/transactions/{tx_id}/approve",
        headers={"X-User-Id": str(data["family2_parent_id"])},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"
