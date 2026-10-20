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
