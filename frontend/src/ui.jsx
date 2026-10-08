import { useState } from 'react'
import { BookOpen, BriefcaseBusiness, CalendarDays, Compass, FileText, House, Mic, UserRound, Users } from 'lucide-react'

// Sidebar, in two groups. key = route, label = what the user sees
export const NAV = [
  { group: 'Your search', items: [
    { key: 'home', label: 'This week', icon: House },
    { key: 'profile', label: 'Profile', icon: UserRound },
    { key: 'pathways', label: 'Career pathways', icon: Compass },
    { key: 'resume', label: 'Resume', icon: FileText },
    { key: 'interview', label: 'Interview coach', icon: Mic },
    { key: 'applications', label: 'Applications', icon: BriefcaseBusiness },
  ] },
  { group: 'Community', items: [
    { key: 'networking', label: 'Networking', icon: CalendarDays },
    { key: 'peers', label: 'Peers', icon: Users },
    { key: 'journal', label: 'Journal', icon: BookOpen },
  ] },
]
export const PAGE_LABEL = Object.fromEntries(NAV.flatMap((g) => g.items).map((i) => [i.key, i.label]))

// The backend and seed still use the original page names; translate them to the new routes
export function resolvePage(page, tab) {
  const alias = { evidence: 'profile', direction: 'pathways', reach: 'networking', tracker: 'applications', buddies: 'peers' }
  if (page === 'prep') return tab === 'interview' ? ['interview', null] : tab === 'cv' ? ['resume', null] : ['interview', tab]
  return [alias[page] || page, tab]
}

export function PageHead({ title, lede, children }) {
  return (
    <header className="page-head">
      <div style={{ flex: 1, minWidth: 260 }}>
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children}
    </header>
  )
}

export function AiBadge({ res }) {
  if (!res) return null
  return (
    <span className={`ai-badge ${res.live ? 'live' : 'demo'}`} title={res.note || 'Generated live by the model'}>
      {res.live ? 'Live AI' : 'Demo fallback'}
    </span>
  )
}

export function FallbackNote({ res }) {
  if (!res || res.live || !res.note) return null
  return <p className="note">{res.note}</p>
}

// Wraps a call so each AI button gets its own loading, result and error state
export function useAction(fn) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const run = async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fn(...args)
      setResult(r)
      return r
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  return { run, loading, result, error, setResult }
}

export function Meter({ value }) {
  return (
    <div className="meter">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
export function Avatar({ name, size = '' }) {
  return <span className={`avatar ${size}`} aria-hidden>{initials(name)}</span>
}

export const TODAY = new Date('2026-10-08') // fixed demo date so the seeded week stays consistent
export const money = (n) => `£${Number(n).toLocaleString('en-GB')}`
export const pct = (x) => `${Math.round(x * 100)}%`
export const fmtDate = (iso, opts = { day: 'numeric', month: 'short' }) => new Date(iso).toLocaleDateString('en-GB', opts)
export const posted = (d) => (d === 0 ? 'Posted today' : d === 1 ? 'Posted yesterday' : `Posted ${d} days ago`)

// Which of a role family's requirements the Evidence Bank already shows
export function coverage(needs, evidence) {
  const docs = evidence.map((e) => ({ e, text: [e.title, e.uk_version, ...(e.skills || [])].join(' ').toLowerCase() }))
  return needs.map((n) => {
    if (n.advice) return { ...n, status: 'prep' }
    const hit = docs.find((d) => n.keywords.some((k) => d.text.includes(k)))
    return { ...n, status: hit ? 'yes' : 'no', evidence: hit?.e.title }
  })
}

export function Brand({ onClick }) {
  return (
    <button className="brand" onClick={onClick} aria-label="UK Career Navigator home">
      <span className="brand-mark"><Compass size={18} /></span>
      <span>
        <span className="brand-name">UK Career Navigator</span>
        <span className="brand-sub">for international students</span>
      </span>
    </button>
  )
}
