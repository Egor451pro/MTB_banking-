import pytest
from httpx import AsyncClient


def h(uid: int) -> dict:
    return {"X-User-Id": str(uid)}


@pytest.mark.asyncio
async def test_empty_beaver(client: AsyncClient, seed_test_data):
    child = seed_test_data["family1_child_id"]
    r = await client.get(f"/children/{child}/beaver", headers=h(child))
    assert r.status_code == 200
    assert r.json() == {"data": None, "updated_at": 0}


@pytest.mark.asyncio
async def test_child_saves_and_parent_reads(client: AsyncClient, seed_test_data):
    child = seed_test_data["family1_child_id"]
    parent = seed_test_data["family1_parent_id"]
    state = {"level": 2, "built": 30}
    r = await client.put(f"/children/{child}/beaver", headers=h(child), json={"data": state, "updated_at": 100})
    assert r.status_code == 200
    assert r.json()["data"] == state

    r = await client.get(f"/children/{child}/beaver", headers=h(parent))
    assert r.status_code == 200
    assert r.json() == {"data": state, "updated_at": 100}


@pytest.mark.asyncio
async def test_newer_state_wins(client: AsyncClient, seed_test_data):
    child = seed_test_data["family1_child_id"]
    await client.put(f"/children/{child}/beaver", headers=h(child), json={"data": {"level": 3}, "updated_at": 200})
    # Устаревшее состояние с другого устройства не затирает новое
    r = await client.put(f"/children/{child}/beaver", headers=h(child), json={"data": {"level": 1}, "updated_at": 100})
    assert r.status_code == 200
    assert r.json() == {"data": {"level": 3}, "updated_at": 200}


@pytest.mark.asyncio
async def test_parent_cannot_change_beaver(client: AsyncClient, seed_test_data):
    child = seed_test_data["family1_child_id"]
    parent = seed_test_data["family1_parent_id"]
    r = await client.put(f"/children/{child}/beaver", headers=h(parent), json={"data": {}, "updated_at": 1})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_other_family_has_no_access(client: AsyncClient, seed_test_data):
    child = seed_test_data["family1_child_id"]
    other_parent = seed_test_data["family2_parent_id"]
    other_child = seed_test_data["family2_child_id"]
    assert (await client.get(f"/children/{child}/beaver", headers=h(other_parent))).status_code == 403
    r = await client.put(f"/children/{child}/beaver", headers=h(other_child), json={"data": {}, "updated_at": 1})
    assert r.status_code == 403
