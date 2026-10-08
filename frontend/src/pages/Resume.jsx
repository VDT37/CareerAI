import { useState } from 'react'
import { post } from '../api'
import { AiBadge, FallbackNote, PageHead, useAction } from '../ui'

export function JobPicker({ jobs, value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Job">
      {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}, {j.company}</option>)}
    </select>
  )
}

export default function Resume({ s, focus, refresh, notify }) {
  const [jobId, setJobId] = useState(focus.jobId || 'j5')
  const tailor = useAction(async (id) => { const r = await post('/api/ai/tailor', { job_id: id }); refresh(); return r })
  const job = s.jobs.find((j) => j.id === jobId)
  const d = tailor.result?.data

  const log = async () => {
    await post('/api/applications', { company: job.company, role: job.title, family_id: job.family_id, cv_version: d.cv_version_name, source: job.source === 'LinkedIn' ? 'LinkedIn Easy Apply' : job.source, days_after_posting: job.posted_days_ago })
    await refresh()
    notify(`Added to Applications with CV "${d.cv_version_name}"`)
  }

  return (
    <>
      <PageHead title="Resume" lede="A UK-standard CV and cover letter for each job, built from your profile. Every tailored CV is saved as a version, so the tracker can tell which one gets replies." />

      <div className="grid split">
        <div className="stack">
          <section className="card">
            <h2>Tailor for one job</h2>
            <p className="sub">Picks the most relevant achievements from your profile and rewrites them in this job's language.</p>
            <div className="row">
              <JobPicker jobs={s.jobs} value={jobId} onChange={(v) => { setJobId(v); tailor.setResult(null) }} />
              <button className="btn" disabled={tailor.loading} onClick={() => tailor.run(jobId)}>{tailor.loading ? 'Tailoring' : 'Tailor CV and cover letter'}</button>
            </div>
            {job && <p className="small muted" style={{ marginTop: 10 }}>{job.summary}</p>}
            {tailor.error && <p className="error">{tailor.error}</p>}
          </section>

          {d && (
            <section className="cv-sheet">
              <div className="row"><h2 style={{ fontSize: 20 }}>{s.persona.name}</h2><span className="spacer" /><span className="chip">{d.cv_version_name}</span><AiBadge res={tailor.result} /></div>
              <FallbackNote res={tailor.result} />
              <h3>Profile</h3>
              <p>{d.profile}</p>
              <h3>Experience, selected for this role</h3>
              <ul>{d.bullets.map((b, i) => <li key={i}>{b.text}</li>)}</ul>
              <h3>Keywords covered</h3>
              <div className="row">{d.keywords.map((k) => <span key={k} className="chip good">{k}</span>)}</div>
            </section>
          )}
        </div>

        <div className="stack">
          {d ? (
            <>
              <section className="card letter">
                <h2>Cover letter</h2>
                <p className="sub">UK structure: why them, why you, what you will deliver.</p>
                <p className="part">Why {job.company}</p><p>{d.cover_letter.why_them}</p>
                <p className="part">Why me</p><p>{d.cover_letter.why_you}</p>
                <p className="part">What I will deliver</p><p>{d.cover_letter.what_you_deliver}</p>
              </section>
              {d.gaps?.length > 0 && (
                <section className="card">
                  <h3>Be ready to talk about</h3>
                  <ul className="dots small">{d.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
                </section>
              )}
              <button className="btn large" onClick={log}>Add to Applications with this CV</button>
            </>
          ) : (
            <section className="card">
              <h2>UK CV rules</h2>
              <ul className="dots small" style={{ marginTop: 10 }}>
                <li>Two pages. No photo, date of birth or marital status.</li>
                <li>Each bullet starts with an action and carries a number.</li>
                <li>Overseas employers get one line of context.</li>
                <li>The cover letter answers why them before why you.</li>
              </ul>
            </section>
          )}
          <section className="card">
            <h3>Your CV versions</h3>
            <div className="row" style={{ marginTop: 10 }}>{s.cv_versions.map((c) => <span key={c.id} className="chip">{c.name}</span>)}</div>
          </section>
        </div>
      </div>
    </>
  )
}
