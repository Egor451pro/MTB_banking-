"""Тесты демо-песочниц: у каждого посетителя (заголовок X-Demo-Session) своя база."""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app import db
from app.main import app


@pytest_asyncio.fixture
async def sandbox_client(tmp_path, monkeypatch):
    """Клиент без подмены get_db: базы-песочницы создаются во временной папке"""
    monkeypatch.setattr(db, "DEMO_DIR", tmp_path)
    db._demo_makers.clear()
    db._demo_engines.clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    for eng in list(db._demo_engines.values()):
        await eng.dispose()
    db._demo_makers.clear()
    db._demo_engines.clear()


async def _login(client: AsyncClient, session: str, name: str) -> dict:
    r = await client.post("/login", json={"login": name}, headers={"X-Demo-Session": session})
    assert r.status_code == 200
    return r.json()


@pytest.mark.asyncio
async def test_each_session_gets_its_own_seeded_family(sandbox_client, tmp_path):
    parent = await _login(sandbox_client, "alpha1", "мама")
    assert parent["name"]
    await _login(sandbox_client, "beta22", "мама")

    assert (tmp_path / "alpha1.db").exists()
    assert (tmp_path / "beta22.db").exists()


@pytest.mark.asyncio
async def test_changes_in_one_session_do_not_leak_to_another(sandbox_client):
    mama_a = await _login(sandbox_client, "alpha1", "мама")
    mama_b = await _login(sandbox_client, "beta22", "мама")
    kids_a = (await sandbox_client.get("/family", headers={"X-Demo-Session": "alpha1", "X-User-Id": str(mama_a["id"])})).json()["children"]
    kid = kids_a[0]["id"]
    before = kids_a[0]["card"]["balance_cents"]

    r = await sandbox_client.post(
        f"/children/{kid}/topup", json={"amount_cents": 5000},
        headers={"X-Demo-Session": "alpha1", "X-User-Id": str(mama_a["id"])},
    )
    assert r.status_code == 200

    kids_b = (await sandbox_client.get("/family", headers={"X-Demo-Session": "beta22", "X-User-Id": str(mama_b["id"])})).json()["children"]
    assert kids_b[0]["card"]["balance_cents"] == before                       # у второго посетителя ничего не изменилось
    kids_a2 = (await sandbox_client.get("/family", headers={"X-Demo-Session": "alpha1", "X-User-Id": str(mama_a["id"])})).json()["children"]
    assert kids_a2[0]["card"]["balance_cents"] == before + 5000


@pytest.mark.asyncio
async def test_reset_only_affects_own_session(sandbox_client):
    mama_a = await _login(sandbox_client, "alpha1", "мама")
    mama_b = await _login(sandbox_client, "beta22", "мама")
    ha = {"X-Demo-Session": "alpha1", "X-User-Id": str(mama_a["id"])}
    hb = {"X-Demo-Session": "beta22", "X-User-Id": str(mama_b["id"])}
    kid = (await sandbox_client.get("/family", headers=ha)).json()["children"][0]["id"]
    base = (await sandbox_client.get("/family", headers=hb)).json()["children"][0]["card"]["balance_cents"]
    await sandbox_client.post(f"/children/{kid}/topup", json={"amount_cents": 700}, headers=ha)
    await sandbox_client.post(f"/children/{kid}/topup", json={"amount_cents": 900}, headers=hb)

    assert (await sandbox_client.post("/demo/reset", headers=ha)).status_code == 200

    a = (await sandbox_client.get("/family", headers=ha)).json()["children"][0]["card"]["balance_cents"]
    b = (await sandbox_client.get("/family", headers=hb)).json()["children"][0]["card"]["balance_cents"]
    assert a == base                   # у первого вернулось к начальному
    assert b == base + 900             # у второго осталось как было


def test_bad_session_code_is_ignored():
    class R:
        headers = {"x-demo-session": "../../etc/passwd"}
    assert db.demo_code(R()) is None
    R.headers = {"x-demo-session": "ok12ab"}
    assert db.demo_code(R()) == "ok12ab"
