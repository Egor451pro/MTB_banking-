import pytest
from httpx import AsyncClient

from app.models import Lesson


async def _seed_lessons(db_session) -> None:
    db_session.add(
        Lesson(
            id=1,
            title="Что такое бюджет",
            description="Как распределить карманные деньги на неделю",
            content=["Бюджет — это план.", "Делите деньги на дни."],
            question="Как поступить разумнее?",
            options=["Потратить всё", "Разделить на каждый день", "Отдать другу"],
            answer_index=1,
            explanation="По 1–2 BYN в день — и денег хватит на всю неделю.",
            xp_reward=20,
            points_reward=50,
        )
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_child_lists_lessons_without_answer(client: AsyncClient, seed_test_data, db_session):
    await _seed_lessons(db_session)
    child_id = seed_test_data["family1_child_id"]

    response = await client.get("/lessons", headers={"X-User-Id": str(child_id)})
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "Что такое бюджет"
    assert items[0]["completed"] is False
    assert "answer_index" not in items[0]
    assert "explanation" not in items[0]
    assert items[0]["options"][1] == "Разделить на каждый день"


@pytest.mark.asyncio
async def test_parent_needs_child_id_for_lessons(client: AsyncClient, seed_test_data, db_session):
    await _seed_lessons(db_session)
    parent_id = seed_test_data["family1_parent_id"]

    missing = await client.get("/lessons", headers={"X-User-Id": str(parent_id)})
    assert missing.status_code == 422

    ok = await client.get(
        f"/lessons?child_id={seed_test_data['family1_child_id']}",
        headers={"X-User-Id": str(parent_id)},
    )
    assert ok.status_code == 200
    assert len(ok.json()["items"]) == 1


@pytest.mark.asyncio
async def test_answer_lesson_awards_once(client: AsyncClient, seed_test_data, db_session):
    await _seed_lessons(db_session)
    child_id = seed_test_data["family1_child_id"]

    wrong = await client.post(
        "/lessons/1/answer",
        headers={"X-User-Id": str(child_id)},
        json={"option_index": 0},
    )
    assert wrong.status_code == 200
    assert wrong.json()["correct"] is False
    assert wrong.json()["xp"] == 100
    assert wrong.json()["points"] == 0

    first = await client.post(
        "/lessons/1/answer",
        headers={"X-User-Id": str(child_id)},
        json={"option_index": 1},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["correct"] is True
    assert body["xp"] == 120
    assert body["level"] == 3
    assert body["points"] == 50
    assert "хватит" in body["explanation"]

    second = await client.post(
        "/lessons/1/answer",
        headers={"X-User-Id": str(child_id)},
        json={"option_index": 1},
    )
    assert second.status_code == 200
    assert second.json()["correct"] is True
    assert second.json()["xp"] == 120
    assert second.json()["points"] == 50

    listed = await client.get("/lessons", headers={"X-User-Id": str(child_id)})
    assert listed.json()["items"][0]["completed"] is True


@pytest.mark.asyncio
async def test_parent_cannot_answer_lesson(client: AsyncClient, seed_test_data, db_session):
    await _seed_lessons(db_session)
    response = await client.post(
        "/lessons/1/answer",
        headers={"X-User-Id": str(seed_test_data["family1_parent_id"])},
        json={"option_index": 1},
    )
    assert response.status_code == 403
