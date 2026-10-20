import pytest
from httpx import AsyncClient

from app.models import Transaction, TransactionDirection, TransactionStatus


@pytest.mark.asyncio
async def test_get_transactions_returns_latest_first(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    db_session.add(
        Transaction(
            account_id=10,
            amount_cents=100,
            direction=TransactionDirection.OUT,
            category="food",
            merchant="Первая",
            is_online=False,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
        )
    )
    db_session.add(
        Transaction(
            account_id=10,
            amount_cents=200,
            direction=TransactionDirection.OUT,
            category="transport",
            merchant="Вторая",
            is_online=False,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
        )
    )
    await db_session.commit()

    response = await client.get(
        f"/children/{child_id}/transactions?limit=1",
        headers={"X-User-Id": str(parent_id)},
    )
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["amount_cents"] == 200
    created_at = response.json()["items"][0]["created_at"]
    assert created_at.endswith("+00:00") or created_at.endswith("Z")


@pytest.mark.asyncio
async def test_family_package_creates_child(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]

    response = await client.post(
        "/family/package",
        headers={"X-User-Id": str(parent_id)},
        json={
            "child_name": "Петя",
            "child_birth_date": "2014-05-10",
            "consents": ["card_issue", "moby_access", "personal_data"],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["child_id"] > 0
    assert body["card_id"] > 0
    assert body["age_group"] == "7-13"


@pytest.mark.asyncio
async def test_family_package_requires_personal_data_consent(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.post(
        "/family/package",
        headers={"X-User-Id": str(data["family1_parent_id"])},
        json={
            "child_name": "Петя",
            "child_birth_date": "2014-05-10",
            "consents": ["card_issue", "moby_access"],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"
    assert "соглас" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_family_package_teen_requires_info_sharing(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.post(
        "/family/package",
        headers={"X-User-Id": str(data["family1_parent_id"])},
        json={
            "child_name": "Оля",
            "child_birth_date": "2010-03-01",
            "consents": ["card_issue", "moby_access", "personal_data"],
        },
    )
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


@pytest.mark.asyncio
async def test_family_package_rejects_online_payments_for_young_child(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.post(
        "/family/package",
        headers={"X-User-Id": str(data["family1_parent_id"])},
        json={
            "child_name": "Петя",
            "child_birth_date": "2014-05-10",
            "consents": ["card_issue", "moby_access", "personal_data", "online_payments"],
        },
    )
    assert response.status_code == 422
    assert "14" in response.json()["message"]


@pytest.mark.asyncio
async def test_family_package_teen_defaults(client: AsyncClient, seed_test_data):
    data = seed_test_data
    parent_id = data["family1_parent_id"]
    response = await client.post(
        "/family/package",
        headers={"X-User-Id": str(parent_id)},
        json={
            "child_name": "Оля",
            "child_birth_date": "2010-03-01",
            "consents": ["card_issue", "moby_access", "personal_data", "teen_info_sharing", "online_payments"],
        },
    )
    assert response.status_code == 201
    child_id = response.json()["child_id"]
    assert response.json()["age_group"] == "14-17"

    perms = await client.get(f"/children/{child_id}/permissions", headers={"X-User-Id": str(parent_id)})
    mapped = {item["key"]: item for item in perms.json()["items"]}
    assert mapped["online_payments"]["enabled"] is True
    assert mapped["goals"]["enabled"] is True
    assert mapped["partner_offers"]["enabled"] is False
    assert mapped["virtual_card"]["enabled"] is False
    assert mapped["virtual_card"]["locked_reason"] is None
