import pytest
from httpx import AsyncClient

from app.models import Limit, LimitPeriod


@pytest.mark.asyncio
async def test_get_limits(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]
    db_session.add(Limit(child_id=child_id, category=None, period=LimitPeriod.DAY, amount_cents=1000, is_blocked=False))
    db_session.add(Limit(child_id=child_id, category="games", period=LimitPeriod.DAY, amount_cents=0, is_blocked=True))
    await db_session.commit()

    response = await client.get(f"/children/{child_id}/limits", headers={"X-User-Id": str(parent_id)})
    assert response.status_code == 200
    assert len(response.json()["items"]) == 2


@pytest.mark.asyncio
async def test_put_limits_forbid_adult18_unlock(client: AsyncClient, seed_test_data):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    response = await client.put(
        f"/children/{child_id}/limits",
        headers={"X-User-Id": str(parent_id)},
        json={
            "items": [
                {"category": "adult18", "period": "day", "amount_cents": 1000, "is_blocked": False},
            ]
        },
    )
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"
