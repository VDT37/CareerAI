import { useState } from 'react'
import { Check, Clock, MapPin } from 'lucide-react'
import { post } from '../api'
import { AiBadge, Avatar, FallbackNote, PageHead } from '../ui'

const STATUSES = [['to_contact', 'To contact'], ['messaged', 'Messaged'], ['replied', 'Replied'], ['chat_booked', 'Chat booked'], ['referral', 'Referral']]
const TONE = { replied: 'good', chat_booked: 'good', referral: 'good', messaged: 'warn' }

export default function Networking({ s, refresh, notify }) {
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(null)
  const [where, setWhere] = useState('all')
  const count = (...st) => s.contacts.filter((c) => st.includes(c.status)).length
  const events = s.events.filter((e) => where === 'all' || (where === 'online' ? e.place === 'Online' : e.place !== 'Online'))

  const rsvp = async (ev) => { await post(`/api/events/${ev.id}/rsvp`); await refresh(); notify(ev.rsvp ? `Removed from ${ev.title}` : `You're going to ${ev.title}`) }
  const draft = async (id) => {
    setBusy(id)
    try { const r = await post('/api/ai/outreach', { contact_id: id }); setDrafts((d) => ({ ...d, [id]: r })) } finally { setBusy(null) }
  }
  const setStatus = async (id, stage) => { await post(`/api/contacts/${id}/status`, { stage }); refresh() }
  const copy = async (r) => { await navigator.clipboard?.writeText(r.data.message); notify('Message copied') }

  return (
    <>
      <PageHead title="Networking" lede="Many UK roles are filled through referrals or never advertised. Meet people at events near you, and message alumni inside the companies you want." />

      <div className="section-head"><h2>Events near you</h2><p>Exeter and the South West, plus online.</p></div>
      <div className="filters">
        {[['all', 'All'], ['near', 'In person'], ['online', 'Online']].map(([k, l]) => (
          <button key={k} className={`filter ${where === k ? 'active' : ''}`} onClick={() => setWhere(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        <div className="list">
          {events.map((ev) => {
            const d = new Date(ev.date)
            return (
              <div key={ev.id} className="event">
                <div className="datebox"><b>{d.getDate()}</b><span>{d.toLocaleDateString('en-GB', { month: 'short' })}</span></div>
                <div>
                  <div className="row" style={{ gap: 8 }}><span className="strong">{ev.title}</span><span className="chip">{ev.type}</span></div>
                  <div className="row small muted" style={{ gap: 14, marginTop: 2 }}>
                    <span className="row" style={{ gap: 4 }}><Clock size={13} />{ev.time}</span>
                    <span className="row" style={{ gap: 4 }}><MapPin size={13} />{ev.place}{ev.place !== 'Online' && `, ${ev.distance}`}</span>
                  </div>
                  <p className="small" style={{ marginTop: 4 }}>{ev.why}</p>
                </div>
                <button className={`btn small ${ev.rsvp ? '' : 'ghost'}`} onClick={() => rsvp(ev)}>{ev.rsvp ? <><Check size={14} />Going</> : 'RSVP'}</button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid split section">
        <section className="card">
          <div className="row"><h2>Alumni outreach</h2><span className="spacer" />
            <span className="small muted">{count('messaged', 'replied', 'chat_booked', 'referral')} contacted, {count('replied', 'chat_booked', 'referral')} replied, {count('referral')} referral</span>
          </div>
          <p className="sub">People inside your target employers. The message asks for advice, not a job.</p>
          <div className="list">
            {s.contacts.map((c) => {
              const r = drafts[c.id]
              return (
                <div key={c.id} className="contact">
                  <Avatar name={c.name} />
                  <div>
                    <div className="strong">{c.name}</div>
                    <div className="small">{c.role}, {c.company}</div>
                    <div className="small muted">{c.link}. {c.note}</div>
                  </div>
                  <div className="row" style={{ alignItems: 'start' }}>
                    <span className={`chip ${TONE[c.status] || ''}`}>{STATUSES.find(([k]) => k === c.status)[1]}</span>
                    <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} aria-label={`Status for ${c.name}`}>
                      {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '2 / -1' }}>
                    {!r && <button className="btn ghost small" disabled={busy === c.id} onClick={() => draft(c.id)}>{busy === c.id ? 'Drafting' : 'Draft a message'}</button>}
                    {r && (
                      <div className="stack" style={{ gap: 8 }}>
                        <div className="row"><span className="small strong">{r.data.subject}</span><span className="spacer" /><AiBadge res={r} /></div>
                        <FallbackNote res={r} />
                        <p className="draft">{r.data.message}</p>
                        <p className="small muted">Follow-up in two weeks: {r.data.follow_up}</p>
                        <div className="row">
                          <button className="btn small" onClick={() => copy(r)}>Copy message</button>
                          <button className="btn ghost small" onClick={() => { setStatus(c.id, 'messaged'); notify(`${c.name} marked as messaged`) }}>Mark as sent</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <h2>From stranger to referral</h2>
            <p className="sub">Six steps that work in the UK.</p>
            <ol className="steps">
              {s.playbook.map((p) => <li key={p.title}><div><h3>{p.title}</h3><p className="small" style={{ marginTop: 2 }}>{p.body}</p></div></li>)}
            </ol>
          </section>
          <section className="card">
            <h2>Get one UK project</h2>
            <p className="sub">A UK referee is worth more than another certificate.</p>
            <div className="list">
              {s.uk_projects.map((p) => <div key={p.title}><h3>{p.title}</h3><p className="small" style={{ marginTop: 2 }}>{p.time}. {p.why}</p></div>)}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
