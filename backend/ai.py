"""Every live AI step: one prompt in, JSON out, with a canned fallback so the demo
never dead-ends. Results carry live=True/False so the UI can badge them."""
import json
import logging

from llm import LLMNotConfigured, complete_json

log = logging.getLogger("ai")

BASE = (
    "You are the AI inside a UK career navigator for international students. "
    "Write in British English, plainly and specifically. Never invent employers, numbers "
    "or achievements that are not in the input. No em dashes."
)


def _empty(template):
    if isinstance(template, dict):
        return {k: _empty(v) for k, v in template.items()}
    return [] if isinstance(template, list) else 0 if isinstance(template, int) else ""


def _conform(data, template):
    """Coerce model JSON to the fallback's keys and types, so the UI never meets a
    missing field or a string where it expects a list. Extra keys are kept."""
    if not isinstance(data, dict):
        return _empty(template)
    out = dict(data)
    for k, t in template.items():
        v = data.get(k)
        if isinstance(t, dict):
            out[k] = _conform(v, t)
        elif isinstance(t, list):
            v = v if isinstance(v, list) else [] if v in (None, "") else [v]
            if t and isinstance(t[0], dict):  # list of objects: conform each, wrap bare strings
                first = next(iter(t[0]))
                v = [_conform(x if isinstance(x, dict) else {first: str(x)}, t[0]) for x in v]
            else:
                v = [x if isinstance(x, str) else json.dumps(x, ensure_ascii=False) for x in v]
            out[k] = v
        elif isinstance(t, int) and not isinstance(t, bool):
            try:
                out[k] = int(str(v).split("/")[0].strip())
            except ValueError:
                out[k] = 0
        else:
            out[k] = v if isinstance(v, str) else "" if v is None else str(v)
    return out


def _run(task: str, system: str, user: str, fallback, max_tokens: int = 1500, required: tuple = ()):
    try:
        data = _conform(complete_json(BASE + "\n\n" + system, user, max_tokens), fallback)
        missing = [k for k in required if not data.get(k)]
        if missing:
            raise ValueError(f"model reply had no {', '.join(missing)}")
        return {"data": data, "live": True}
    except LLMNotConfigured as e:
        return {"data": fallback, "live": False, "note": str(e)}
    except Exception as e:  # network, auth, bad JSON: fall back rather than break the demo
        log.exception("AI task %s failed", task)
        return {"data": fallback, "live": False, "note": f"Live call failed ({type(e).__name__}: {str(e)[:160]}). Showing demo result."}


def _j(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1)


# 1. Foundation: background dump to Evidence Bank
def extract_evidence(transcript: str, persona: dict):
    system = (
        "Turn a candidate's spoken or pasted background into Evidence Bank items written for UK employers. "
        "Each item is one achievement. Use only facts, tools, methods and data sources the candidate actually stated; never add detail they did not say. uk_version is a single UK CV bullet: action verb first, result with a number, "
        "scale. If the candidate gave no number, do not make one up: set outcome to 'Add a number: <what to measure>'. "
        "context_note explains something a UK recruiter would not know (an overseas employer, a local term, why it counts) "
        "or gives one UK framing tip."
    )
    user = (
        f"Candidate: {persona['name']}, {persona['course']}.\nBackground transcript:\n{transcript}\n\n"
        'Return {"items":[{"title":str,"raw":str (their own words, short),"uk_version":str,"skills":[str],'
        '"outcome":str,"scale":str,"context_note":str}],'
        '"pitch":str (two sentences in the first person, starting with I am, for networking),'
        '"targets":[str] (roles they mentioned),"visa":str (one line, or "not mentioned")}. 3 to 6 items.'
    )
    fallback = {
        "items": [
            {"title": "Churn dashboard for a UK bank client", "raw": "Power BI dashboards for a UK bank client to track customers closing accounts.",
             "uk_version": "Built a Power BI churn dashboard for a UK bank client, used weekly by around 40 relationship managers and linked to a 6% fall in account closures.",
             "skills": ["Power BI", "SQL", "Stakeholder management"], "outcome": "About 6% fewer closures", "scale": "40 weekly users",
             "context_note": "Infosys is a large Indian IT services firm. Saying the client was a UK bank makes the experience feel local."},
            {"title": "Automated Monday reporting", "raw": "Python scripts for Monday reports, saved maybe twelve hours a week.",
             "uk_version": "Automated weekly reporting in Python, replacing a full day of manual Excel work and saving about 12 hours a week.",
             "skills": ["Python", "Automation"], "outcome": "About 12 hours saved weekly", "scale": "2 analysts' Mondays",
             "context_note": "Time saved is a result UK recruiters understand instantly. Keep the number in the first half of the bullet."},
            {"title": "Charity volunteer database and rota", "raw": "Cleaned a charity's volunteer database and made a rota dashboard.",
             "uk_version": "Volunteer data analyst for an Exeter charity: cleaned the volunteer database and built a rota dashboard.",
             "skills": ["Data cleaning", "Dashboards", "Volunteering"], "outcome": "Add a number: hours saved on rota planning", "scale": "Add a number: database size",
             "context_note": "UK volunteering counts as real experience and gives you a UK referee. List it under Experience."},
        ],
        "pitch": "I'm an MSc Business Analytics student at Exeter with three years as a data analyst on a UK banking account. I build dashboards and automation that people actually use, and I'm looking at analyst and BI roles in the South West and London.",
        "targets": ["Data Analyst", "BI Analyst", "Product Analyst"],
        "visa": "Student visa ends January 2027, Graduate Route next, needs sponsorship long term.",
    }
    return _run("evidence", system, user, fallback, 2500, required=("items",))


# 2. Direction: role families from the Evidence Bank
def suggest_families(evidence: list, persona: dict):
    system = (
        "Propose role families for this candidate in the UK market. Mix: 2 direct fits, 1 or 2 near fits (about 70% overlap), "
        "1 stretch. For each give typical UK job titles, an approximate UK salary range for a graduate or early-career hire, "
        "and how often UK employers in that family sponsor Skilled Worker visas (High, Medium or Low). "
        "Salaries and sponsorship are estimates, keep them conservative."
    )
    user = (
        f"Candidate: {_j({k: persona[k] for k in ('course', 'previous_role', 'visa', 'locations')})}\n"
        f"Evidence: {_j([{k: e.get(k) for k in ('uk_version', 'skills')} for e in evidence])}\n\n"
        'Return {"families":[{"name":str,"fit":"direct"|"near"|"stretch","overlap":int (0-100),"uk_titles":[str],'
        '"salary":str like "£30k to £40k","sponsorship":"High"|"Medium"|"Low","why":str (one sentence tied to their evidence)}]}'
    )
    fallback = {"families": [
        {"name": "Data Analyst", "fit": "direct", "overlap": 90, "uk_titles": ["Data Analyst", "Insight Analyst"], "salary": "£30k to £42k", "sponsorship": "High", "why": "SQL, Power BI and Python on a UK bank account."},
        {"name": "BI Analyst", "fit": "direct", "overlap": 85, "uk_titles": ["BI Analyst", "MI Analyst"], "salary": "£32k to £45k", "sponsorship": "High", "why": "Dashboards that 40 managers used weekly."},
        {"name": "Product Analyst", "fit": "near", "overlap": 70, "uk_titles": ["Product Analyst", "Growth Analyst"], "salary": "£35k to £50k", "sponsorship": "Medium", "why": "Churn work is product thinking, add an A/B test example."},
        {"name": "Operations Research Analyst", "fit": "near", "overlap": 65, "uk_titles": ["Planning Analyst", "Demand Analyst"], "salary": "£32k to £44k", "sponsorship": "Medium", "why": "Your food bank forecasting is demand planning."},
        {"name": "Graduate Data Scientist", "fit": "stretch", "overlap": 55, "uk_titles": ["Graduate Data Scientist"], "salary": "£32k to £45k", "sponsorship": "Medium", "why": "Forecasting dissertation, but needs a stronger ML portfolio."},
    ]}
    return _run("families", system, user, fallback, 1800, required=("families",))


# 3. Preparation: tailored CV + cover letter for one job
def tailor(job: dict, family: dict, evidence: list, persona: dict):
    system = (
        "Tailor a UK CV and cover letter for one job using only the candidate's Evidence Bank. "
        "UK CV rules: two pages, no photo or date of birth, bullets start with an action verb and carry a number. "
        "Pick and rewrite the 4 to 5 most relevant evidence items for this job's language. "
        "Cover letter follows three short paragraphs: why them (specific to the company and role), why you (2 pieces of evidence), "
        "what you will deliver in the first months. Under 220 words total. List honest gaps the candidate should be ready to address."
    )
    user = (
        f"Job: {_j(job)}\nRole family: {family['name']}\nCandidate: {persona['name']}, {persona['course']}, {persona['previous_role']}\n"
        f"Evidence Bank: {_j([{k: e.get(k) for k in ('id', 'uk_version', 'skills', 'outcome')} for e in evidence])}\n\n"
        'Return {"cv_version_name":str (e.g. "Product Analyst v1"),"profile":str (3-line CV profile),'
        '"bullets":[{"text":str,"evidence_id":str}],"keywords":[str] (job keywords now covered),'
        '"cover_letter":{"why_them":str,"why_you":str,"what_you_deliver":str},"gaps":[str]}'
    )
    fallback = {
        "cv_version_name": f"{family['name']} v1 ({job['company']})",
        "profile": f"Analyst with three years' experience on a UK banking account and an MSc in Business Analytics from Exeter. Builds dashboards and models that teams use every week. Looking to bring that to {job['company']} as a {job['title']}.",
        "bullets": [
            {"text": "Built a Power BI churn dashboard for a UK high-street bank, used weekly by 40 relationship managers and linked to a 6% fall in account closures.", "evidence_id": "e1"},
            {"text": "Automated a 15-report weekly pack in Python and SQL, saving 12 hours a week and removing copy-paste errors.", "evidence_id": "e2"},
            {"text": "Forecast weekly demand across 12 food bank sites with time-series models, cutting forecast error by 18%.", "evidence_id": "e4"},
            {"text": "Mentored three graduate analysts and wrote the team's SQL starter guide.", "evidence_id": "e3"},
        ],
        "keywords": ["SQL", "Python", "Dashboards", "Stakeholders", "Retention"],
        "cover_letter": {
            "why_them": f"I'm applying for the {job['title']} role at {job['company']} because it sits close to the decisions the analysis supports. The role description ({job['summary'].rstrip('.')}) is the kind of work I have enjoyed most so far.",
            "why_you": "At Infosys I built a churn dashboard for a UK bank that 40 relationship managers used weekly, and closures fell 6%. I also automated our reporting in Python, saving the team 12 hours a week.",
            "what_you_deliver": "In my first three months I would learn your data, ship one report or analysis people use weekly, and find one manual process worth automating.",
        },
        "gaps": ["No direct A/B testing example yet. Prepare one from the dissertation or a side project."],
    }
    return _run("tailor", system, user, fallback, 2000, required=("bullets", "cover_letter"))


# 4. Preparation: evidence item to STAR story
def star(item: dict):
    system = (
        "Turn one evidence item into a STAR interview story a UK interviewer will score well. "
        "Situation and task one sentence each, action 2 to 3 sentences in first person with what 'I' did, result with the number. "
        "If a number is missing, keep it out and say so in tip."
    )
    user = (
        f"Evidence: {_j(item)}\n\n"
        'Return {"title":str,"competency":str (e.g. Influencing, Problem solving),"situation":str,"task":str,'
        '"action":str,"result":str,"strength":"strong"|"needs a number"|"needs detail","tip":str}'
    )
    bullet = item.get("uk_version") or item.get("raw") or item.get("title", "")
    fallback = {
        "title": item.get("title", ""), "competency": "Problem solving",
        "situation": f"Context: {item.get('raw', '')}", "task": "I needed to deliver a result the team could rely on.",
        "action": f"I {bullet[:1].lower() + bullet[1:]}",
        "result": item.get("outcome") or "Add the result with a number.",
        "strength": "needs detail", "tip": "Add one sentence on why it was hard and what you would do differently.",
    }
    return _run("star", system, user, fallback, 900, required=("situation", "action"))


# 5. Preparation: mock interview transcript to feedback
def interview_feedback(transcript: str, job: dict, persona: dict, interview_type: str = "Job-specific interview"):
    system = (
        "You are a UK hiring manager and interview coach. Score the candidate's answers in a mock interview transcript. "
        "Judge STAR structure, clarity, use of evidence (numbers, own contribution) and UK tone "
        "(confident but understated, no overselling, 'I' for own part). Quote short phrases from the transcript in notes. "
        "If the transcript is very short, say so and score only what is there."
    )
    user = (
        f"Session type: {interview_type}\nRole: {job['title']} at {job['company']}\nCandidate: {persona['name']}\nTranscript:\n{transcript}\n\n"
        'Return {"scores":{"structure":int 1-5,"clarity":int 1-5,"evidence":int 1-5,"uk_tone":int 1-5},'
        '"summary":str (2 sentences),"strengths":[str],"fixes":[str] (max 3, concrete),'
        '"rewrite":{"question":str,"better_answer":str (a stronger STAR answer under 120 words, using only facts from the transcript)},'
        '"uk_tone_notes":[str]}'
    )
    fallback = {
        "scores": {"structure": 3, "clarity": 4, "evidence": 3, "uk_tone": 3},
        "summary": "Clear and friendly, with good material. Answers start with too much background and the result arrives late or without a number.",
        "strengths": ["Natural, polite opening that builds rapport.", "Real UK client example from the bank project."],
        "fixes": [
            "Reach the action within 20 seconds. Cut the company background to one sentence.",
            "End every answer with the number: '40 managers used it weekly and closures fell 6%'.",
            "Say 'I' for your part. 'We did the dashboard' hides your contribution.",
        ],
        "rewrite": {
            "question": "Tell me about a time you influenced a stakeholder.",
            "better_answer": "At Infosys our UK bank client's relationship managers weren't using a new churn dashboard. My job was to get it into their weekly routine. I ran three short sessions with them, rebuilt two views around their own account lists and wrote a one-page guide. Within a quarter 40 managers used it every week, and account closures fell 6% over two quarters.",
        },
        "uk_tone_notes": ["'I am the best fit for this role' reads as overselling in the UK. Try 'I think my bank work fits this role well'."],
    }
    return _run("interview", system, user, fallback, 1600, required=("summary", "fixes"))


# 6. Preparation: UK tone decoder
def tone(text: str, mode: str):
    if mode == "decode":
        system = "Explain what a British workplace or interview phrase really means to an international candidate, and how to respond."
        user = f'Phrase: "{text}"\n\nReturn {{"meaning":str,"how_to_respond":str,"warmth":"positive"|"neutral"|"negative"}}'
        fallback = {"meaning": "Usually polite and noncommittal. British speakers soften both praise and criticism, so read the context.",
                    "how_to_respond": "Thank them and ask one specific follow-up question to find out where you stand.", "warmth": "neutral"}
    else:
        system = ("Rewrite the candidate's sentence in a UK professional tone: confident but understated, no overselling, "
                  "polite without being overly formal. Keep their facts.")
        user = f'Sentence: "{text}"\n\nReturn {{"rewrite":str,"changes":[str] (what changed and why, max 3)}}'
        fallback = {"rewrite": "I think my experience building dashboards for a UK bank would fit this role well, and I'd be glad to talk through it.",
                    "changes": ["Softened absolute claims like 'the best'.", "Kept the evidence and dropped the superlatives."]}
    return _run("tone", system, user, fallback, 600, required=("meaning",) if mode == "decode" else ("rewrite",))


# 7. Reach: outreach message for one contact
def outreach(contact: dict, persona: dict, pitch: str, job: dict | None):
    system = (
        "Draft a short LinkedIn message from an international student to a UK professional asking for a 15-minute chat "
        "for advice, not a job. Under 80 words, warm, specific to their role and shared link, one clear ask, no flattery. "
        "Also draft a 2-sentence follow-up for two weeks later."
    )
    user = (
        f"Sender: {persona['name']}, {persona['course']}. Pitch: {pitch}\n"
        f"Recipient: {_j(contact)}\nRelevant open role at their company: {_j(job) if job else 'none'}\n\n"
        'Return {"subject":str,"message":str,"follow_up":str}'
    )
    fallback = {
        "subject": f"Exeter MSc student, quick question about {contact['role']} work",
        "message": f"Hi {contact['name'].split()[0]}, I'm {persona['first_name']}, an MSc Business Analytics student at Exeter. I spent three years as a data analyst on a UK banking account and I'm now looking at {contact['role']} roles. I'd really value 15 minutes to hear how you got into {contact['company']} and what the team looks for. Would a short call in the next couple of weeks work?",
        "follow_up": f"Hi {contact['name'].split()[0]}, just following up in case my last message got buried. Still keen to hear about your path into {contact['company']} if you have 15 minutes.",
    }
    return _run("outreach", system, user, fallback, 600, required=("message",))


# 9. Peers: rough notes from a peer chat to a structured session note
def peer_notes(rough: str, peer: dict, persona: dict):
    system = (
        "Turn rough notes from a peer networking chat between two international students into a clean session note. "
        "Use only what the notes say, and keep every person and company name exactly as written. Action items name who does what, with a time if the notes give one."
    )
    user = (
        f"{persona['name']} met {peer['name']} ({peer['headline']}).\nRough notes:\n{rough}\n\n"
        'Return {"what_was_done":str (one line),"summary":str (2 sentences),"discussed":[str],"actions":[str]}'
    )
    first = peer["name"].split()[0]
    fallback = {
        "what_was_done": f"30-minute call with {first} about BI roles and interview prep",
        "summary": f"{first} explained how Avonmere Water's BI interview works and offered an introduction to their BI team. {persona['first_name']} shared the churn dashboard story and they agreed to practise an HR screen.",
        "discussed": ["Avonmere Water BI interview includes a one-hour Power BI task", f"{first} can introduce {persona['first_name']} to the BI team"],
        "actions": [f"{persona['first_name']}: send CV to {first} by Friday", f"{persona['first_name']} and {first}: mock HR screen next Thursday"],
    }
    return _run("peer_notes", system, user, fallback, 700, required=("summary",))


# 8. Diagnosis: turn tracker findings into one coaching note
def explain_diagnosis(findings: list, stats: dict, persona: dict):
    system = (
        "You are a UK careers coach reviewing a candidate's application tracker. Using only the stats and findings given, "
        "write a short weekly review: what is working, the single biggest problem, and ONE specific change for the next "
        "batch of applications, plus what signal would show it worked."
    )
    user = (
        f"Candidate: {persona['name']}, visa deadline {persona['visa_deadline']}\n"
        f"Funnel: {_j(stats['funnel'])}\nBy role family: {_j(stats['by_family'])}\nBy source: {_j(stats['by_source'])}\n"
        f"Timing: {_j(stats['timing'])}\nRule-based findings: {_j(findings)}\n\n"
        'Return {"headline":str (one sentence stating the main finding, not a title),"working":str,"problem":str,"one_change":str,"signal":str}'
    )
    top = findings[0] if findings else None
    fallback = {
        "headline": "Your CV is the bottleneck for Product Analyst roles. Your interviews are close.",
        "working": "Company-site applications and referrals get replies, and you reached 4 interviews in six weeks.",
        "problem": top["evidence"] if top else "Not enough data yet.",
        "one_change": "Send your next 5 Product Analyst applications with a tailored Product Analyst CV, each within 48 hours of posting, and none through Easy Apply.",
        "signal": "At least 1 reply from those 5 within two weeks. If not, switch the third family to Operations or Demand Analyst.",
    }
    return _run("diagnosis", system, user, fallback, 900, required=("headline", "one_change"))
