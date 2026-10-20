from datetime import datetime, timedelta

import pytest
import pytz
from httpx import AsyncClient

from app.models import Limit, LimitPeriod, Transaction, TransactionDirection, TransactionStatus


@pytest.mark.asyncio
async def test_get_child_profile_spent_today_respects_minsk_day_boundary(client: AsyncClient, seed_test_data, db_session):
    data = seed_test_data
    child_id = data["family1_child_id"]
    parent_id = data["family1_parent_id"]

    db_session.add(
        Limit(
            child_id=child_id,
            category=None,
            period=LimitPeriod.DAY,
            amount_cents=1000,
            is_blocked=False,
        )
    )

    minsk_tz = pytz.timezone("Europe/Minsk")
    now_minsk = datetime.now(minsk_tz)
    start_of_day_minsk = now_minsk.replace(hour=0, minute=0, second=0, microsecond=0)

    # 23:30 по Минску вчера -> 20:30 UTC, не должен попадать в "сегодня".
    yesterday_2330_minsk = start_of_day_minsk - timedelta(minutes=30)
    yesterday_2330_utc_naive = yesterday_2330_minsk.astimezone(pytz.utc).replace(tzinfo=None)

    # 00:30 по Минску сегодня -> должен попадать в "сегодня".
    today_0030_minsk = start_of_day_minsk + timedelta(minutes=30)
    today_0030_utc_naive = today_0030_minsk.astimezone(pytz.utc).replace(tzinfo=None)

    db_session.add(
        Transaction(
            account_id=10,
            amount_cents=300,
            direction=TransactionDirection.OUT,
            category="food",
            merchant="Вчера поздно",
            is_online=False,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
            created_at=yesterday_2330_utc_naive,
        )
    )
    db_session.add(
        Transaction(
            account_id=10,
            amount_cents=200,
            direction=TransactionDirection.OUT,
            category="food",
            merchant="Сегодня",
            is_online=False,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
            created_at=today_0030_utc_naive,
        )
    )
    await db_session.commit()

    response = await client.get(f"/children/{child_id}", headers={"X-User-Id": str(parent_id)})
    assert response.status_code == 200
    body = response.json()
    assert body["limits_today"]["spent_cents"] == 200
