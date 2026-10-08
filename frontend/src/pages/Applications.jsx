import { useState } from 'react'
import { Plus } from 'lucide-react'
import { patch, post } from '../api'
import { AiBadge, FallbackNote, Meter, PageHead, TODAY, fmtDate, pct, useAction } from '../ui'

const STAGES = [['applied', 'Applied'], ['no_response', 'No reply'], ['rejected', 'Rejected at CV'], ['screening', 'Phone screen'], ['interview', 'Interview'], ['rejected_after_interview', 'Rejected after interview'], ['offer', 'Offer']]
const COLUMNS = [
  { key: 'applied', label: 'Applied', stages: ['applied'] },
  { key: 'no_response', label: 'No reply', stages: ['no_response'] },
  { key: 'screening', label: 'Phone screen', stages: ['screening'] },
  { key: 'interview', label: 'Interview', stages: ['interview'] },
  { key: 'offer', label: 'Offer', stages: ['offer'] },
  { key: 'rejected', label: 'Rejected', stages: ['rejected', 'rejected_after_interview'] },
]
const RESPONDED = new Set(['screening', 'interview', 'rejected_after_interview', 'offer'])
const KIND = { cv: 'CV and tailoring', story: 'Storytelling', network: 'Network', direction: 'Direction', timing: 'Timing' }
const SOURCES = ['Company site', 'Referral', 'LinkedIn Easy Apply', 'Indeed', 'Bright Network']
const WEEKLY_GOAL = 5

const monday = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

function WeeklyProgress({ s }) {
  const thisWeek = monday(TODAY.toISOString().slice(0, 10))
  const weeks = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(`${thisWeek}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7 * i)
    weeks.push(d.toISOString().slice(0, 10))
  }
  const byWeek = Object.fromEntries(weeks.map((w) => [w, { applied: 0, replies: 0 }]))
  for (const a of s.applications) {
    const w = byWeek[monday(a.applied_on)]
    if (w) { w.applied += 1; w.replies += RESPONDED.has(a.stage) ? 1 : 0 }
  }
  const max = Math.max(WEEKLY_GOAL, ...Object.values(byWeek).map((w) => w.applied))
  const now = byWeek[thisWeek]
  const fast = s.applications.filter((a) => monday(a.applied_on) === thisWeek && a.days_after_posting <= 2).length
  const tasks = s.week_plan.filter((t) => t.done).length

  return (
    <section className="card">
      <div className="row"><h2>Weekly progress</h2><span className="spacer" /><span className="small muted">Week of {fmtDate(thisWeek, { day: 'numeric', month: 'long' })}</span></div>
      <div className="grid cols-2" style={{ marginTop: 14, alignItems: 'end' }}>
        <div className="stack" style={{ gap: 14 }}>
          <div>
            <div className="row" style={{ alignItems: 'baseline' }}><span style={{ fontSize: 30, fontWeight: 750, color: 'var(--green)' }}>{now.applied}</span><span className="muted">of {WEEKLY_GOAL} applications this week</span></div>
            <div style={{ marginTop: 6 }}><Meter value={(now.applied / WEEKLY_GOAL) * 100} /></div>
          </div>
          <div className="stats4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div><b>{fast}</b><span>within 48 hours</span></div>
            <div><b>{tasks}/{s.week_plan.length}</b><span>plan tasks done</span></div>
            <div><b>{s.streak_weeks}</b><span>week streak</span></div>
          </div>
        </div>
        <div>
          <div className="week-bars" aria-label="Applications per week">
            {weeks.map((w) => {
              const v = byWeek[w]
              return (
                <div key={w} className={`wb ${w === thisWeek ? 'current' : ''}`} title={`${v.applied} applied, ${v.replies} replied`}>
                  <span>{v.applied}</span>
                  <span className="bar" style={{ height: `${(v.applied / max) * 90}px` }}>
                    <span className="resp" style={{ height: `${(v.replies / max) * 90}px` }} />
                  </span>
                  <span>{fmtDate(w)}</span>
                </div>
              )
            })}
          </div>
          <div className="legend" style={{ marginTop: 8 }}><span><i style={{ background: 'var(--green-line)' }} />Applied</span><span><i style={{ background: 'var(--green)' }} />Got a reply</span></div>
        </div>
      </div>
    </section>
  )
}

function Board({ s, fam, refresh }) {
  const [over, setOver] = useState(null)
  const setStage = async (id, stage) => { await patch(`/api/applications/${id}`, { stage }); refresh() }
  const drop = (e, col) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const app = s.applications.find((a) => a.id === id)
    if (app && !col.stages.includes(app.stage)) setStage(id, col.stages[0])
  }
  const apps = [...s.applications].sort((a, b) => b.applied_on.localeCompare(a.applied_on))

  return (
    <div className="board">
      {COLUMNS.map((col) => {
        const cards = apps.filter((a) => col.stages.includes(a.stage))
        return (
          <div key={col.key} className={`col ${over === col.key ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key) }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, col)}>
            <div className="col-head">{col.label}<span className="n">{cards.length}</span></div>
            {cards.map((a) => (
              <article key={a.id} className={`app-card ${a.applied_on === TODAY.toISOString().slice(0, 10) ? 'new' : ''}`} draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}>
                <div className="top">
                  <span className="logo">{a.company[0]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="role">{a.role}</div>
                    <div className="co">{a.company}</div>
                  </div>
                </div>
                <div className="foot"><span className="chip">{fam[a.family_id]}</span></div>
                <div className="foot">{a.cv_version} CV, via {a.source}</div>
                <div className="foot">
                  <span>{fmtDate(a.applied_on)}</span>
                  <span className="spacer" />
                  <select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)} aria-label={`Stage for ${a.company}`}>
                    {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function AddApplication({ s, refresh, notify, close }) {
  const [form, setForm] = useState({ company: '', role: '', family_id: s.selected_families[0] || 'rf1', cv_version: s.cv_versions.at(-1).name, source: 'Company site', days_after_posting: 1 })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    if (!form.company || !form.role) return
    await post('/api/applications', { ...form, days_after_posting: +form.days_after_posting })
    await refresh()
    notify(`Added ${form.role} at ${form.company}`)
    close()
  }
  return (
    <form className="card form-row" onSubmit={submit} style={{ marginBottom: 16 }}>
      <label className="field">Company<input type="text" value={form.company} onChange={set('company')} style={{ width: 160 }} autoFocus /></label>
      <label className="field">Role<input type="text" value={form.role} onChange={set('role')} style={{ width: 160 }} /></label>
      <label className="field">Role family<select value={form.family_id} onChange={set('family_id')}>{s.role_families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="field">CV version<select value={form.cv_version} onChange={set('cv_version')}>{s.cv_versions.map((c) => <option key={c.id}>{c.name}</option>)}</select></label>
      <label className="field">Source<select value={form.source} onChange={set('source')}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="field">Days after posting<input type="number" min={0} value={form.days_after_posting} onChange={set('days_after_posting')} style={{ width: 90 }} /></label>
      <button className="btn" type="submit">Add</button>
      <button className="btn ghost" type="button" onClick={close}>Cancel</button>
    </form>
  )
}

function Bars({ title, rows }) {
  const max = Math.max(...rows.map((r) => r.response_rate), 0.01)
  return (
    <section className="card">
      <h3>{title}</h3>
      <div style={{ marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.key ?? r.label} className="hbar">
            <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span className="track"><span className={r.responses === 0 ? 'zero' : ''} style={{ width: `${(r.response_rate / max) * 100}%` }} /></span>
            <span><b>{pct(r.response_rate)}</b> <span className="muted">{r.responses}/{r.applied}</span></span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Applications({ s, refresh, go, notify }) {
  const [adding, setAdding] = useState(false)
  const st = s.stats
  const review = useAction(() => post('/api/ai/diagnosis'))
  const fam = Object.fromEntries(s.role_families.map((f) => [f.id, f.name]))
  const r = review.result?.data

  return (
    <>
      <PageHead title="Applications" lede="Every application with its role family, CV version, source and stage. Drag a card when you hear back; the tracker uses this to tell you what to fix.">
        <button className="btn" onClick={() => setAdding(true)}><Plus size={16} />Add application</button>
      </PageHead>
      {adding && <AddApplication s={s} refresh={refresh} notify={notify} close={() => setAdding(false)} />}

      <WeeklyProgress s={s} />

      <div className="section"><Board s={s} fam={fam} refresh={refresh} /></div>

      <section className="card section">
        <div className="row">
          <h2>What to fix</h2>
          <span className="spacer" />
          <button className="btn ghost" disabled={review.loading} onClick={() => review.run()}>{review.loading ? 'Reviewing your week' : 'Weekly review with AI'}</button>
        </div>
        <p className="sub">Patterns in your applications, each pointing to the part of the app that fixes it.</p>
        {r && (
          <div className="card tint" style={{ marginBottom: 14 }}>
            <div className="row"><h3 style={{ flex: 1 }}>{r.headline}</h3><AiBadge res={review.result} /></div>
            <FallbackNote res={review.result} />
            <div className="grid cols-2" style={{ marginTop: 10, gap: 10 }}>
              <p className="small"><span className="strong">Working: </span>{r.working}</p>
              <p className="small"><span className="strong">Biggest problem: </span>{r.problem}</p>
              <p className="small"><span className="strong">One change for the next batch: </span>{r.one_change}</p>
              <p className="small"><span className="strong">How you will know it worked: </span>{r.signal}</p>
            </div>
          </div>
        )}
        {st.findings.length === 0 && <p className="muted">Nothing to fix right now. Keep the weekly routine going.</p>}
        <div className="list">
          {st.findings.map((f) => (
            <div key={f.id} className="finding">
              <div>
                <span className="kind">{KIND[f.type]}</span>
                <h3>{f.title}</h3>
                <p className="ev">{f.evidence}</p>
                <p className="act">{f.action}</p>
              </div>
              <button className="btn ghost small" onClick={() => go(f.link.page, f.link.tab)}>{f.link.label}</button>
            </div>
          ))}
        </div>
      </section>

      <div className="section-head section"><h2>Insights</h2><p>{st.funnel.applied} applications, {pct(st.funnel.response_rate)} reply rate, {st.funnel.interviews} interviews, {st.funnel.offers} offers.</p></div>
      <div className="grid cols-2">
        <Bars title="Reply rate by role family" rows={st.by_family} />
        <Bars title="Reply rate by CV version" rows={st.by_cv} />
        <Bars title="Reply rate by source" rows={st.by_source} />
        <Bars title={`Speed: you apply ${st.timing.avg_days} days after posting on average`} rows={[st.timing.fast, st.timing.slow]} />
      </div>
    </>
  )
}
