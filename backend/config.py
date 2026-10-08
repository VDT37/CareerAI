"""Settings read from backend/.env on every call, so edits (for example agent IDs
written by setup_agents.py) apply without restarting the server."""
import os
from pathlib import Path

from dotenv import dotenv_values

ENV_PATH = Path(__file__).parent / ".env"


def env(name: str, default: str = "") -> str:
    values = dotenv_values(ENV_PATH) if ENV_PATH.exists() else {}
    value = (values.get(name) or os.environ.get(name) or default).strip()
    return "" if value.startswith("your-") else value  # unfilled .env.example placeholder


def llm_configured() -> bool:
    return bool(env("AWS_REGION") and env("BEDROCK_MODEL_ID"))


def voice_configured(agent: str) -> bool:
    key = {"onboarding": "ELEVENLABS_ONBOARDING_AGENT_ID", "interviewer": "ELEVENLABS_INTERVIEWER_AGENT_ID"}[agent]
    return bool(env("ELEVENLABS_API_KEY") and env(key))
