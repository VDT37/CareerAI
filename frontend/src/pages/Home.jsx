import { post } from '../api'
import { Avatar, Meter, PAGE_LABEL, PageHead, TODAY, fmtDate, resolvePage } from '../ui'

export default function Home({ s, refresh, go }) {
  const p = s.persona
  const top = s.stats.findings[0]
  const done = s.week_plan.filter((t) => t.done).length
  const days = Math.round((new Date(p.visa_deadline) - TODAY) / 86400000)
  const f = s.stats.funnel
  const seen = new Set()
  const upcoming = [...s.calendar, ...s.events.map((e) => ({ date: e.date, title: e.title }))]
    .filter((c) => new Date(c.date) >= TODAY && !seen.has(c.title.toLowerCase()) && seen.add(c.title.toLowerCase()))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)

  const toggle = async (id) => { await post(`/api/tasks/${id}/toggle`); refresh() }

  return (
    <>
      <PageHead title={`This week, ${p.first_name}`} lede={`Week of ${fmtDate(p.week_of, { day: 'numeric', month: 'long' })}. One or two steps from each part of your search, picked from what your tracker says is not working.`} />

      {top && (
        <section className="card tint next-step">
          <div>
            <p className="kicker">Your next best step</p>
            <h2>{top.action}</h2>
            <p>Why: {top.evidence}</p>
          </div>
          <button className="btn" onClick={() => go(top.link.page, top.link.tab)}>{top.link.label}</button>
        </section>
      )}

      <div className="grid split" style={{ marginTop: 16 }}>
        <section className="card">
          <div className="row">
            <h2>Weekly plan</h2>
            <span className="spacer" />
            <span className="small muted">{done} of {s.week_plan.length} done</span>
          </div>
          <div style={{ margin: '10px 0 16px' }}><Meter value={(done / s.week_plan.length) * 100} /></div>
          <div className="list">
            {s.week_plan.map((t) => {
              const [page] = resolvePage(t.page, t.tab)
              return (
                <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
                  <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={t.text} />
                  <div>
                    <div className="area">{PAGE_LABEL[page]}</div>
                    <div className="t">{t.text}</div>
                    <div className="why">{t.why}</div>
                  </div>
                  <button className="btn ghost small" onClick={() => go(t.page, t.tab)}>Open</button>
                </div>
              )
            })}
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="countdown">
              <span className="num">{days}</span>
              <span>days until your Student visa ends</span>
            </div>
            <p className="small muted" style={{ marginTop: 6 }}>{p.visa}</p>
          </section>

          <section className="card">
            <div className="row"><h2>Your search so far</h2><span className="spacer" /><button className="linkish small" onClick={() => go('applications')}>Applications</button></div>
            <div className="stats4" style={{ marginTop: 12 }}>
              <div><b>{f.applied}</b><span>applied</span></div>
              <div><b>{f.responses}</b><span>replies</span></div>
              <div><b>{f.interviews}</b><span>interviews</span></div>
              <div><b>{f.offers}</b><span>offers</span></div>
            </div>
          </section>

          <section className="card">
            <div className="row"><h2>Streak</h2><span className="spacer" /><span className="small muted">{s.streak_weeks} weeks on plan</span></div>
            <div className="weeks" style={{ margin: '10px 0 12px' }}>
              {[0, 1, 2, 3].map((i) => <span key={i} className={i < s.streak_weeks ? 'on' : ''} />)}
            </div>
            {s.milestones.map((m) => (
              <div key={m.label} className={`milestone ${m.done ? 'done' : ''}`}><span className="tick" />{m.label}</div>
            ))}
          </section>

          <section className="card">
            <div className="row"><h2>Coming up</h2><span className="spacer" /><button className="linkish small" onClick={() => go('networking')}>Events</button></div>
            <div className="list" style={{ marginTop: 12 }}>
              {upcoming.map((c) => (
                <div key={c.title} className="date-row"><span className="d">{fmtDate(c.date)}</span><span>{c.title}</span></div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="row"><h2>{s.buddy_group.name}</h2><span className="spacer" /><button className="linkish small" onClick={() => go('peers')}>Peers</button></div>
            <div className="stack" style={{ marginTop: 12, gap: 10 }}>
              {s.buddy_group.members.map((m) => (
                <div key={m.id} className="row small">
                  <Avatar name={m.name} size="sm" />
                  <span style={{ width: 70 }}>{m.name.split(' ')[0]}</span>
                  <span style={{ flex: 1 }}><Meter value={(m.done / m.total) * 100} /></span>
                  <span className="muted">{m.streak}w</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
