"""ElevenLabs Agents helpers. The API key stays here; the browser only gets a
short-lived conversation token for a WebRTC session."""
import httpx

from config import env

API = "https://api.elevenlabs.io/v1/convai"
AGENT_ENV = {"onboarding": "ELEVENLABS_ONBOARDING_AGENT_ID", "interviewer": "ELEVENLABS_INTERVIEWER_AGENT_ID"}


def _headers() -> dict:
    return {"xi-api-key": env("ELEVENLABS_API_KEY")}


def conversation_token(agent: str) -> str:
    agent_id = env(AGENT_ENV[agent])
    r = httpx.get(f"{API}/conversation/token", params={"agent_id": agent_id}, headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def signed_url(agent: str) -> str:
    """WebSocket fallback for browsers or networks that block the WebRTC (LiveKit) host."""
    agent_id = env(AGENT_ENV[agent])
    r = httpx.get(f"{API}/conversation/get-signed-url", params={"agent_id": agent_id}, headers=_headers(), timeout=15)
    r.raise_for_status()
    return r.json()["signed_url"]


def fetch_transcript(conversation_id: str) -> list[dict]:
    """Server-side transcript, used when the browser did not capture one."""
    r = httpx.get(f"{API}/conversations/{conversation_id}", headers=_headers(), timeout=15)
    r.raise_for_status()
    turns = r.json().get("transcript") or []
    return [{"role": t.get("role"), "message": t.get("message")} for t in turns if t.get("message")]
