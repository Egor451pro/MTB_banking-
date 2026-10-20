"""Тесты бонуса родителя к накоплениям: начисляется сразу при взносе, с месячным лимитом."""
import pytest
from httpx import AsyncClient

PARENT = {"X-User-Id": "1"}
CHILD = {"X-User-Id": "2"}


async def _goal_with_bonus(client: AsyncClient, percent: int) -> int:
    created = await client.post("/goals", json={"title": "Велосипед", "target_cents": 50000}, headers=CHILD)
    goal_id = created.json()["id"]
    if percent:
        r = await client.put(f"/goals/{goal_id}/bonus", json={"parent_bonus_percent": percent}, headers=PARENT)
        assert r.status_code == 200
    return goal_id


@pytest.mark.asyncio
async def test_deposit_adds_parent_bonus(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_bonus(client, 10)

    r = await client.post(f"/goals/{goal_id}/deposit", json={"amount_cents": 1000}, headers=CHILD)

    assert r.status_code == 200
    body = r.json()
    assert body["bonus_cents"] == 100                # 10% от 10 BYN
    assert body["saved_cents"] == 1100               # взнос + бонус
    assert body["card_balance_cents"] == 250         # с карты списан только взнос
    assert body["bonus_left_cents"] == 900           # 10 BYN лимит минус 1 BYN бонуса


@pytest.mark.asyncio
async def test_no_bonus_when_percent_is_zero(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_bonus(client, 0)

    r = await client.post(f"/goals/{goal_id}/deposit", json={"amount_cents": 1000}, headers=CHILD)

    assert r.status_code == 200
    assert r.json()["bonus_cents"] == 0
    assert r.json()["saved_cents"] == 1000


@pytest.mark.asyncio
async def test_bonus_is_limited_per_month(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_bonus(client, 100)

    first = await client.post(f"/goals/{goal_id}/deposit", json={"amount_cents": 1250}, headers=CHILD)
    assert first.json()["bonus_cents"] == 1000       # 100% от 12,50 BYN, но не больше лимита 10 BYN
    assert first.json()["bonus_left_cents"] == 0

    await client.post("/children/2/topup", json={"amount_cents": 5000}, headers=PARENT)
    second = await client.post(f"/goals/{goal_id}/deposit", json={"amount_cents": 500}, headers=CHILD)

    assert second.status_code == 200
    assert second.json()["bonus_cents"] == 0         # лимит месяца исчерпан
    assert second.json()["saved_cents"] == 1250 + 1000 + 500


@pytest.mark.asyncio
async def test_goals_list_shows_bonus_and_month_left(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_bonus(client, 10)
    await client.post(f"/goals/{goal_id}/deposit", json={"amount_cents": 1000}, headers=CHILD)

    r = await client.get("/children/2/goals", headers=PARENT)

    assert r.status_code == 200
    body = r.json()
    assert body["items"][0]["bonus_cents"] == 100
    assert body["bonus_month_cap_cents"] == 1000
    assert body["bonus_month_left_cents"] == 900
