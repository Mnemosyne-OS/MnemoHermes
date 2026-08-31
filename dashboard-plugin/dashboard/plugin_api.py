"""Mnemosyne OS dashboard plugin - loopback liveness probes.

Read-only and secret-free by design: two TCP connects to the local
surfaces Mnemosyne OS may expose (the desktop app's REST gateway, the
Hermes brain proxy). No key is sent, no vault content ever crosses this
boundary - memory governance lives in Mnemosyne OS, behind its own
authenticated surfaces. This route only answers "is something listening".
"""
import asyncio

from fastapi import APIRouter

router = APIRouter()

BRAIN_PROXY_PORT = 7439  # doc 81 - the opt-in brain endpoint
REST_GATEWAY_PORT = 7438  # the desktop app's local REST surface
PROBE_TIMEOUT_S = 0.4


async def _listening(port: int) -> bool:
    """True when something accepts a TCP connect on 127.0.0.1:port."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection("127.0.0.1", port), timeout=PROBE_TIMEOUT_S
        )
    except Exception:
        return False
    writer.close()
    try:
        await writer.wait_closed()
    except Exception:
        pass
    return True


@router.get("/status")
async def status():
    brain, app_alive = await asyncio.gather(
        _listening(BRAIN_PROXY_PORT), _listening(REST_GATEWAY_PORT)
    )
    return {
        "brainProxy": "answering" if brain else "off",
        "mnemosyneApp": "answering" if app_alive else "not-detected",
        "ports": {"brainProxy": BRAIN_PROXY_PORT, "restGateway": REST_GATEWAY_PORT},
    }
