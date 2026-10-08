"""Optional shared state in Upstash Redis (REST API), for Vercel, where each request
can land on a fresh serverless instance. Without the Upstash variables the app keeps
state in memory, as it does locally."""
import json

import httpx

from config import env

KEY = "careerai:demo-state"


def _creds() -> tuple[str, str]:
    # Vercel's Upstash integration injects the KV_* names; a direct Upstash setup uses UPSTASH_*
    url = env("KV_REST_API_URL") or env("UPSTASH_REDIS_REST_URL")
    token = env("KV_REST_API_TOKEN") or env("UPSTASH_REDIS_REST_TOKEN")
    return url.rstrip("/"), token


def enabled() -> bool:
    return all(_creds())


def load() -> dict | None:
    url, token = _creds()
    r = httpx.get(f"{url}/get/{KEY}", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    r.raise_for_status()
    raw = r.json().get("result")
    return json.loads(raw) if raw else None


def save(state: dict) -> None:
    url, token = _creds()
    r = httpx.post(f"{url}/set/{KEY}", headers={"Authorization": f"Bearer {token}"},
                   content=json.dumps(state, ensure_ascii=False).encode(), timeout=10)
    r.raise_for_status()
