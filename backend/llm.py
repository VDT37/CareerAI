"""One call path for every Bedrock model, through the Mantle endpoint.

anthropic.* model IDs go through AnthropicBedrockMantle (Messages API). Any other
provider prefix goes to the OpenAI-compatible surface on the same Mantle host,
because the Messages surface only serves Claude models. The model ID comes from
BEDROCK_MODEL_ID in .env, so swapping models is an .env edit.
"""
import json
import re

import httpx
from anthropic import AnthropicBedrockMantle

from config import bedrock_region, env


class LLMNotConfigured(Exception):
    pass


def complete(system: str, user: str, max_tokens: int = 1500) -> str:
    region, model, key = bedrock_region(), env("BEDROCK_MODEL_ID"), env("BEDROCK_API_KEY")
    if not (region and model):
        raise LLMNotConfigured("Set BEDROCK_REGION and BEDROCK_MODEL_ID (backend/.env locally, project settings on Vercel)")

    if model.startswith("anthropic."):
        # api_key=None falls back to the standard AWS credential chain (SigV4)
        client = AnthropicBedrockMantle(aws_region=region, api_key=key or None, timeout=60)
        msg = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in msg.content if b.type == "text")

    if not key:
        raise LLMNotConfigured("Non-Claude Mantle models need BEDROCK_API_KEY")
    r = httpx.post(
        f"https://bedrock-mantle.{region}.api.aws/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        },
        timeout=60,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def complete_json(system: str, user: str, max_tokens: int = 1500):
    """Ask for JSON only and parse the first JSON object or array in the reply."""
    text = complete(system + "\n\nReply with valid JSON only. No prose, no markdown fences.", user, max_tokens)
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    starts = [i for i in (text.find("{"), text.find("[")) if i != -1]
    if not starts:
        raise ValueError(f"No JSON in model reply: {text[:200]}")
    start = min(starts)
    end = max(text.rfind("}"), text.rfind("]"))
    return json.loads(text[start : end + 1])
