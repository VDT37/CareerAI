"""Tracker analytics and the rule-based diagnosis that closes the loop.
Each finding points back to the module that fixes it."""
from collections import defaultdict

RESPONDED = {"screening", "interview", "rejected_after_interview", "offer"}
INTERVIEWED = {"interview", "rejected_after_interview", "offer"}
JOB_BOARDS = {"LinkedIn Easy Apply", "Indeed", "Bright Network"}


def plural(n, word):
    return f"{n} {word}{'' if n == 1 else 's'}"


def _row(label, apps):
    n = len(apps)
    responses = sum(a["stage"] in RESPONDED for a in apps)
    return {
        "label": label,
        "applied": n,
        "responses": responses,
        "interviews": sum(a["stage"] in INTERVIEWED for a in apps),
        "offers": sum(a["stage"] == "offer" for a in apps),
        "response_rate": round(responses / n, 2) if n else 0,
    }


def group(apps, key, labels=None):
    buckets = defaultdict(list)
    for a in apps:
        buckets[a[key]].append(a)
    rows = [_row((labels or {}).get(k, k), v) | {"key": k} for k, v in buckets.items()]
    return sorted(rows, key=lambda r: -r["applied"])


def visa_fit(job, rules):
    if not job["sponsor"]:
        return {"label": "Graduate Route only", "tone": "warn",
                "reason": "Not a licensed sponsor. Fine on the Graduate Route, but you would need to move to sponsor later."}
    if job["salary"] >= rules["general_threshold"]:
        return {"label": "Visa-ready", "tone": "good", "reason": "Licensed sponsor and above the general salary threshold."}
    if job["salary"] >= rules["new_entrant_threshold"]:
        return {"label": "Visa-ready (new entrant)", "tone": "good",
                "reason": "Licensed sponsor and above the new-entrant rate that applies when you switch from a Student or Graduate visa."}
    return {"label": "Check salary", "tone": "bad",
            "reason": f"Sponsor, but £{job['salary']:,} is below the £{rules['new_entrant_threshold']:,} new-entrant rate."}


def compute(state):
    apps = state["applications"]
    fam_names = {f["id"]: f["name"] for f in state["role_families"]}
    by_family = group(apps, "family_id", fam_names)
    by_cv = group(apps, "cv_version")
    by_source = group(apps, "source")
    fast = [a for a in apps if a["days_after_posting"] <= 2]
    slow = [a for a in apps if a["days_after_posting"] > 2]
    timing = {"fast": _row("Within 48 hours", fast), "slow": _row("After 48 hours", slow),
              "avg_days": round(sum(a["days_after_posting"] for a in apps) / len(apps), 1) if apps else 0}

    jobs = [j | {"visa": visa_fit(j, state["visa_rules"])} for j in state["jobs"]]
    findings = diagnose(state, by_family, by_source, timing, jobs, fam_names)
    return {
        "funnel": _row("All", apps),
        "by_family": by_family,
        "by_cv": by_cv,
        "by_source": by_source,
        "timing": timing,
        "jobs": jobs,
        "findings": findings,
    }


def diagnose(state, by_family, by_source, timing, jobs, fam_names):
    apps = state["applications"]
    findings = []

    # 1. Low response rate for a role family: CV or tailoring problem
    for row in by_family:
        if row["applied"] >= 4 and row["response_rate"] < 0.15:
            cvs = {a["cv_version"] for a in apps if a["family_id"] == row["key"]}
            own_cv = any(cv["family_id"] == row["key"] and cv["name"] in cvs for cv in state["cv_versions"])
            detail = "" if own_cv else f" Every one used your {', '.join(sorted(cvs))} CV, which is not written for this role."
            findings.append({
                "id": f"cv-{row['key']}", "type": "cv", "severity": 3,
                "title": f"{row['label']} applications are not getting replies",
                "evidence": f"{plural(row['responses'], 'response')} from {plural(row['applied'], 'application')}.{detail}",
                "action": f"Tailor a {row['label']} CV from your Evidence Bank, then send the next batch with it.",
                "link": {"page": "prep", "tab": "cv", "label": "Tailor a CV"},
            })

    # 2. Interviews but no offers: storytelling or communication problem
    funnel = _row("All", apps)
    if funnel["interviews"] >= 3 and funnel["offers"] == 0:
        weak = [s for s in state["stories"] if s["strength"] != "strong"]
        findings.append({
            "id": "story", "type": "story", "severity": 3,
            "title": "You reach interviews but they are not turning into offers",
            "evidence": f"{plural(funnel['interviews'], 'interview')}, 0 offers. {len(weak)} of your STAR stories are missing a number or detail.",
            "action": "Run a mock interview and fix the weak STAR stories before your Clearwater Utilities interview.",
            "link": {"page": "prep", "tab": "interview", "label": "Practise an interview"},
        })

    # 3. Referrals work but are rarely used: network problem
    ref = next((r for r in by_source if r["key"] == "Referral"), None)
    boards = [a for a in apps if a["source"] in JOB_BOARDS]
    board_row = _row("Job boards", boards)
    if ref and ref["response_rate"] > board_row["response_rate"] and ref["applied"] / max(len(apps), 1) < 0.2:
        findings.append({
            "id": "network", "type": "network", "severity": 2,
            "title": "Referrals work for you, but you rarely use them",
            "evidence": f"Referrals got replies {ref['responses']} of {ref['applied']} times. Job boards: {board_row['responses']} of {board_row['applied']}.",
            "action": "Message two alumni inside companies that are hiring now and ask for a 15-minute chat.",
            "link": {"page": "reach", "label": "Open outreach"},
        })

    # 4. Few visa-ready roles in a chosen family: direction problem
    for fid in state["selected_families"]:
        ready = [j for j in jobs if j["family_id"] == fid and j["visa"]["tone"] == "good"]
        if len(ready) < 2:
            findings.append({
                "id": f"dir-{fid}", "type": "direction", "severity": 1,
                "title": f"Few visa-ready {fam_names.get(fid, fid)} roles in your matches",
                "evidence": f"{len(ready)} matched role{'s' if len(ready) != 1 else ''} this week from a licensed sponsor above the salary threshold.",
                "action": "Add another location or a related title, or swap in a role family with more sponsors.",
                "link": {"page": "direction", "label": "Adjust direction"},
            })

    # 5. Slow applications: timing problem
    if timing["avg_days"] > 3 and timing["fast"]["response_rate"] > timing["slow"]["response_rate"]:
        findings.append({
            "id": "timing", "type": "timing", "severity": 2,
            "title": "You apply too long after roles are posted",
            "evidence": f"Average {timing['avg_days']} days after posting. Within 48 hours: {timing['fast']['responses']} of {timing['fast']['applied']} replied. Later: {timing['slow']['responses']} of {timing['slow']['applied']}.",
            "action": "Check new matches daily and apply within 48 hours.",
            "link": {"page": "direction", "label": "See new matches"},
        })

    return sorted(findings, key=lambda f: -f["severity"])
