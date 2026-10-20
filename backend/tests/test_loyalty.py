import pytest
from httpx import AsyncClient

from app.models import (
    Consent,
    Limit,
    LimitPeriod,
    Transaction,
    TransactionDirection,
    TransactionStatus,
)


@pytest.mark.asyncio
async def test_loyalty_empty_offers_without_partner_permission(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.get("/loyalty", headers={"X-User-Id": str(data["family1_child_id"])})
    assert response.status_code == 200
    body = response.json()
    assert body["points"] == 0
    assert body["offers"] == []
    assert {item["category"] for item in body["cashback"]} == {"education", "transport", "food", "entertainment"}


@pytest.mark.asyncio
async def test_parent_sees_parent_and_family_offers(client: AsyncClient, seed_test_data):
    data = seed_test_data
    response = await client.get("/loyalty", headers={"X-User-Id": str(data["family1_parent_id"])})
    assert response.status_code == 200
    audiences = {offer["audience"] for offer in response.json()["offers"]}
    assert audiences == {"parent", "family"}
    assert "child" not in audiences


@pytest.mark.asyncio
async def test_cashback_on_approved_payment(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    db_session.add(Limit(child_id=child_id, category=None, period=LimitPeriod.DAY, amount_cents=5000, is_blocked=False))
    await db_session.commit()

    pay = await client.post(
        "/payments/simulate",
        headers={"X-User-Id": str(child_id)},
        json={
            "card_id": 10,
            "amount_cents": 300,
            "category": "food",
            "merchant": "Столовая",
            "is_online": False,
        },
    )
    assert pay.status_code == 200
    assert pay.json()["status"] == "approved"

    loyalty = await client.get("/loyalty", headers={"X-User-Id": str(child_id)})
    assert loyalty.json()["points"] == 6  # floor(300 * 2 / 100)


@pytest.mark.asyncio
async def test_cashback_on_pending_approve(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    tx = Transaction(
        account_id=10,
        amount_cents=500,
        direction=TransactionDirection.OUT,
        category="education",
        merchant="Книжный",
        is_online=True,
        status=TransactionStatus.PENDING,
        decline_reason=None,
    )
    db_session.add(tx)
    await db_session.commit()
    await db_session.refresh(tx)

    response = await client.post(
        f"/transactions/{tx.id}/approve",
        headers={"X-User-Id": str(data["family1_parent_id"])},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "approved"

    loyalty = await client.get("/loyalty", headers={"X-User-Id": str(data["family1_child_id"])})
    assert loyalty.json()["points"] == 25  # floor(500 * 5 / 100)


@pytest.mark.asyncio
async def test_redeem_offer_requires_permission_and_points(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    forbidden = await client.post(
        "/loyalty/offers/2/redeem",
        headers={"X-User-Id": str(child_id)},
    )
    assert forbidden.status_code == 403

    db_session.add(Consent(child_id=child_id, consent_type="partner_offers"))
    await db_session.commit()

    listed = await client.get("/loyalty", headers={"X-User-Id": str(child_id)})
    audiences = {offer["audience"] for offer in listed.json()["offers"]}
    assert audiences == {"child", "family"}

    no_points = await client.post(
        "/loyalty/offers/2/redeem",
        headers={"X-User-Id": str(child_id)},
    )
    assert no_points.status_code == 422
    assert no_points.json()["error"] == "validation_error"

    # Начисляем баллы через PUT прав не получится — пополняем напрямую пользователя
    from app.models import User
    from sqlalchemy import select

    user = (await db_session.execute(select(User).where(User.id == child_id))).scalar_one()
    user.points = 200
    await db_session.commit()

    redeemed = await client.post(
        "/loyalty/offers/2/redeem",
        headers={"X-User-Id": str(child_id)},
    )
    assert redeemed.status_code == 200
    body = redeemed.json()
    assert body["points"] == 50
    assert body["code"].startswith("MT-2")

    missing = await client.post(
        "/loyalty/offers/99/redeem",
        headers={"X-User-Id": str(parent_id)},
    )
    assert missing.status_code == 404
