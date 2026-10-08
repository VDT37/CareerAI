import { BriefcaseBusiness, CalendarDays, Compass, FileText, Mic, Users } from 'lucide-react'
import { Brand } from '../ui'

const FEATURES = [
  { icon: FileText, title: 'Resume optimisation (UK standard)', body: 'Your experience rewritten in the words UK recruiters scan for, then a CV and cover letter tailored to each job.', page: 'resume' },
  { icon: Mic, title: 'Interview prep', body: 'Voice mock interviews for HR screens, behavioural rounds, CV walkthroughs and job-specific questions, with STAR feedback.', page: 'interview' },
  { icon: BriefcaseBusiness, title: 'Application tracker', body: 'A board for every application, your weekly progress, and a plain answer to what is not working.', page: 'applications' },
  { icon: CalendarDays, title: 'Networking events near you', body: 'Meetups, careers fairs and webinars nearby, plus short messages to alumni inside the companies you want.', page: 'networking' },
  { icon: Compass, title: 'Career pathways', body: 'Role families that fit your background, with UK job titles, salary ranges and how often they sponsor visas.', page: 'pathways' },
  { icon: Users, title: 'Find your peers', body: 'Matched with students from a similar background for CV swaps, mock interviews and weekly accountability.', page: 'peers' },
]

const PREVIEW = [
  { t: 'Tailor a Product Analyst CV for Lumen Health', why: '0 replies from 7 applications sent with a generic CV', done: false },
  { t: 'Apply to 5 roles within 48 hours of posting', why: 'Your fast applications get replies, slow ones do not', done: false },
  { t: 'Book the call Rahul offered', why: 'He replied 3 days ago', done: true },
]

export default function Landing({ go }) {
  return (
    <div className="landing">
      <header className="topbar">
        <Brand onClick={() => go('landing')} />
        <nav>
          <a href="#landing" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}>Features</a>
          <a href="#landing" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }) }}>How it works</a>
        </nav>
        <span className="spacer" />
        <button className="btn ghost" onClick={() => go('home')}>Open dashboard</button>
        <button className="btn" onClick={() => go('onboarding')}>Get started</button>
      </header>

      <section className="hero">
        <div>
          <h1>A clear plan for your UK job search, every week.</h1>
          <p className="lede">For international students in the UK. Turn your experience into UK-standard applications, practise interviews out loud, and see why applications are or are not working.</p>
          <div className="row">
            <button className="btn large" onClick={() => go('onboarding')}>Get started</button>
            <button className="btn ghost large" onClick={() => go('home')}>See the dashboard</button>
          </div>
          <p className="fine">Takes about three minutes. Talk to our coach or paste your CV.</p>
        </div>
        <div className="preview" aria-label="Example weekly plan">
          <div className="row"><span className="strong">This week</span><span className="spacer" /><span className="small muted">1 of 3 done</span></div>
          {PREVIEW.map((p) => (
            <div key={p.t} className="ptask">
              <span className={`box ${p.done ? 'done' : ''}`} />
              <div>
                <div style={{ textDecoration: p.done ? 'line-through' : 'none', color: p.done ? 'var(--ink-3)' : undefined, fontWeight: 600 }}>{p.t}</div>
                <div className="why">{p.why}</div>
              </div>
            </div>
          ))}
          <div className="card tint tight small"><span className="strong">Next best step: </span>send your next Product Analyst applications with a tailored CV.</div>
        </div>
      </section>

      <section className="land-section" id="features">
        <h2>What you can do</h2>
        <p>Six tools that share one profile, so each one knows what the others found.</p>
        <div className="grid cols-3">
          {FEATURES.map(({ icon: Icon, title, body, page }) => (
            <button key={title} className="card feature" onClick={() => go(page)}>
              <span className="icon-box"><Icon size={19} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
              <span className="go">Open</span>
            </button>
          ))}
        </div>
      </section>

      <section className="land-section" id="how">
        <h2>How it works</h2>
        <p>From your background to a weekly plan.</p>
        <div className="steps3">
          <div><h3>Tell us your background</h3><p>Talk to our careers coach for a few minutes, or paste your CV. We turn it into evidence UK employers understand.</p></div>
          <div><h3>See what employers look for</h3><p>Your profile against the roles you target: what you already show, and the gaps to close.</p></div>
          <div><h3>Follow your weekly plan</h3><p>Apply, practise and reach out. The tracker shows what to change when something is not working.</p></div>
        </div>
        <div className="row" style={{ marginTop: 28 }}><button className="btn large" onClick={() => go('onboarding')}>Get started</button></div>
      </section>

      <footer className="land-foot">Demo prototype. All people, companies and jobs shown are fictional.</footer>
    </div>
  )
}
