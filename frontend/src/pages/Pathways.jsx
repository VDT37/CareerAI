import { useState } from 'react'
import { post } from '../api'
import { AiBadge, FallbackNote, Meter, PageHead, fmtDate, money, posted, useAction } from '../ui'

const FIT = { direct: 'Direct fit', near: 'Near fit', stretch: 'Stretch' }

function OfferCheck({ rules }) {
  const [salary, setSalary] = useState(36000)
  const [sponsor, setSponsor] = useState(true)
  const [newEntrant, setNewEntrant] = useState(true)
  const threshold = newEntrant ? rules.new_entrant_threshold : rules.general_threshold
  let v
  if (!sponsor) v = { tone: 'warn', text: 'You can take this on the Graduate Route, but this employer cannot sponsor you when it ends. Plan a move to a sponsor before your Graduate Route visa runs out.' }
  else if (salary >= threshold) v = { tone: 'good', text: `Visa-viable: a licensed sponsor, and ${money(salary)} is above the ${money(threshold)} ${newEntrant ? 'new-entrant' : 'general'} threshold.` }
  else v = { tone: 'bad', text: `${money(salary)} is ${money(threshold - salary)} below the ${money(threshold)} threshold. Negotiate the salary or check whether a lower going rate applies.` }

  return (
    <section className="card">
      <h2>Offer check</h2>
      <p className="sub">Got an offer? Check it is visa-viable before you accept.</p>
      <div className="row" style={{ alignItems: 'end' }}>
        <label className="field">Salary (£)<input type="number" step={500} value={salary} onChange={(e) => setSalary(+e.target.value)} style={{ width: 120 }} /></label>
        <label className="check"><input type="checkbox" checked={sponsor} onChange={(e) => setSponsor(e.target.checked)} />Licensed sponsor</label>
        <label className="check"><input type="checkbox" checked={newEntrant} onChange={(e) => setNewEntrant(e.target.checked)} />New entrant</label>
      </div>
      <p className={`verdict ${v.tone}`} style={{ marginTop: 12 }}>{v.text}</p>
      <p className="small muted" style={{ marginTop: 8 }}>{rules.note}</p>
    </section>
  )
}

export default function Pathways({ s, refresh, go, notify }) {
  const selected = new Set(s.selected_families)
  const suggest = useAction(() => post('/api/ai/families'))
  const jobs = s.stats.jobs.filter((j) => selected.has(j.family_id)).sort((a, b) => a.posted_days_ago - b.posted_days_ago)

  const toggle = async (id) => {
    const ids = selected.has(id) ? s.selected_families.filter((x) => x !== id) : [...s.selected_families, id]
    await post('/api/families/select', { ids })
    refresh()
  }
  const logApplication = async (j) => {
    const cv = [...s.cv_versions].reverse().find((c) => c.family_id === j.family_id) || s.cv_versions[0]
    await post('/api/applications', {
      company: j.company, role: j.title, family_id: j.family_id, cv_version: cv.name,
      source: j.source === 'LinkedIn' ? 'LinkedIn Easy Apply' : j.source, days_after_posting: j.posted_days_ago,
    })
    await refresh()
    notify(`Added ${j.title} at ${j.company} to Applications`)
  }

  return (
    <>
      <PageHead title="Career pathways" lede="Pick 3 to 5 role families: direct fits, near fits and one stretch. Your choice decides which CV, stories and jobs you see, and every job is checked for visa fit.">
        <button className="btn ghost" disabled={suggest.loading} onClick={() => suggest.run()}>{suggest.loading ? 'Reading your profile' : 'Re-check fit from my profile'}</button>
      </PageHead>

      <div className="grid cols-3">
        {s.role_families.map((f) => (
          <article key={f.id} className={`card family ${selected.has(f.id) ? 'selected' : ''}`}>
            <div className="row">
              <span className="fit">{FIT[f.fit]}</span>
              <span className="spacer" />
              <label className="check"><input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />Targeting</label>
            </div>
            <h3 style={{ fontSize: 17 }}>{f.name}</h3>
            <div className="row small"><span style={{ width: 92 }}>{f.overlap}% overlap</span><span style={{ flex: 1 }}><Meter value={f.overlap} /></span></div>
            <p className="small">{f.why}</p>
            <dl className="kv">
              <dt>UK titles</dt><dd>{f.uk_titles.join(', ')}</dd>
              <dt>Salary</dt><dd>{f.salary}</dd>
              <dt>Sponsors</dt><dd>{f.sponsorship} likelihood</dd>
            </dl>
          </article>
        ))}
      </div>

      {suggest.result && (
        <section className="card section">
          <div className="row"><h2>What the AI sees in your profile</h2><span className="spacer" /><AiBadge res={suggest.result} /></div>
          <FallbackNote res={suggest.result} />
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="apps" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr>{['Role family', 'Fit', 'Overlap', 'Salary', 'Sponsors', 'Why'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--line)', color: 'var(--ink-3)', fontWeight: 600, fontSize: 13 }}>{h}</th>)}</tr></thead>
              <tbody>
                {suggest.result.data.families.map((f) => (
                  <tr key={f.name}>{[f.name, FIT[f.fit] || f.fit, `${f.overlap}%`, f.salary, f.sponsorship, f.why].map((c, i) => <td key={i} style={{ padding: '8px', borderBottom: '1px solid var(--line)', fontWeight: i === 0 ? 650 : 400 }}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid split section">
        <section className="card">
          <h2>Matched jobs this week</h2>
          <p className="sub">From your {s.selected_families.length} target role families, newest first. Apply within 48 hours of posting.</p>
          {jobs.length === 0 && <p className="muted">Tick at least one role family above to see matches.</p>}
          <div className="list">
            {jobs.map((j) => (
              <div key={j.id} className="job">
                <div>
                  <div className="title">{j.title}, {j.company}</div>
                  <div className="small muted">{j.location}, {money(j.salary)}, {posted(j.posted_days_ago)}, via {j.source}</div>
                  <div className="small" style={{ marginTop: 4 }}>{j.summary}</div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <span className={`chip ${j.visa.tone}`}>{j.visa.label}</span>
                    <span className="small muted">{j.visa.reason}</span>
                  </div>
                </div>
                <div className="stack" style={{ gap: 6, alignContent: 'start' }}>
                  <button className="btn small" onClick={() => go('resume', null, { jobId: j.id })}>Tailor CV</button>
                  <button className="btn ghost small" onClick={() => logApplication(j)}>Add to tracker</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="stack">
          <OfferCheck rules={s.visa_rules} />
          <section className="card">
            <h2>Your timeline</h2>
            <div className="list" style={{ marginTop: 12 }}>
              {s.calendar.map((c) => (
                <div key={c.title} className="date-row">
                  <span className="d">{fmtDate(c.date)}</span>
                  <span>{c.title} {c.type === 'visa' && <span className="chip bad">Visa</span>}{c.type === 'deadline' && <span className="chip warn">Deadline</span>}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid cols-2 section">
        <section className="card">
          <h2>How the UK market works</h2>
          <div className="list" style={{ marginTop: 12 }}>
            {s.uk_game.map((g) => <div key={g.title}><h3>{g.title}</h3><p className="small" style={{ marginTop: 2 }}>{g.body}</p></div>)}
          </div>
        </section>
        <section className="card">
          <h2>Where to look</h2>
          <div className="list" style={{ marginTop: 12 }}>
            {s.job_sources.map((g) => <div key={g.name}><h3>{g.name}</h3><p className="small" style={{ marginTop: 2 }}>{g.tip}</p></div>)}
          </div>
        </section>
      </div>
    </>
  )
}
