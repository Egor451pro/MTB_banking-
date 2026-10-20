"""
Тесты для эндпоинта GET /children/{id}
Проверяем права доступа: 200 для своей семьи, 403 для чужой.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_child_profile_same_family_parent(client: AsyncClient, seed_test_data):
    """
    Родитель может просматривать профиль ребенка из своей семьи.
    Ожидаем: статус 200
    """
    data = await seed_test_data
    parent_id = data["family1_parent_id"]  # Мама Иванова (id=1)
    child_id = data["family1_child_id"]    # Миша (id=2)
    
    response = await client.get(
        f"/children/{child_id}",
        headers={"X-User-Id": str(parent_id)}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["id"] == child_id
    assert json_data["name"] == "Миша"
    assert "card" in json_data
    assert "limits_today" in json_data
    assert "level" in json_data


@pytest.mark.asyncio
async def test_get_child_profile_other_family_parent(client: AsyncClient, seed_test_data):
    """
    Родитель НЕ может просматривать профиль ребенка из чужой семьи.
    Ожидаем: статус 403 с ошибкой "forbidden"
    """
    data = await seed_test_data
    parent_id = data["family1_parent_id"]   # Мама Иванова (id=1)
    other_child_id = data["family2_child_id"]  # Ваня из семьи 2 (id=4)
    
    response = await client.get(
        f"/children/{other_child_id}",
        headers={"X-User-Id": str(parent_id)}
    )
    
    assert response.status_code == 403
    json_data = response.json()
    assert json_data["error"] == "forbidden"
    assert "доступа" in json_data["message"].lower()


@pytest.mark.asyncio
async def test_get_child_profile_self(client: AsyncClient, seed_test_data):
    """
    Ребенок может просматривать свой собственный профиль.
    Ожидаем: статус 200
    """
    data = await seed_test_data
    child_id = data["family1_child_id"]  # Миша (id=2)
    
    response = await client.get(
        f"/children/{child_id}",
        headers={"X-User-Id": str(child_id)}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["id"] == child_id
    assert json_data["name"] == "Миша"


@pytest.mark.asyncio
async def test_get_child_profile_other_child(client: AsyncClient, seed_test_data):
    """
    Ребенок НЕ может просматривать профиль другого ребенка.
    Ожидаем: статус 403 с ошибкой "forbidden"
    """
    data = await seed_test_data
    child1_id = data["family1_child_id"]  # Миша (id=2)
    child2_id = data["family2_child_id"]  # Ваня (id=4)
    
    response = await client.get(
        f"/children/{child2_id}",
        headers={"X-User-Id": str(child1_id)}
    )
    
    assert response.status_code == 403
    json_data = response.json()
    assert json_data["error"] == "forbidden"


@pytest.mark.asyncio
async def test_get_child_profile_not_found(client: AsyncClient, seed_test_data):
    """
    Запрос несуществующего ребенка должен возвращать 404.
    """
    data = await seed_test_data
    parent_id = data["family1_parent_id"]
    non_existent_id = 9999
    
    response = await client.get(
        f"/children/{non_existent_id}",
        headers={"X-User-Id": str(parent_id)}
    )
    
    assert response.status_code == 404
    json_data = response.json()
    assert json_data["error"] == "not_found"
