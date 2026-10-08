"""UK Career Navigator demo API. State is loaded from data/seed.json and kept in memory
locally, or in Upstash Redis on Vercel (see store.py). POST /api/reset restores the seed
before each demo run."""
import copy
import hmac
import json
import logging
from collections.abc import MutableMapping
from contextvars import ContextVar
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import ai
import analytics
import store
import voice
from config import env, llm_configured, voice_configured

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("main")
# Fixed demo date, matching TODAY in frontend/src/ui.jsx, so new items land in the seeded week
DEMO_TODAY = "2026-10-08"
SEED = json.loads((Path(__file__).parent / "data" / "seed.json").read_text(encoding="utf-8"))


def fresh_state() -> dict:
    s = copy.deepcopy(SEED)
    s["ai_families"] = None
    s["persona"]["pitch"] = None
    return s


_local = fresh_state()  # the in-memory state used locally
_current: ContextVar[dict] = ContextVar("state", default=_local)


class _State(MutableMapping):
    """The demo state for the current request. Locally this is one shared dict; with Redis
    the middleware loads a copy per request and saves it back after a successful write."""
    def _d(self) -> dict: return _current.get()
    def __getitem__(self, k): return self._d()[k]
    def __setitem__(self, k, v): self._d()[k] = v
    def __delitem__(self, k): del self._d()[k]
    def __iter__(self): return iter(self._d())
    def __len__(self): return len(self._d())


state = _State()
app = FastAPI(title="UK Career Navigator")


@app.middleware("http")
async def passcode_and_state(request: Request, call_next):
    if not request.url.path.startswith("/api"):
        return await call_next(request)
    code = env("DEMO_PASSCODE")
    if code and not hmac.compare_digest(request.headers.get("x-demo-passcode", ""), code):
        return JSONResponse({"detail": "Enter the demo passcode."}, status_code=401)
    if not store.enabled():
        return await call_next(request)
    try:
        data = await run_in_threadpool(store.load) or fresh_state()
    except Exception:
        log.exception("Redis load failed, using in-memory state for this request")
        return await call_next(request)
    token = _current.set(data)
    try:
        response = await call_next(request)
    finally:
        _current.reset(token)
    if request.method != "GET" and response.status_code < 400:
        try:
            await run_in_threadpool(store.save, data)
        except Exception:
            log.exception("Redis save failed")
    return response


def reset_state():
    state.clear()
    state.update(fresh_state())


def _find(collection: str, item_id: str) -> dict:
    item = next((x for x in state[collection] if x["id"] == item_id), None)
    if not item:
        raise HTTPException(404, f"{collection} item {item_id} not found")
    return item


def _next_id(collection: str, prefix: str) -> str:
    nums = [int(x["id"][len(prefix):]) for x in state[collection] if x["id"][len(prefix):].isdigit()]
    return f"{prefix}{max(nums, default=0) + 1}"


# ---------- state ----------

@app.get("/api/state")
def get_state():
    return dict(state) | {
        "stats": analytics.compute(state),
        "config": {
            "llm": llm_configured(),
            "model": env("BEDROCK_MODEL_ID") or None,
            "voice": {"onboarding": voice_configured("onboarding"), "interviewer": voice_configured("interviewer")},
        },
    }


@app.post("/api/reset")
def reset():
    reset_state()
    return {"ok": True}


@app.post("/api/tasks/{task_id}/toggle")
def toggle_task(task_id: str):
    t = _find("week_plan", task_id)
    t["done"] = not t["done"]
    return t


class FamilySelection(BaseModel):
    ids: list[str]


@app.post("/api/families/select")
def select_families(body: FamilySelection):
    state["selected_families"] = body.ids
    return {"ok": True}


class NewApplication(BaseModel):
    company: str
    role: str
    family_id: str
    cv_version: str
    source: str
    days_after_posting: int = 1
    stage: str = "applied"


@app.post("/api/applications")
def add_application(body: NewApplication):
    a = body.model_dump() | {"id": _next_id("applications", "a"), "applied_on": DEMO_TODAY}
    state["applications"].append(a)
    return a


class StageUpdate(BaseModel):
    stage: str


@app.patch("/api/applications/{app_id}")
def update_application(app_id: str, body: StageUpdate):
    a = _find("applications", app_id)
    a["stage"] = body.stage
    return a


@app.post("/api/contacts/{contact_id}/status")
def contact_status(contact_id: str, body: StageUpdate):
    c = _find("contacts", contact_id)
    c["status"] = body.stage
    return c


@app.post("/api/events/{event_id}/rsvp")
def rsvp(event_id: str):
    ev = _find("events", event_id)
    ev["rsvp"] = not ev["rsvp"]
    return ev


@app.post("/api/peers/{peer_id}/request")
def request_peer(peer_id: str):
    peer = _find("peers", peer_id)
    peer["status"] = "requested"
    return peer


@app.post("/api/buddies/{buddy_id}/nudge")
def nudge(buddy_id: str):
    b = next((m for m in state["buddy_group"]["members"] if m["id"] == buddy_id), None)
    if not b:
        raise HTTPException(404, "buddy not found")
    b["nudged"] = True
    state["buddy_group"]["feed"].insert(0, {"who": state["persona"]["name"], "when": "Just now",
                                            "text": f"Nudged {b['name'].split()[0]}: you're {b['total'] - b['done']} tasks from this week's goal."})
    return b


# ---------- voice ----------

@app.get("/api/voice/token")
def voice_token(agent: str, transport: str = "webrtc"):
    if agent not in voice.AGENT_ENV:
        raise HTTPException(400, "agent must be onboarding or interviewer")
    if not voice_configured(agent):
        raise HTTPException(503, "Voice agent not set up. Add ELEVENLABS_API_KEY to backend/.env and run setup_agents.py.")
    try:
        if transport == "websocket":
            return {"signed_url": voice.signed_url(agent)}
        return {"token": voice.conversation_token(agent)}
    except Exception as e:
        raise HTTPException(502, f"ElevenLabs token request failed: {e}")


@app.get("/api/voice/transcript/{conversation_id}")
def voice_transcript(conversation_id: str):
    try:
        return {"turns": voice.fetch_transcript(conversation_id)}
    except Exception as e:
        raise HTTPException(502, f"Could not fetch transcript: {e}")


# ---------- live AI ----------

class Transcript(BaseModel):
    transcript: str
    job_id: str | None = None
    source: str = "voice"  # voice or paste, for the journal
    interview_type: str = "Job-specific interview"


def log_journal(entry_type: str, title: str, who: str, summary: str, points=(), actions=(), scores=None):
    """Every coach call, mock interview and peer chat lands in the Journal automatically."""
    entry = {"id": _next_id("journal", "jn"), "date": DEMO_TODAY, "type": entry_type, "title": title,
             "with": who, "summary": summary, "points": list(points), "actions": list(actions), "new": True}
    if scores:
        entry["scores"] = scores
    state["journal"].insert(0, entry)


@app.post("/api/ai/evidence")
def ai_evidence(body: Transcript):
    if len(body.transcript.strip()) < 20:
        raise HTTPException(400, "Say or paste a bit more about your background first.")
    res = ai.extract_evidence(body.transcript, state["persona"])
    new_items = []
    for item in res["data"].get("items", []):
        item["uk_version"] = item["uk_version"] or item["raw"] or item["title"]
        if not item["uk_version"]:
            continue  # nothing usable in this item
        item["title"] = item["title"] or item["uk_version"][:60]
        item = item | {"id": _next_id("evidence", "e"), "source": "voice onboarding", "new": True}
        state["evidence"].insert(0, item)
        new_items.append(item)
    if res["data"].get("pitch"):
        state["persona"]["pitch"] = res["data"]["pitch"]
    if new_items:
        log_journal("coach", "Background call with your careers coach" if body.source == "voice" else "Profile built from your pasted background",
                    "Careers coach", f"{len(new_items)} achievements captured and rewritten for UK employers.",
                    points=[i["title"] for i in new_items], actions=["Review your profile and add missing numbers"])
    return res | {"items": new_items}


@app.post("/api/ai/families")
def ai_families():
    res = ai.suggest_families(state["evidence"], state["persona"])
    state["ai_families"] = res["data"].get("families", [])
    return res


class JobRef(BaseModel):
    job_id: str


@app.post("/api/ai/tailor")
def ai_tailor(body: JobRef):
    job = _find("jobs", body.job_id)
    family = _find("role_families", job["family_id"])
    res = ai.tailor(job, family, state["evidence"], state["persona"])
    name = res["data"].get("cv_version_name") or f"{family['name']} v1"
    if not any(cv["name"] == name for cv in state["cv_versions"]):
        state["cv_versions"].append({"id": _next_id("cv_versions", "cv"), "name": name, "family_id": family["id"]})
    return res


class EvidenceRef(BaseModel):
    evidence_id: str


@app.post("/api/ai/star")
def ai_star(body: EvidenceRef):
    item = _find("evidence", body.evidence_id)
    res = ai.star(item)
    story = res["data"] | {"id": _next_id("stories", "s"), "evidence_id": item["id"], "new": True}
    state["stories"].insert(0, story)
    return res | {"story": story}


@app.post("/api/ai/interview-feedback")
def ai_interview(body: Transcript):
    job = _find("jobs", body.job_id or "j2")
    res = ai.interview_feedback(body.transcript, job, state["persona"], body.interview_type)
    d = res["data"]
    log_journal("interview", f"{body.interview_type}: {job['title']}, {job['company']}", "Mock interviewer",
                d.get("summary", ""), d.get("strengths", []), d.get("fixes", []), d.get("scores"))
    return res


class ToneRequest(BaseModel):
    text: str
    mode: str = "decode"


@app.post("/api/ai/tone")
def ai_tone(body: ToneRequest):
    return ai.tone(body.text, body.mode)


class ContactRef(BaseModel):
    contact_id: str


@app.post("/api/ai/outreach")
def ai_outreach(body: ContactRef):
    contact = _find("contacts", body.contact_id)
    job = next((j for j in state["jobs"] if j["company"] == contact["company"]), None)
    pitch = state["persona"].get("pitch") or f"{state['persona']['course']}, previously {state['persona']['previous_role']}."
    return ai.outreach(contact, state["persona"], pitch, job)


@app.post("/api/ai/diagnosis")
def ai_diagnosis():
    stats = analytics.compute(state)
    return ai.explain_diagnosis(stats["findings"], stats, state["persona"])


class PeerNotes(BaseModel):
    peer_id: str
    notes: str


@app.post("/api/ai/peer-notes")
def ai_peer_notes(body: PeerNotes):
    if len(body.notes.strip()) < 20:
        raise HTTPException(400, "Jot down a few lines about the chat first.")
    peer = _find("peers", body.peer_id)
    res = ai.peer_notes(body.notes, peer, state["persona"])
    d = res["data"]
    me = state["persona"]["name"]
    state["peer_sessions"].insert(0, {"id": _next_id("peer_sessions", "ps"), "date": DEMO_TODAY, "people": [me, peer["name"]],
                                      "format": "Peer chat", "what": d["what_was_done"], "new": True,
                                      "notes": {"summary": d["summary"], "discussed": d["discussed"], "actions": d["actions"]}})
    peer["status"] = "met"
    log_journal("peer", f"Peer chat with {peer['name']}", peer["name"], d["summary"], d["discussed"], d["actions"])
    return res
