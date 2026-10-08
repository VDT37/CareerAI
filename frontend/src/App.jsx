import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { api, post, setPasscode } from './api'
import { Avatar, Brand, NAV, resolvePage } from './ui'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Pathways from './pages/Pathways'
import Resume from './pages/Resume'
import Interview from './pages/Interview'
import Applications from './pages/Applications'
import Networking from './pages/Networking'
import Peers from './pages/Peers'
import Journal from './pages/Journal'

const PAGES = { home: Home, profile: Profile, pathways: Pathways, resume: Resume, interview: Interview, applications: Applications, networking: Networking, peers: Peers, journal: Journal }

function readHash() {
  const [raw, rawTab] = window.location.hash.slice(1).split('/')
  if (!raw) return { page: 'landing', tab: null }
  if (raw === 'landing' || raw === 'onboarding') return { page: raw, tab: rawTab || null }
  const [page, tab] = resolvePage(raw, rawTab || null)
  return { page: PAGES[page] ? page : 'home', tab }
}

function PasscodeGate({ wrong, onSubmit }) {
  const [code, setCode] = useState('')
  return (
    <main className="ob-body" style={{ maxWidth: 440 }}>
      <div className="ob-title">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Brand onClick={() => {}} /></div>
        <h1>Enter the demo passcode</h1>
        <p>This prototype uses live AI and voice, so it is behind a passcode.</p>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (code.trim()) onSubmit(code.trim()) }}>
        <label className="field">Passcode<input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></label>
        {wrong && <p className="error">That passcode did not work. Check it and try again.</p>}
        <button className="btn large" type="submit">Open the demo</button>
      </form>
    </main>
  )
}

export default function App() {
  const [s, setS] = useState(null)
  const [error, setError] = useState(null)
  const [nav, setNav] = useState(readHash)
  const [focus, setFocus] = useState({}) // cross-page hand-offs, e.g. which job to tailor
  const [toast, setToast] = useState(null)
  const [locked, setLocked] = useState(null) // null, 'ask' or 'wrong' when the backend wants a passcode

  const refresh = useCallback(() => api('/api/state').then((d) => { setLocked(null); setS(d) }).catch((e) => {
    if (e.status === 401) setLocked((l) => (l ? 'wrong' : 'ask'))
    else setError(e.message)
  }), [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onHash = () => setNav(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (rawPage, rawTab = null, extra = {}) => {
    const [page, tab] = ['landing', 'onboarding'].includes(rawPage) ? [rawPage, rawTab] : resolvePage(rawPage, rawTab)
    setFocus(extra)
    window.location.hash = tab ? `${page}/${tab}` : page
    window.scrollTo(0, 0)
  }
  const notify = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }
  const reset = async () => {
    await post('/api/reset')
    await refresh()
    notify('Demo data restored')
  }

  if (locked) return <PasscodeGate wrong={locked === 'wrong'} onSubmit={(code) => { setPasscode(code); refresh() }} />
  if (error) return <div className="main"><p className="error">Cannot reach the backend: {error}. Start it with uvicorn on port 8000.</p></div>
  if (!s) return <div className="main muted">Loading</div>

  const props = { s, refresh, go, tab: nav.tab, focus, notify }
  const toastEl = toast && <div className="toast" role="status">{toast}</div>
  if (nav.page === 'landing') return <><Landing {...props} />{toastEl}</>
  if (nav.page === 'onboarding') return <><Onboarding {...props} />{toastEl}</>

  const Page = PAGES[nav.page]
  const voiceReady = s.config.voice.onboarding && s.config.voice.interviewer
  return (
    <div className="shell">
      <aside className="side">
        <Brand onClick={() => go('landing')} />
        {NAV.map((g) => (
          <nav key={g.group} className="nav-group" aria-label={g.group}>
            <span className="nav-label">{g.group}</span>
            {g.items.map(({ key, label, icon: Icon }) => (
              <button key={key} className={`nav-item ${nav.page === key ? 'active' : ''}`} onClick={() => go(key)} aria-current={nav.page === key ? 'page' : undefined}>
                <Icon size={18} strokeWidth={1.9} />
                {label}
                {key === 'applications' && s.stats.findings.length > 0 && <span className="count" title="Things to fix">{s.stats.findings.length}</span>}
              </button>
            ))}
          </nav>
        ))}
        <div className="side-foot">
          <div className="status-row"><span className={`pip ${s.config.llm ? 'on' : ''}`} />{s.config.llm ? 'AI live' : 'AI in demo mode'}</div>
          <div className="status-row"><span className={`pip ${voiceReady ? 'on' : ''}`} />{voiceReady ? 'Voice ready' : 'Voice not set up'}</div>
          <div className="me">
            <Avatar name={s.persona.name} size="sm" />
            <div style={{ minWidth: 0 }}>
              <div className="name">{s.persona.name}</div>
              <div className="course">{s.persona.course.split(',')[0]}</div>
            </div>
          </div>
          <button className="btn ghost small" onClick={reset}><RotateCcw size={14} />Reset demo data</button>
        </div>
      </aside>
      <main className="main">
        <Page {...props} />
      </main>
      {toastEl}
    </div>
  )
}
