import { useState } from 'react'
import { Check, ClipboardList, Mic } from 'lucide-react'
import { post } from '../api'
import { AiBadge, Avatar, Brand, FallbackNote, coverage, useAction } from '../ui'
import VoiceAgent from '../VoiceAgent'

const STEPS = ['Your background', 'Your profile', 'What they look for']

const TALKING_POINTS = [
  'MSc Business Analytics at Exeter, finishing September',
  '3 years at Infosys Bengaluru as a data analyst',
  'Power BI churn dashboard for a UK bank: 40 managers, closures down 6%',
  'Python automation for Monday reports: about 12 hours a week saved',
  'Wants data analyst or BI roles; Student visa ends January, then Graduate Route',
]

function Background({ s, onBuilt }) {
  const [mode, setMode] = useState('voice')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState(false)
  const build = useAction(async (transcript, source) => {
    const r = await post('/api/ai/evidence', { transcript, source })
    onBuilt(r)
    return r
  })

  return (
    <>
      <div className="ob-title">
        <h1>Welcome to UK Career Navigator</h1>
        <p>Tell us about your background. We turn it into evidence UK employers understand.</p>
      </div>
      <div className="grid cols-2">
        <button className={`card choice ${mode === 'voice' ? 'selected' : ''}`} onClick={() => setMode('voice')}>
          <span className="icon-box"><Mic size={19} /></span>
          <span><h3>Talk to our careers coach</h3><p>A 2 to 3 minute voice conversation. The coach asks the questions.</p></span>
        </button>
        <button className={`card choice ${mode === 'paste' ? 'selected' : ''}`} onClick={() => setMode('paste')}>
          <span className="icon-box"><ClipboardList size={19} /></span>
          <span><h3>Paste your CV or notes</h3><p>An old CV, your LinkedIn About section or rough notes all work.</p></span>
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {mode === 'voice' ? (
          <VoiceAgent
            agent="onboarding"
            agentLabel="Coach"
            intro="Start when you are ready"
            dynamicVariables={{ candidate_name: s.persona.first_name }}
            onDone={(t) => build.run(t, 'voice')}
          >
            <button className="linkish small" style={{ justifySelf: 'start' }} onClick={() => setNotes(!notes)}>
              {notes ? 'Hide' : 'Show'} talking points for the demo
            </button>
            {notes && <ul className="dots small">{TALKING_POINTS.map((t) => <li key={t}>{t}</li>)}</ul>}
          </VoiceAgent>
        ) : (
          <div className="card">
            <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="I worked three years at..." />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost small" onClick={() => setText(s.sample_transcript)}>Use a sample background</button>
            </div>
          </div>
        )}
      </div>

      {build.loading && <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>Building your profile</p>}
      {build.error && <p className="error" style={{ marginTop: 16 }}>{build.error}</p>}
      {mode === 'paste' && (
        <div className="ob-actions">
          <button className="btn large" disabled={build.loading || text.trim().length < 20} onClick={() => build.run(text, 'paste')}>
            {build.loading ? 'Building your profile' : 'Build my profile'}
          </button>
        </div>
      )}
    </>
  )
}

function ProfileStep({ s, built, back, next }) {
  const p = s.persona
  const items = built?.items?.length ? built.items : s.evidence.slice(0, 4)
  return (
    <>
      <div className="ob-title">
        <h1>Your profile</h1>
        <p>Here is what you already have, written the way UK employers read it.</p>
      </div>
      <div className="card">
        <div className="profile-head">
          <Avatar name={p.name} size="lg" />
          <div>
            <div className="row"><h2 style={{ fontSize: 19 }}>{p.name}</h2><span className="spacer" /><AiBadge res={built} /></div>
            <p className="muted">{p.course}. Previously {p.previous_role}.</p>
            {(built?.data?.pitch || p.pitch) && <p className="pitch">{built?.data?.pitch || p.pitch}</p>}
          </div>
        </div>
        <FallbackNote res={built} />
      </div>

      <div className="section-head section"><h2>{built ? `${items.length} achievements captured` : 'Your achievements'}</h2></div>
      <div className="stack">
        {items.map((e) => (
          <div key={e.id} className="card tight">
            <div className="strong">{e.title}</div>
            <p style={{ marginTop: 4 }}>{e.uk_version}</p>
            <div className="row" style={{ marginTop: 8 }}>{(e.skills || []).slice(0, 4).map((k) => <span key={k} className="chip">{k}</span>)}</div>
          </div>
        ))}
      </div>
      {built?.data?.visa && <p className="small muted" style={{ marginTop: 12 }}>Visa: {built.data.visa}</p>}
      <div className="ob-actions">
        <button className="btn ghost large" onClick={back}>Back</button>
        <button className="btn large" onClick={next}>Continue</button>
      </div>
    </>
  )
}

function LooksFor({ s, go }) {
  const fams = s.role_families.filter((f) => s.selected_families.includes(f.id))
  return (
    <>
      <div className="ob-title">
        <h1>What UK employers actually look for</h1>
        <p>For the roles you are targeting, checked against your profile.</p>
      </div>
      <div className="stack">
        {fams.map((f) => {
          const rows = coverage(s.looks_for[f.id] || [], s.evidence)
          const have = rows.filter((r) => r.status === 'yes').length
          const scored = rows.filter((r) => r.status !== 'prep').length
          return (
            <div key={f.id} className="card">
              <div className="row">
                <h2>{f.name}</h2>
                <span className="chip">{f.salary}</span>
                <span className="spacer" />
                <span className="small strong" style={{ color: 'var(--green)' }}>You show {have} of {scored}</span>
              </div>
              <p className="sub">{f.uk_titles.join(', ')}. Sponsorship likelihood: {f.sponsorship.toLowerCase()}.</p>
              <div className="stack" style={{ gap: 10 }}>
                {rows.map((r) => (
                  <div key={r.need} className="need">
                    <span className={`mark ${r.status}`}>{r.status === 'yes' ? <Check size={13} strokeWidth={3} /> : r.status === 'prep' ? '!' : ''}</span>
                    <div>
                      <div className={r.status === 'no' ? 'strong' : ''}>{r.need}</div>
                      <div className="small muted">
                        {r.status === 'yes' && `Shown by: ${r.evidence}`}
                        {r.status === 'no' && 'Gap. Add an example to your profile, or ask a peer who has it.'}
                        {r.status === 'prep' && r.advice}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="ob-actions">
        <button className="btn ghost large" onClick={() => go('pathways')}>Change target roles</button>
        <button className="btn large" onClick={() => go('home')}>Go to my dashboard</button>
      </div>
    </>
  )
}

export default function Onboarding({ s, refresh, go }) {
  const [step, setStep] = useState(0)
  const [built, setBuilt] = useState(null)

  const onBuilt = async (r) => {
    setBuilt(r)
    await refresh()
    setStep(1)
  }

  return (
    <div>
      <header className="ob-top">
        <Brand onClick={() => go('landing')} />
        <nav className="stepper" aria-label="Onboarding steps">
          {STEPS.map((label, i) => (
            <span key={label} style={{ display: 'contents' }}>
              {i > 0 && <span className="step-line" />}
              <button className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`} disabled={i > step && !built} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
                <span className="n">{i < step ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                <span className="label">{label}</span>
              </button>
            </span>
          ))}
        </nav>
        <button className="linkish small" onClick={() => go('home')}>Skip to dashboard</button>
      </header>
      <main className="ob-body">
        {step === 0 && <Background s={s} onBuilt={onBuilt} />}
        {step === 1 && <ProfileStep s={s} built={built} back={() => setStep(0)} next={() => setStep(2)} />}
        {step === 2 && <LooksFor s={s} go={go} />}
      </main>
    </div>
  )
}
