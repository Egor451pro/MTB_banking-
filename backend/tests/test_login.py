import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_mama(client: AsyncClient, seed_test_data):
    response = await client.post("/login", json={"login": "мама"})
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seed_test_data["family1_parent_id"]
    assert body["role"] == "parent"
    assert body["name"] == "Мама Иванова"


@pytest.mark.asyncio
async def test_login_misha_case_insensitive(client: AsyncClient, seed_test_data):
    response = await client.post("/login", json={"login": "  МИША  "})
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == seed_test_data["family1_child_id"]
    assert body["role"] == "child"
    assert body["name"] == "Миша"


@pytest.mark.asyncio
async def test_login_unknown_user(client: AsyncClient, seed_test_data):
    response = await client.post("/login", json={"login": "никто"})
    assert response.status_code == 404
    body = response.json()
    assert body["error"] == "not_found"
    assert "не найден" in body["message"].lower()
