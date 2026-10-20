import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_task_confirm_increases_balance_and_xp(client: AsyncClient, seed_test_data):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    create_response = await client.post(
        "/tasks",
        headers={"X-User-Id": str(parent_id)},
        json={
            "assigned_to": child_id,
            "title": "Убрать комнату",
            "reward_cents": 200,
            "xp_reward": 30,
            "due_date": None,
        },
    )
    assert create_response.status_code == 201
    task_id = create_response.json()["id"]

    done_response = await client.post(f"/tasks/{task_id}/done", headers={"X-User-Id": str(child_id)})
    assert done_response.status_code == 200
    assert done_response.json()["status"] == "done"

    confirm_response = await client.post(f"/tasks/{task_id}/confirm", headers={"X-User-Id": str(parent_id)})
    assert confirm_response.status_code == 200
    body = confirm_response.json()
    assert body["status"] == "confirmed"
    assert body["balance_cents"] == 1450
    assert body["xp"] == 130


@pytest.mark.asyncio
async def test_task_done_after_confirm_is_conflict(client: AsyncClient, seed_test_data):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    create_response = await client.post(
        "/tasks",
        headers={"X-User-Id": str(parent_id)},
        json={
            "assigned_to": child_id,
            "title": "Вынести мусор",
            "reward_cents": 200,
            "xp_reward": 30,
            "due_date": None,
        },
    )
    task_id = create_response.json()["id"]

    await client.post(f"/tasks/{task_id}/done", headers={"X-User-Id": str(child_id)})
    await client.post(f"/tasks/{task_id}/confirm", headers={"X-User-Id": str(parent_id)})

    second_done = await client.post(f"/tasks/{task_id}/done", headers={"X-User-Id": str(child_id)})
    assert second_done.status_code == 409
    assert second_done.json()["error"] == "conflict"

    profile = await client.get(f"/children/{child_id}", headers={"X-User-Id": str(parent_id)})
    assert profile.status_code == 200
    # Награда начислена один раз: 1250 + 200, XP 100 + 30
    assert profile.json()["card"]["balance_cents"] == 1450
    assert profile.json()["level"]["xp"] == 130
