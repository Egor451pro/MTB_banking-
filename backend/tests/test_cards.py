import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_parent_topup_own_child(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    child_id = data["family1_child_id"]

    response = await client.post(
        f"/children/{child_id}/topup",
        headers={"X-User-Id": str(parent_id)},
        json={"amount_cents": 2000},
    )
    assert response.status_code == 200
    assert response.json()["balance_cents"] == 3250

    txs = await client.get(
        f"/children/{child_id}/transactions",
        headers={"X-User-Id": str(parent_id)},
    )
    assert txs.status_code == 200
    last = txs.json()["items"][0]
    assert last["direction"] == "in"
    assert last["merchant"] == "Пополнение от родителя"
    assert last["amount_cents"] == 2000


@pytest.mark.asyncio
async def test_topup_other_family_forbidden(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    other_child_id = data["family2_child_id"]

    response = await client.post(
        f"/children/{other_child_id}/topup",
        headers={"X-User-Id": str(parent_id)},
        json={"amount_cents": 2000},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"


@pytest.mark.asyncio
async def test_block_and_unblock_card(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]

    blocked = await client.post("/cards/10/block", headers={"X-User-Id": str(parent_id)})
    assert blocked.status_code == 200
    assert blocked.json() == {"id": 10, "status": "blocked"}

    unblocked = await client.post("/cards/10/unblock", headers={"X-User-Id": str(parent_id)})
    assert unblocked.status_code == 200
    assert unblocked.json() == {"id": 10, "status": "active"}


@pytest.mark.asyncio
async def test_block_other_family_card_forbidden(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]

    response = await client.post("/cards/11/block", headers={"X-User-Id": str(parent_id)})
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"
