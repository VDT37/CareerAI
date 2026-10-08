import { useState } from 'react'
import { post } from '../api'
import { AiBadge, Avatar, FallbackNote, PageHead, useAction } from '../ui'
import VoiceAgent from '../VoiceAgent'

export default function Profile({ s, refresh, go, notify }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('voice')
  const build = useAction(async (transcript, source) => {
    const r = await post('/api/ai/evidence', { transcript, source })
    await refresh()
    return r
  })
  const star = useAction(async (id) => {
    const r = await post('/api/ai/star', { evidence_id: id })
    await refresh()
    notify('STAR story added to Interview coach')
    return r
  })
  const p = s.persona

  return (
    <>
      <PageHead title="Profile" lede="Everything you have done, written in the language UK employers scan for. Your CVs, interview stories and outreach messages are all built from this." />

      <div className="grid split">
        <section className="card">
          <div className="profile-head">
            <Avatar name={p.name} size="lg" />
            <div>
              <div className="row"><h2 style={{ fontSize: 19 }}>{p.name}</h2><span className="spacer" /><AiBadge res={build.result} /></div>
              <p className="muted">{p.course}. Previously {p.previous_role}.</p>
              {p.pitch
                ? <p className="pitch">{p.pitch}</p>
                : <p className="small muted" style={{ marginTop: 10 }}>Add your background on the right and your two-line pitch appears here.</p>}
            </div>
          </div>
          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>Visa</dt><dd>{p.visa}</dd>
            <dt>Locations</dt><dd>{p.locations.join(', ')}</dd>
            <dt>Graduates</dt><dd>{p.graduation}</dd>
          </dl>
          <FallbackNote res={build.result} />
          {build.result && (
            <div className="row" style={{ marginTop: 14 }}>
              <span className="small strong">Added {build.result.items.length} achievements below.</span>
              <span className="spacer" />
              <button className="btn ghost small" onClick={() => go('resume')}>Tailor a CV</button>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Add to your profile</h2>
          <p className="sub">Talk to the coach, or paste a CV or notes.</p>
          <div className="filters">
            <button className={`filter ${mode === 'voice' ? 'active' : ''}`} onClick={() => setMode('voice')}>Talk to the coach</button>
            <button className={`filter ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>Paste text</button>
          </div>
          {mode === 'voice' ? (
            <VoiceAgent agent="onboarding" agentLabel="Coach" intro="2 to 3 minutes with your careers coach"
              dynamicVariables={{ candidate_name: p.first_name }} onDone={(t) => build.run(t, 'voice')} />
          ) : (
            <>
              <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="I worked three years at..." />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" disabled={build.loading || text.trim().length < 20} onClick={() => build.run(text, 'paste')}>{build.loading ? 'Adding' : 'Add to profile'}</button>
                <button className="btn ghost" onClick={() => setText(s.sample_transcript)}>Use sample</button>
              </div>
            </>
          )}
          {build.loading && <p className="small muted" style={{ marginTop: 8 }}>Building your evidence</p>}
          {build.error && <p className="error" style={{ marginTop: 8 }}>{build.error}</p>}
        </section>
      </div>

      <div className="section">
        <div className="section-head"><h2>Achievements ({s.evidence.length})</h2><p>Each one shows what you said and the UK version.</p></div>
        <div className="grid cols-3">
          {s.evidence.map((e) => (
            <article key={e.id} className={`card evidence-card ${e.new ? 'new' : ''}`}>
              <div className="row"><h3 style={{ flex: 1 }}>{e.title}</h3>{e.new && <span className="chip good">New</span>}</div>
              <p className="uk">{e.uk_version}</p>
              <p className="said">You said: "{e.raw}"</p>
              <dl className="kv">
                <dt>Result</dt><dd>{e.outcome}</dd>
                <dt>Scale</dt><dd>{e.scale}</dd>
              </dl>
              <div className="row">{(e.skills || []).map((k) => <span key={k} className="chip">{k}</span>)}</div>
              {e.context_note && <p className="context">{e.context_note}</p>}
              <div className="row">
                <span className="small muted">From {e.source}</span>
                <span className="spacer" />
                <button className="btn ghost small" disabled={star.loading} onClick={() => star.run(e.id)}>Make a STAR story</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
