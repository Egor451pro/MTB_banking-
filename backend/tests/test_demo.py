import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_demo_reset_returns_ok(client: AsyncClient):
    response = await client.post("/demo/reset")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
