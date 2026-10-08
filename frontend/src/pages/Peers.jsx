import { useState } from 'react'
import { post } from '../api'
import { AiBadge, Avatar, FallbackNote, Meter, PageHead, fmtDate, useAction } from '../ui'

const STATUS_LABEL = { suggested: 'Request a chat', requested: 'Requested', met: 'Met' }

function SessionNotes({ s, peerId, setPeerId, refresh }) {
  const [notes, setNotes] = useState('')
  const gen = useAction(async () => { const r = await post('/api/ai/peer-notes', { peer_id: peerId, notes }); await refresh(); return r })
  const peer = s.peers.find((p) => p.id === peerId)
  const d = gen.result?.data
  return (
    <section className="card">
      <div className="row"><h2>Session notes</h2><span className="spacer" /><AiBadge res={gen.result} /></div>
      <p className="sub">After a chat, jot down rough notes. They become a clean note with action items, saved to your Journal.</p>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="small strong">Chat with</span>
        <select value={peerId} onChange={(e) => { setPeerId(e.target.value); gen.setResult(null) }} aria-label="Peer">
          {s.peers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={`What did you and ${peer?.name.split(' ')[0]} talk about? Rough notes are fine.`} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={gen.loading || notes.trim().length < 20} onClick={() => gen.run()}>{gen.loading ? 'Writing notes' : 'Generate session notes'}</button>
        <button className="btn ghost" onClick={() => { setPeerId('p1'); setNotes(s.sample_peer_notes) }}>Use sample notes</button>
      </div>
      {gen.error && <p className="error" style={{ marginTop: 8 }}>{gen.error}</p>}
      {d && (
        <div className="card tint" style={{ marginTop: 14 }}>
          <FallbackNote res={gen.result} />
          <div className="strong">{s.persona.name} met {peer.name}</div>
          <p className="small muted">{d.what_was_done}</p>
          <p style={{ marginTop: 8 }}>{d.summary}</p>
          {d.discussed.length > 0 && <><h3 style={{ marginTop: 10 }}>Discussed</h3><ul className="dots small">{d.discussed.map((x) => <li key={x}>{x}</li>)}</ul></>}
          {d.actions.length > 0 && <><h3 style={{ marginTop: 10 }}>Actions</h3><ul className="dots small">{d.actions.map((x) => <li key={x}>{x}</li>)}</ul></>}
          <p className="small muted" style={{ marginTop: 10 }}>Saved to your Journal.</p>
        </div>
      )}
    </section>
  )
}

export default function Peers({ s, refresh, notify }) {
  const [peerId, setPeerId] = useState(s.peers.find((p) => p.status === 'met')?.id || s.peers[0].id)
  const g = s.buddy_group
  const request = async (p) => { await post(`/api/peers/${p.id}/request`); await refresh(); notify(`Chat request sent to ${p.name.split(' ')[0]}`) }
  const nudge = async (m) => { await post(`/api/buddies/${m.id}/nudge`); await refresh(); notify(`Nudge sent to ${m.name.split(' ')[0]}`) }

  return (
    <>
      <PageHead title="Peers" lede="Students and recent graduates with a background like yours. Swap CVs, run mock interviews together and keep each other going." />

      <div className="section-head"><h2>Matched with you</h2><p>Based on your course, past work, target roles and visa route.</p></div>
      <div className="grid cols-3">
        {s.peers.map((p) => (
          <article key={p.id} className="card peer">
            <div className="head">
              <Avatar name={p.name} />
              <div style={{ minWidth: 0 }}>
                <div className="name">{p.name}</div>
                <div className="headline">{p.headline}</div>
              </div>
              <span className="match">{p.match}% match</span>
            </div>
            <p className="small">{p.background}</p>
            <div className="row" style={{ gap: 6 }}>{p.shared.map((x) => <span key={x} className="chip good">{x}</span>)}</div>
            <p className="small muted">{p.offers}</p>
            <div className="row">
              {p.status === 'suggested' && <button className="btn small" onClick={() => request(p)}>{STATUS_LABEL.suggested}</button>}
              {p.status === 'requested' && <span className="chip warn">Request sent</span>}
              {p.status === 'met' && <span className="chip good">Met</span>}
              <span className="spacer" />
              {p.status !== 'suggested' && <button className="linkish small" onClick={() => { setPeerId(p.id); document.getElementById('notes')?.scrollIntoView({ behavior: 'smooth' }) }}>Write session notes</button>}
            </div>
          </article>
        ))}
      </div>

      <div className="grid cols-2 section">
        <section className="card">
          <h2>Who met who</h2>
          <p className="sub">Recent peer sessions, yours and across the community.</p>
          <div className="list">
            {s.peer_sessions.map((ps) => (
              <div key={ps.id} className="meet">
                <span className="pair">{ps.people.map((n) => <Avatar key={n} name={n} size="sm" />)}</span>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="strong">{ps.people[0]} met {ps.people[1]}</span>
                    {ps.new && <span className="chip good">New</span>}
                  </div>
                  <div className="small muted">{fmtDate(ps.date)}, {ps.format}</div>
                  <p className="small" style={{ marginTop: 4 }}><span className="strong">What was done: </span>{ps.what}</p>
                  <p className="small muted" style={{ marginTop: 2 }}>{ps.notes.summary}</p>
                  {!ps.community && ps.notes.actions.length > 0 && <ul className="dots small">{ps.notes.actions.map((a) => <li key={a}>{a}</li>)}</ul>}
                </div>
              </div>
            ))}
          </div>
        </section>
        <div id="notes"><SessionNotes s={s} peerId={peerId} setPeerId={setPeerId} refresh={refresh} /></div>
      </div>

      <div className="section-head section"><h2>{g.name}</h2><p>Your accountability group. Goals and streaks are shared.</p></div>
      <div className="grid cols-3">
        {g.members.map((m) => (
          <article key={m.id} className="card member">
            <div className="row"><Avatar name={m.name} /><div><div className="strong">{m.name}{m.you && <span className="small muted"> (you)</span>}</div><div className="small muted">{m.course}</div></div></div>
            <div className="weeks">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < m.streak ? 'on' : ''} />)}</div>
            <span className="small">{m.streak}-week streak</span>
            <p className="small"><span className="strong">This week: </span>{m.goal}</p>
            <Meter value={(m.done / m.total) * 100} />
            <div className="row">
              <span className="small muted">{m.done} of {m.total} tasks done</span>
              <span className="spacer" />
              {!m.you && <button className="btn ghost small" disabled={m.nudged} onClick={() => nudge(m)}>{m.nudged ? 'Nudged' : 'Nudge'}</button>}
            </div>
          </article>
        ))}
      </div>
      <section className="card section">
        <h2>Group feed</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {g.feed.map((f, i) => (
            <div key={i}><span className="strong">{f.who}</span> <span className="small muted">{f.when}</span><p style={{ marginTop: 2 }}>{f.text}</p></div>
          ))}
        </div>
      </section>
    </>
  )
}
