from datetime import datetime, timedelta

import pytest
import pytz
from httpx import AsyncClient


def _expected_next_date(period: str) -> str:
    minsk = pytz.timezone("Europe/Minsk")
    day = datetime.now(minsk).date() + timedelta(days=1)
    if period == "week":
        while day.weekday() != 0:
            day += timedelta(days=1)
    return day.isoformat()


@pytest.mark.asyncio
async def test_get_allowance_default_inactive(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.get(
        f"/children/{data['family1_child_id']}/allowance",
        headers={"X-User-Id": str(data["family1_parent_id"])},
    )
    assert response.status_code == 200
    assert response.json() == {
        "amount_cents": 0,
        "period": "week",
        "active": False,
        "next_date": None,
    }


@pytest.mark.asyncio
async def test_put_and_pay_allowance(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    child_id = data["family1_child_id"]

    put = await client.put(
        f"/children/{child_id}/allowance",
        headers={"X-User-Id": str(parent_id)},
        json={"amount_cents": 1000, "period": "week", "active": True},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["amount_cents"] == 1000
    assert body["period"] == "week"
    assert body["active"] is True
    assert body["next_date"] == _expected_next_date("week")

    pay = await client.post(
        f"/children/{child_id}/allowance/pay",
        headers={"X-User-Id": str(parent_id)},
    )
    assert pay.status_code == 200
    assert pay.json()["balance_cents"] == 2250

    txs = await client.get(
        f"/children/{child_id}/transactions",
        headers={"X-User-Id": str(parent_id)},
    )
    last = txs.json()["items"][0]
    assert last["direction"] == "in"
    assert last["merchant"] == "Карманные деньги"
    assert last["amount_cents"] == 1000


@pytest.mark.asyncio
async def test_put_active_zero_amount_rejected(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.put(
        f"/children/{data['family1_child_id']}/allowance",
        headers={"X-User-Id": str(data["family1_parent_id"])},
        json={"amount_cents": 0, "period": "week", "active": True},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


@pytest.mark.asyncio
async def test_pay_without_setup_rejected(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.post(
        f"/children/{data['family1_child_id']}/allowance/pay",
        headers={"X-User-Id": str(data["family1_parent_id"])},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


@pytest.mark.asyncio
async def test_child_cannot_put_allowance(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.put(
        f"/children/{data['family1_child_id']}/allowance",
        headers={"X-User-Id": str(data["family1_child_id"])},
        json={"amount_cents": 1000, "period": "week", "active": True},
    )
    assert response.status_code == 403
