import { useState } from 'react'
import { Meter, PageHead, fmtDate } from '../ui'

const TYPES = [['all', 'All'], ['interview', 'Mock interviews'], ['coach', 'Coach calls'], ['peer', 'Peer chats']]
const TYPE_LABEL = { interview: 'Mock interview', coach: 'Coach call', peer: 'Peer chat' }
const SCORE_LABELS = { structure: 'Structure', clarity: 'Clarity', evidence: 'Evidence', uk_tone: 'UK tone' }

export default function Journal({ s, go }) {
  const [type, setType] = useState('all')
  const entries = s.journal.filter((e) => type === 'all' || e.type === type)

  return (
    <>
      <PageHead title="Journal" lede="A log of every coach call, mock interview and peer chat, with notes written for you after each one." />
      <div className="filters">
        {TYPES.map(([k, l]) => (
          <button key={k} className={`filter ${type === k ? 'active' : ''}`} onClick={() => setType(k)}>
            {l} ({k === 'all' ? s.journal.length : s.journal.filter((e) => e.type === k).length})
          </button>
        ))}
      </div>
      {entries.length === 0 && (
        <div className="card"><p className="muted">No sessions yet. <button className="linkish" onClick={() => go('interview')}>Start a mock interview</button>.</p></div>
      )}
      <div className="card">
        <div className="list">
          {entries.map((e) => (
            <article key={e.id} className="journal-entry">
              <div className="when">{fmtDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="chip good">{TYPE_LABEL[e.type]}</span>
                  {e.new && <span className="chip">New</span>}
                  <span className="small muted">with {e.with}</span>
                </div>
                <h3 style={{ marginTop: 6, fontSize: 15.5 }}>{e.title}</h3>
                <p className="small" style={{ marginTop: 2 }}>{e.summary}</p>
                {(e.points.length > 0 || e.actions.length > 0 || e.scores) && (
                  <details>
                    <summary>Session notes</summary>
                    <div className="grid cols-2" style={{ marginTop: 10 }}>
                      {e.points.length > 0 && <div><h3>{e.type === 'interview' ? 'What worked' : 'Key points'}</h3><ul className="dots small">{e.points.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                      {e.actions.length > 0 && <div><h3>{e.type === 'interview' ? 'Change next time' : 'Actions'}</h3><ul className="dots small">{e.actions.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                      {e.scores && (
                        <div className="stack" style={{ gap: 6 }}>
                          {Object.entries(e.scores).map(([k, v]) => <div key={k} className="score small"><span>{SCORE_LABELS[k] || k}</span><Meter value={v * 20} /><b>{v}/5</b></div>)}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
