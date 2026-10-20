"""
Тесты для эндпоинтов целей (goals)
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_goal_as_child(client: AsyncClient, seed_test_data):
    """
    Ребенок может создать цель.
    Ожидаем: статус 201, цель создана с правильными полями.
    """
    data = seed_test_data
    child_id = data["family1_child_id"]  # Миша (id=2)
    
    response = await client.post(
        "/goals",
        json={
            "title": "Nintendo Switch",
            "target_cents": 50000
        },
        headers={"X-User-Id": str(child_id)}
    )
    
    assert response.status_code == 201
    json_data = response.json()
    assert json_data["title"] == "Nintendo Switch"
    assert json_data["target_cents"] == 50000
    assert json_data["saved_cents"] == 0
    assert json_data["parent_bonus_percent"] == 0
    assert json_data["status"] == "active"
    assert "id" in json_data


@pytest.mark.asyncio
async def test_create_goal_as_parent_forbidden(client: AsyncClient, seed_test_data):
    """
    Родитель НЕ может создать цель (только для детей).
    Ожидаем: статус 403.
    """
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    
    response = await client.post(
        "/goals",
        json={
            "title": "Что-то",
            "target_cents": 10000
        },
        headers={"X-User-Id": str(parent_id)}
    )
    
    assert response.status_code == 403
    json_data = response.json()
    assert json_data["error"] == "forbidden"


@pytest.mark.asyncio
async def test_get_child_goals(client: AsyncClient, seed_test_data):
    """
    Получить список целей ребенка.
    """
    data = seed_test_data
    child_id = data["family1_child_id"]
    
    # Сначала создаем цель
    await client.post(
        "/goals",
        json={"title": "Велосипед", "target_cents": 30000},
        headers={"X-User-Id": str(child_id)}
    )
    
    # Получаем список
    response = await client.get(
        f"/children/{child_id}/goals",
        headers={"X-User-Id": str(child_id)}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert "items" in json_data
    assert len(json_data["items"]) >= 1
    assert json_data["items"][0]["title"] == "Велосипед"


@pytest.mark.asyncio
async def test_deposit_to_goal(client: AsyncClient, seed_test_data):
    """
    Ребенок может внести деньги в свою цель.
    """
    data = seed_test_data
    child_id = data["family1_child_id"]  # Миша с балансом 1250
    
    # Создаем цель
    create_response = await client.post(
        "/goals",
        json={"title": "Цель", "target_cents": 5000},
        headers={"X-User-Id": str(child_id)}
    )
    goal_id = create_response.json()["id"]
    
    # Вносим деньги
    response = await client.post(
        f"/goals/{goal_id}/deposit",
        json={"amount_cents": 500},
        headers={"X-User-Id": str(child_id)}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["saved_cents"] == 500
    assert json_data["card_balance_cents"] == 750  # 1250 - 500
    assert json_data["status"] == "active"


@pytest.mark.asyncio
async def test_deposit_completes_goal(client: AsyncClient, seed_test_data):
    """
    Когда saved_cents достигает target_cents, статус становится 'done'.
    """
    data = seed_test_data
    child_id = data["family1_child_id"]
    
    # Создаем маленькую цель
    create_response = await client.post(
        "/goals",
        json={"title": "Маленькая цель", "target_cents": 500},
        headers={"X-User-Id": str(child_id)}
    )
    goal_id = create_response.json()["id"]
    
    # Вносим ровно target_cents
    response = await client.post(
        f"/goals/{goal_id}/deposit",
        json={"amount_cents": 500},
        headers={"X-User-Id": str(child_id)}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "done"


@pytest.mark.asyncio
async def test_deposit_insufficient_funds(client: AsyncClient, seed_test_data):
    """
    Попытка внести больше, чем есть на карте.
    Ожидаем: ошибка 422.
    """
    data = seed_test_data
    child_id = data["family1_child_id"]  # Баланс 1250
    
    create_response = await client.post(
        "/goals",
        json={"title": "Цель", "target_cents": 10000},
        headers={"X-User-Id": str(child_id)}
    )
    goal_id = create_response.json()["id"]
    
    response = await client.post(
        f"/goals/{goal_id}/deposit",
        json={"amount_cents": 5000},  # Больше чем на карте
        headers={"X-User-Id": str(child_id)}
    )
    
    assert response.status_code == 422
    json_data = response.json()
    assert json_data["error"] == "validation_error"
    assert "не хватает" in json_data["message"].lower()


@pytest.mark.asyncio
async def test_set_bonus_as_parent(client: AsyncClient, seed_test_data):
    """
    Родитель может установить бонус к цели своего ребенка.
    """
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    child_id = data["family1_child_id"]
    
    # Ребенок создает цель
    create_response = await client.post(
        "/goals",
        json={"title": "Цель", "target_cents": 10000},
        headers={"X-User-Id": str(child_id)}
    )
    goal_id = create_response.json()["id"]
    
    # Родитель устанавливает бонус
    response = await client.put(
        f"/goals/{goal_id}/bonus",
        json={"parent_bonus_percent": 15},
        headers={"X-User-Id": str(parent_id)}
    )
    
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["parent_bonus_percent"] == 15


@pytest.mark.asyncio
async def test_set_bonus_other_family_forbidden(client: AsyncClient, seed_test_data):
    """
    Родитель НЕ может установить бонус к цели ребенка из чужой семьи.
    """
    data = seed_test_data
    parent1_id = data["family1_parent_id"]
    child2_id = data["family2_child_id"]  # Ребенок из другой семьи
    
    # Ребенок из семьи 2 создает цель
    create_response = await client.post(
        "/goals",
        json={"title": "Цель", "target_cents": 10000},
        headers={"X-User-Id": str(child2_id)}
    )
    goal_id = create_response.json()["id"]
    
    # Родитель из семьи 1 пытается установить бонус
    response = await client.put(
        f"/goals/{goal_id}/bonus",
        json={"parent_bonus_percent": 10},
        headers={"X-User-Id": str(parent1_id)}
    )
    
    assert response.status_code == 403
    json_data = response.json()
    assert json_data["error"] == "forbidden"
