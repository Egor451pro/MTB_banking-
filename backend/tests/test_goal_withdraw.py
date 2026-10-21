"""Тесты: родитель снимает деньги с копилки ребенка, они возвращаются на карту."""
import pytest
from httpx import AsyncClient

PARENT = {"X-User-Id": "1"}
CHILD = {"X-User-Id": "2"}


async def _goal_with_savings(client: AsyncClient, target: int, deposit: int) -> int:
    goal_id = (await client.post("/goals", json={"title": "Велосипед", "target_cents": target}, headers=CHILD)).json()["id"]
    r = await client.post(f"/goals/{goal_id}/deposit", json={"amount_cents": deposit}, headers=CHILD)
    assert r.status_code == 200
    return goal_id


@pytest.mark.asyncio
async def test_parent_withdraw_returns_money_to_card(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_savings(client, 50000, 1000)

    r = await client.post(f"/goals/{goal_id}/withdraw", json={"amount_cents": 400}, headers=PARENT)

    assert r.status_code == 200
    body = r.json()
    assert body["withdrawn_cents"] == 400
    assert body["saved_cents"] == 600
    assert body["card_balance_cents"] == 250 + 400   # 250 осталось после взноса (см. test_goal_bonus), плюс снятое


@pytest.mark.asyncio
async def test_withdraw_more_than_saved_is_rejected(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_savings(client, 50000, 1000)

    r = await client.post(f"/goals/{goal_id}/withdraw", json={"amount_cents": 1001}, headers=PARENT)

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_child_cannot_withdraw(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_savings(client, 50000, 1000)

    r = await client.post(f"/goals/{goal_id}/withdraw", json={"amount_cents": 100}, headers=CHILD)

    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_withdraw_reopens_done_goal(client: AsyncClient, seed_test_data):
    goal_id = await _goal_with_savings(client, 1000, 1000)   # цель сразу достигнута

    r = await client.post(f"/goals/{goal_id}/withdraw", json={"amount_cents": 500}, headers=PARENT)

    assert r.json()["status"] == "active"
