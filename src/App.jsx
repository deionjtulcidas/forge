import { useState, useEffect, useRef, useMemo } from 'react'

// ════════════════════════════════════════════════════════════════════════════════
// FORGE — personal operating system. Single file. Data lives in the browser
// (localStorage), namespaced per profile. Storage keys unchanged from prior
// versions so existing data (calendar, streak, profiles, money…) survives.
// ════════════════════════════════════════════════════════════════════════════════

const uid = p => p + '_' + Date.now() + '_' + Math.round(Math.random() * 1e4)
const todayKey = () => new Date().toISOString().slice(0, 10)
const ask = m => { try { return window.prompt(m) } catch { return null } }
const confirmSafe = m => { try { return window.confirm(m) } catch { return true } }

// ── per-profile namespacing ──
let ACTIVE_PROFILE = null
const setActiveProfile = id => { ACTIVE_PROFILE = id }
const PK = k => ACTIVE_PROFILE ? ('p:' + ACTIVE_PROFILE + ':' + k) : k
const APP_KEYS = ['hud_events', 'hud_v4', 'hud_vision', 'hud_theme', 'forge_name', 'forge_avoiding', 'forge_finance', 'forge_me', 'forge_goals', 'hud_alert_lead']

const hashPass = s => { let h = 5381; for (let i = 0; i < s.length; i++) { h = (((h << 5) + h) + s.charCodeAt(i)) | 0 } return (h >>> 0).toString(36) }
const loadProfiles = () => { try { return JSON.parse(localStorage.getItem('forge_profiles') || '[]') } catch { return [] } }
const saveProfiles = p => { try { localStorage.setItem('forge_profiles', JSON.stringify(p)) } catch {} }
const loadLastProfile = () => { try { return localStorage.getItem('forge_last_profile') || '' } catch { return '' } }
const saveLastProfile = id => { try { localStorage.setItem('forge_last_profile', id) } catch {} }
const migrateLegacyInto = id => { try { APP_KEYS.forEach(k => { const v = localStorage.getItem(k); const nk = 'p:' + id + ':' + k; if (v != null && localStorage.getItem(nk) == null) localStorage.setItem(nk, v) }) } catch {} }
const deleteProfileData = id => { try { APP_KEYS.forEach(k => localStorage.removeItem('p:' + id + ':' + k)) } catch {} }

// ── stores ──
const loadEvents = () => { try { return JSON.parse(localStorage.getItem(PK('hud_events')) || '[]') } catch { return [] } }
const saveEvents = e => { try { localStorage.setItem(PK('hud_events'), JSON.stringify(e)) } catch {} }
const loadData = () => { try { return JSON.parse(localStorage.getItem(PK('hud_v4')) || '{}') } catch { return {} } }
const saveData = d => { try { localStorage.setItem(PK('hud_v4'), JSON.stringify(d)) } catch {} }
const loadVision = () => { try { return JSON.parse(localStorage.getItem(PK('hud_vision')) || 'null') } catch { return null } }
const saveVision = v => { try { localStorage.setItem(PK('hud_vision'), JSON.stringify(v)) } catch {} }
const loadTheme = () => { try { return localStorage.getItem(PK('hud_theme')) || 'dark' } catch { return 'dark' } }
const saveTheme = t => { try { localStorage.setItem(PK('hud_theme'), t) } catch {} }
const loadAvoiding = () => { try { return JSON.parse(localStorage.getItem(PK('forge_avoiding')) || '[]') } catch { return [] } }
const saveAvoiding = a => { try { localStorage.setItem(PK('forge_avoiding'), JSON.stringify(a)) } catch {} }
const loadFinance = () => { try { return JSON.parse(localStorage.getItem(PK('forge_finance')) || 'null') } catch { return null } }
const saveFinance = f => { try { localStorage.setItem(PK('forge_finance'), JSON.stringify(f)) } catch {} }
const loadMe = () => { try { return JSON.parse(localStorage.getItem(PK('forge_me')) || 'null') } catch { return null } }
const saveMe = m => { try { localStorage.setItem(PK('forge_me'), JSON.stringify(m)) } catch {} }
const loadGoals = () => { try { return JSON.parse(localStorage.getItem(PK('forge_goals')) || 'null') } catch { return null } }
const saveGoals = g => { try { localStorage.setItem(PK('forge_goals'), JSON.stringify(g)) } catch {} }
const loadLead = () => { try { const v = Number(localStorage.getItem(PK('hud_alert_lead'))); return Number.isFinite(v) ? v : 10 } catch { return 10 } }
const saveLead = v => { try { localStorage.setItem(PK('hud_alert_lead'), String(v)) } catch {} }

// ── defaults ──
const DEFAULT_VISION = { items: [], wins: [] }
const DEFAULT_FINANCE = {
  debts: [
    { id: 'd_cc', name: 'Discover Card', balance: 2856.86, startBalance: 2856.86, apr: 24.99, monthlyPayment: 300, color: '#b0584a' },
    { id: 'd_loan', name: 'Student Loans', balance: 20000, startBalance: 20000, apr: 6, monthlyPayment: 250, color: '#5a78a8' },
  ],
  emergencyGoal: 1000, emergencySaved: 0, payments: [],
  milestones: [
    { id: uid('m'), text: 'Pay off the Discover card', done: false },
    { id: uid('m'), text: 'Build a $1,000 emergency fund', done: false },
    { id: uid('m'), text: 'Start attacking the student loans', done: false },
    { id: uid('m'), text: 'Hit $10,000 paid on loans', done: false },
    { id: uid('m'), text: 'Debt-free', done: false },
  ],
}
const LEVELS = ['—', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const DEFAULT_ME = {
  heightIn: 65, startWeight: 180, goalWeight: 155, weighIns: [],
  routine: [
    { id: 'r1', day: 1, name: 'Upper A', items: 'Bench press 4×6–8\nSeated row 4×8–10\nOverhead press 3×8\nLat pulldown 3×10\nCurls + triceps 3×12' },
    { id: 'r2', day: 2, name: 'Lower A', items: 'Squat 4×6–8\nRomanian deadlift 3×8\nLeg press 3×10\nCalf raises 4×12\nPlank 3×45s' },
    { id: 'r3', day: 4, name: 'Upper B', items: 'Incline DB press 4×8\nPull-ups 4×max\nDB shoulder press 3×10\nCable row 3×10\nArms superset 3×12' },
    { id: 'r4', day: 5, name: 'Lower B', items: 'Deadlift 3×5\nWalking lunges 3×12/leg\nLeg curl 3×10\nCalf raises 4×12\nHanging knee raises 3×12' },
    { id: 'r5', day: 6, name: 'Cardio + core', items: 'Incline walk 30–40 min\nCore circuit ×3 rounds' },
  ],
  career: {
    current: { title: 'Program Coordinator', company: 'CLEAResult', notes: 'Energy efficiency programs — program, data & client experience' },
    skills: ['Program coordination', 'Data analysis', 'Excel', 'Power BI', 'Salesforce', 'Project tracking', 'Stakeholder work'],
    past: [],
    target: 'United Nations — Program Management · International Development · Data & Analytics',
  },
  languages: [
    { id: 'es', name: 'Spanish', flag: '🇪🇸', level: 2, target: 4 },
    { id: 'fr', name: 'French', flag: '🇫🇷', level: 0, target: 3 },
  ],
  hobbies: [
    { id: 'h_guitar', name: 'Guitar', xp: 18, log: [] },
    { id: 'h_write', name: 'Writing · Substack', xp: 10, log: [] },
    { id: 'h_fly', name: 'Aviation knowledge', xp: 6, log: [] },
  ],
}
const DEFAULT_GOALS = {
  chain: [
    { id: 'g_fin', title: 'Financial stability', sub: 'Kill the debt, build the cushion. This unlocks everything below it.', ms: [
      { id: 'm1', text: 'Pay off the Discover card', done: false }, { id: 'm2', text: '$1,000 emergency fund', done: false },
      { id: 'm3', text: 'Student loans under $10k', done: false }, { id: 'm4', text: '3 months of expenses saved', done: false }] },
    { id: 'g_masters', title: "Master's — Manchester", sub: 'Data Science / Business Analytics, in England.', ms: [
      { id: 'm1', text: 'Shortlist programs & requirements', done: false }, { id: 'm2', text: 'Draft personal statement', done: false },
      { id: 'm3', text: 'Line up references', done: false }, { id: 'm4', text: 'Submit application', done: false }, { id: 'm5', text: 'Accepted', done: false }] },
    { id: 'g_pilot', title: "Pilot's license", sub: 'Private pilot certificate — the long-held one.', ms: [
      { id: 'm1', text: 'Discovery flight', done: false }, { id: 'm2', text: 'Ground school', done: false },
      { id: 'm3', text: 'First solo', done: false }, { id: 'm4', text: 'Written exam', done: false }, { id: 'm5', text: 'Checkride', done: false }] },
    { id: 'g_un', title: 'Work at the United Nations', sub: 'Program management / international development.', ms: [
      { id: 'm1', text: 'Spanish to B2', done: false }, { id: 'm2', text: 'French to B1', done: false },
      { id: 'm3', text: '3+ years program experience', done: false }, { id: 'm4', text: "Master's completed", done: false }, { id: 'm5', text: 'Apply — UN / JPO / UNV roles', done: false }] },
  ],
  parallel: [
    { id: 'g_fp', title: 'Flight Pathways', sub: 'Grow the flight-school platform — business + portfolio.', ms: [
      { id: 'm1', text: 'Site polished & live', done: false }, { id: 'm2', text: 'First 100 visitors', done: false },
      { id: 'm3', text: 'First partner school', done: false }, { id: 'm4', text: 'First revenue', done: false }] },
    { id: 'g_icert', title: 'ICERT volunteering', sub: 'Leadership, events, international experience.', ms: [
      { id: 'm1', text: 'Stay active monthly', done: false }, { id: 'm2', text: 'Lead an event', done: false }] },
  ],
  substack: { posts: 0, subs: 0, log: [] },
}
function buildWeekTemplate(me) {
  const gym = (me.routine || []).map(r => ({ title: 'Gym — ' + r.name, dayOfWeek: r.day, startH: 16, startM: 30, endH: 17, endM: 30, color: 'green' }))
  const fixed = [
    { title: 'Spanish practice', dayOfWeek: 1, startH: 19, startM: 0, endH: 19, endM: 45, color: 'red' },
    { title: 'Spanish practice', dayOfWeek: 3, startH: 19, startM: 0, endH: 19, endM: 45, color: 'red' },
    { title: 'Guitar', dayOfWeek: 2, startH: 19, startM: 0, endH: 19, endM: 30, color: 'purple' },
    { title: 'Guitar', dayOfWeek: 4, startH: 19, startM: 0, endH: 19, endM: 30, color: 'purple' },
    { title: 'Substack — write & publish', dayOfWeek: 6, startH: 9, startM: 0, endH: 11, endM: 0, color: 'amber' },
    { title: 'Flight Pathways work', dayOfWeek: 0, startH: 10, startM: 0, endH: 11, endM: 30, color: 'teal' },
    { title: 'Weekly review + journal', dayOfWeek: 0, startH: 19, startM: 0, endH: 19, endM: 30, color: 'blue' },
  ]
  return [...gym, ...fixed]
}

const wordCount = s => (s || '').trim().split(/\s+/).filter(Boolean).length
const dayIndex = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 86400000) }

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const EVENT_COLORS = [
  { id: 'blue', bg: 'rgba(90,120,168,0.9)', border: '#5a78a8' },
  { id: 'green', bg: 'rgba(109,138,100,0.9)', border: '#6d8a64' },
  { id: 'purple', bg: 'rgba(136,117,163,0.9)', border: '#8875a3' },
  { id: 'red', bg: 'rgba(176,88,74,0.92)', border: '#b0584a' },
  { id: 'amber', bg: 'rgba(163,132,82,0.92)', border: '#a38452' },
  { id: 'teal', bg: 'rgba(88,138,127,0.9)', border: '#588a7f' },
  { id: 'pink', bg: 'rgba(168,110,134,0.9)', border: '#a86e86' },
  { id: 'indigo', bg: 'rgba(104,102,168,0.9)', border: '#6866a8' },
  { id: 'olive', bg: 'rgba(134,138,86,0.9)', border: '#868a56' },
  { id: 'rust', bg: 'rgba(170,104,70,0.92)', border: '#aa6846' },
  { id: 'cyan', bg: 'rgba(80,142,158,0.9)', border: '#508e9e' },
  { id: 'slate', bg: 'rgba(112,120,132,0.9)', border: '#707884' },
  { id: 'rose', bg: 'rgba(178,96,112,0.92)', border: '#b26070' },
  { id: 'gold', bg: 'rgba(176,150,80,0.92)', border: '#b09650' },
]
const getEvColor = id => EVENT_COLORS.find(c => c.id === id) || EVENT_COLORS[0]
const money = (n, cents = true) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })

// ── theme ──
const THEME_TOKENS = `
  :root, .app-root[data-theme="dark"]{
    --bg:#0b0b0c; --surface:#111113; --surface2:#17171a; --surface3:#1f1f23;
    --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.18);
    --blue:#f2f2f3; --blueBright:#ffffff; --blueDim:rgba(255,255,255,0.06); --blueGlow:rgba(255,255,255,0.14);
    --text:#ececee; --muted:#8a8f98; --dim:#4d5057;
    --amber:#b9975f; --green:#7d9b72; --red:#c65949; --holo:#63b0c6; --holoDim:rgba(99,176,198,0.12);
    --vignette:rgba(0,0,0,0.5); --card-shadow:0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.35); --card-shadow-sel:0 12px 32px rgba(0,0,0,0.5);
  }
  .app-root[data-theme="light"]{
    --bg:#f4f4f5; --surface:#ffffff; --surface2:#ededef; --surface3:#e2e2e5;
    --border:rgba(0,0,0,0.09); --border2:rgba(0,0,0,0.22);
    --blue:#17181a; --blueBright:#000000; --blueDim:rgba(0,0,0,0.05); --blueGlow:rgba(0,0,0,0.12);
    --text:#17181a; --muted:#5d6067; --dim:#9a9da4;
    --amber:#8f7136; --green:#4e6b45; --red:#a8412f; --holo:#2f7f97; --holoDim:rgba(47,127,151,0.1);
    --vignette:rgba(244,244,245,0.4); --card-shadow:0 4px 14px rgba(0,0,0,0.06); --card-shadow-sel:0 8px 22px rgba(0,0,0,0.12);
  }
`
const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)', surface3: 'var(--surface3)',
  border: 'var(--border)', border2: 'var(--border2)', blue: 'var(--blue)', blueBright: 'var(--blueBright)',
  blueDim: 'var(--blueDim)', blueGlow: 'var(--blueGlow)', text: 'var(--text)', muted: 'var(--muted)', dim: 'var(--dim)',
  amber: 'var(--amber)', green: 'var(--green)', red: 'var(--red)', holo: 'var(--holo)', holoDim: 'var(--holoDim)',
}
const F = "'Inter',-apple-system,system-ui,sans-serif"

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  ${THEME_TOKENS}
  *{box-sizing:border-box}
  .app-root{min-height:100vh;background:var(--bg);color:var(--text);font-family:${F}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes zoomEnter{from{opacity:0;transform:scale(0.90)}to{opacity:1;transform:scale(1)}}
  @keyframes hubIn{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}
  @keyframes tilePop{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}
  .hubtile{transition:transform .18s cubic-bezier(.2,.8,.2,1), border-color .18s ease, box-shadow .18s ease; cursor:pointer; text-align:left}
  .hubtile:hover{transform:translateY(-4px); border-color:var(--border2); box-shadow:0 16px 40px rgba(0,0,0,0.4)}
  .hubtile:active{transform:translateY(-1px) scale(0.99)}
  .mecard{position:relative}
  .mecard::before{content:'';position:absolute;inset:-1px;border-radius:20px;padding:1px;background:linear-gradient(160deg,var(--holo),transparent 45%,transparent 60%,var(--holo));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0.5;pointer-events:none}
  .jbody{font-family:${F};font-size:14.5px;line-height:1.75;color:var(--text);white-space:pre-wrap;margin:0}
  .jbody.drop::first-letter{font-size:2.7em;font-weight:800;float:left;line-height:0.82;padding:2px 8px 0 0;color:var(--holo)}
  .jpage{position:relative;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--holo);border-radius:4px;box-shadow:var(--card-shadow)}
  .segtab{transition:color .15s ease}
  .meidcard{background:linear-gradient(135deg,var(--surface2),var(--surface));border:1px solid var(--border2)}
  @keyframes blink{0%,45%{opacity:1}50%,95%{opacity:0.25}100%{opacity:1}}
  .ringbtn{transition:transform .18s ease}
  .ringbtn:hover{transform:translateY(-2px) scale(1.03)}
  @keyframes modalIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
  @keyframes dotPulse{0%,100%{opacity:0.4}50%{opacity:1}}
  @keyframes slideIn{from{opacity:0}to{opacity:1}}
  @keyframes holoPulse{0%,100%{opacity:0.85}50%{opacity:1}}
  @keyframes scanMove{from{transform:translateY(0)}to{transform:translateY(8px)}}
  ::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:6px}::-webkit-scrollbar-track{background:transparent}
  input,textarea,select{font-family:${F}}
  .topnav{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:8px;height:56px;padding:0 26px;background:var(--surface);border-bottom:1px solid var(--border);backdrop-filter:blur(14px)}
  .topnav .navbtn{position:relative;background:none;border:none;cursor:pointer;padding:0 13px;height:56px;font-family:${F};font-size:11px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:var(--muted)}
  .topnav .navbtn.active{color:var(--blue)}
  .topnav .navbtn.active::after{content:'';position:absolute;left:10px;right:10px;bottom:0;height:2px;background:var(--blue)}
  .topbar-m,.bottom-nav{display:none}
  .topbar-m{position:sticky;top:0;z-index:40;align-items:center;gap:10px;padding:11px 16px;background:var(--surface);border-bottom:1px solid var(--border);backdrop-filter:blur(16px)}
  .bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--surface);border-top:1px solid var(--border);padding:6px 2px calc(6px + env(safe-area-inset-bottom));backdrop-filter:blur(16px)}
  .bottom-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;padding:7px 1px;cursor:pointer;position:relative}
  @media (max-width:820px){
    .only-desktop{display:none !important}
    .topbar-m{display:flex !important}
    .bottom-nav{display:flex !important}
    .main-pad{padding:16px 14px 96px !important}
    .modal-wrap{align-items:flex-end !important;padding:0 !important}
    .modal-card{width:100% !important;max-width:100% !important;border-radius:8px 8px 0 0 !important;max-height:92vh !important}
    input,textarea,select,button{font-size:16px}
  }
`

// ── icon: sharp forge mark ──
function Ember({ size = 40, color = 'var(--blue)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: 'block' }}>
      <path d="M32 5 L45 27 L38 31 L49 47 L32 59 L15 47 L26 31 L19 27 Z" fill={color} />
      <path d="M32 34 L38 44 L32 52 L26 44 Z" fill="var(--bg)" opacity="0.85" />
    </svg>
  )
}

function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%,transparent 40%,var(--vignette) 100%)' }} />
    </div>
  )
}

function Panel({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: 'var(--card-shadow)', ...style }}>{children}</div>
}

function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  return <span style={{ fontFamily: F, fontSize: 13, color: C.muted, letterSpacing: '0.04em' }}>{t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
}

const obtn = c => ({ fontFamily: F, fontSize: 12, fontWeight: 600, padding: '8px 13px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${c}`, background: 'transparent', color: c, whiteSpace: 'nowrap' })
const lbl = { fontFamily: F, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, marginBottom: 5, display: 'block' }
const fld = { width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 13, padding: '9px 11px', outline: 'none', fontFamily: F, resize: 'vertical' }
const H1 = ({ children }) => <h1 style={{ fontFamily: F, fontSize: 'clamp(22px,3.4vw,28px)', fontWeight: 800, letterSpacing: '-0.01em' }}>{children}</h1>

// ════════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ════════════════════════════════════════════════════════════════════════════════
function weekDatesFor(offset) {
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const start = new Date(t); start.setDate(t.getDate() - t.getDay() + offset * 7)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
}
function shouldShow(ev, date) {
  const dow = date.getDay()
  if (ev.repeat === 'daily') return true
  if (ev.repeat === 'weekdays') return dow >= 1 && dow <= 5
  return ev.dayOfWeek === dow
}
const t12 = (h, m) => { const hh = (h % 12) || 12; return hh + ':' + String(m || 0).padStart(2, '0') + (h >= 12 ? 'pm' : 'am') }

function WeeklyCalendar({ weekOffset, setWeekOffset, events, onEventsChange, isMobile, theme }) {
  const [modal, setModal] = useState(null)
  const [selDay, setSelDay] = useState(new Date().getDay())
  const [leadMin, setLeadMin] = useState(loadLead)
  const weekDates = weekDatesFor(weekOffset)
  const todayStr = todayKey()

  const saveEv = ev => {
    const exists = events.some(e => e.id === ev.id)
    onEventsChange(exists ? events.map(e => e.id === ev.id ? ev : e) : [...events, ev])
    setModal(null)
  }
  const deleteEv = id => { onEventsChange(events.filter(e => e.id !== id)); setModal(null) }

  const exportICS = () => downloadText('forge-schedule.ics', buildICS(events, leadMin), 'text/calendar')
  const exportUI = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select value={leadMin} onChange={e => { const v = Number(e.target.value); setLeadMin(v); saveLead(v) }} title="How early the alarm fires"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 11, padding: 8, outline: 'none' }}>
        <option value={0}>at start</option><option value={5}>5 min before</option><option value={10}>10 min before</option><option value={15}>15 min before</option><option value={30}>30 min before</option>
      </select>
      <button onClick={exportICS} style={obtn(C.amber)}>Sync to phone</button>
    </div>
  )

  if (isMobile) {
    const d = weekDates[selDay]
    const dayEvs = events.filter(ev => shouldShow(ev, d)).sort((a, b) => (a.allDay ? -1 : 1) - (b.allDay ? -1 : 1) || ((a.startH || 0) + (a.startM || 0) / 60) - ((b.startH || 0) + (b.startM || 0) / 60))
    return (
      <div style={{ animation: 'fadeUp 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: F, fontSize: 20, fontWeight: 800 }}>{d.toLocaleDateString('en-US', { month: 'long' })}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, width: 38, height: 38, fontSize: 17, cursor: 'pointer' }}>‹</button>
            <button onClick={() => { setWeekOffset(0); setSelDay(new Date().getDay()) }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>today</button>
            <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, color: C.muted, width: 38, height: 38, fontSize: 17, cursor: 'pointer' }}>›</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {weekDates.map((wd, i) => {
            const sel = i === selDay, isT = wd.toISOString().slice(0, 10) === todayStr
            return (
              <button key={i} onClick={() => setSelDay(i)} style={{ flex: 1, padding: '8px 0', borderRadius: 5, cursor: 'pointer', border: `1px solid ${sel ? C.blue : C.border}`, background: sel ? C.blueDim : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontFamily: F, fontSize: 9, color: sel ? C.blue : C.muted }}>{DAYS_SHORT[wd.getDay()].slice(0, 1)}</span>
                <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: sel ? C.blue : isT ? C.amber : C.text }}>{wd.getDate()}</span>
              </button>
            )
          })}
        </div>
        <button onClick={() => setModal({ type: 'new', slot: { dow: d.getDay(), hour: 9 } })} style={{ width: '100%', fontFamily: F, fontSize: 13, fontWeight: 600, padding: 11, borderRadius: 4, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue, marginBottom: 12 }}>+ Add a block</button>
        <div style={{ marginBottom: 16 }}>{exportUI}</div>
        {dayEvs.length === 0 ? (
          <Panel style={{ padding: '30px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: F, fontSize: 13, color: C.muted }}>Nothing planned for {DAYS_FULL[d.getDay()]}.</div>
          </Panel>
        ) : dayEvs.map(ev => {
          const ec = getEvColor(ev.color)
          return (
            <div key={ev.id} onClick={() => setModal({ type: 'edit', event: ev })} style={{ display: 'flex', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ width: 4, borderRadius: 2, background: ec.border, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{ev.title}</div>
                {ev.desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{ev.desc}</div>}
              </div>
              <div style={{ fontFamily: F, fontSize: 11, color: C.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>{ev.allDay ? 'all day' : <>{t12(ev.startH, ev.startM)}<br /><span style={{ color: C.dim }}>{t12(ev.endH, ev.endM)}</span></>}</div>
            </div>
          )
        })}
        {modal && <EventModal event={modal.type === 'edit' ? modal.event : null} slot={modal.slot} onSave={saveEv} onDelete={deleteEv} onClose={() => setModal(null)} theme={theme} />}
      </div>
    )
  }

  const HOUR_H = 46, START_H = 6
  const gridRef = useRef()
  const beginDrag = (e, ev) => {
    e.stopPropagation()
    const sx = e.clientX, sy = e.clientY
    const copy = e.altKey || e.metaKey
    let moved = false
    const dur = (ev.endH ?? ev.startH + 1) - ev.startH + (((ev.endM || 0) - (ev.startM || 0)) / 60)
    const onMove = mv => { if (Math.abs(mv.clientX - sx) > 4 || Math.abs(mv.clientY - sy) > 4) moved = true }
    const onUp = mv => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      if (!moved) { setModal({ type: 'edit', event: ev }); return }
      const g = gridRef.current.getBoundingClientRect()
      const colW = (g.width - 48) / 7
      const dayIdx = Math.max(0, Math.min(6, Math.floor((mv.clientX - g.left - 48) / colW)))
      const hour = Math.max(0, Math.min(23, START_H + Math.round((mv.clientY - g.top) / HOUR_H)))
      let newEndH = Math.floor(hour + dur); const newEndM = Math.round((dur % 1) * 60)
      if (newEndH > 23) { newEndH = 23 }
      const base = { ...ev, dayOfWeek: weekDates[dayIdx].getDay(), startH: hour, startM: 0, endH: newEndH, endM: newEndM }
      if (copy) onEventsChange([...events, { ...base, id: uid('e') }])
      else onEventsChange(events.map(x => x.id === ev.id ? base : x))
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, width: 34, height: 34, cursor: 'pointer' }}>‹</button>
          <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 11, padding: '0 12px', height: 34, cursor: 'pointer', letterSpacing: '0.08em' }}>TODAY</button>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, width: 34, height: 34, cursor: 'pointer' }}>›</button>
          <span style={{ fontFamily: F, fontSize: 20, fontWeight: 800 }}>{weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <LiveClock />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {exportUI}
          <button onClick={() => setModal({ type: 'new', slot: { dow: new Date().getDay(), hour: 9 } })} style={{ fontFamily: F, fontSize: 11, fontWeight: 600, padding: '9px 16px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue }}>+ New block</button>
        </div>
      </div>
      <div style={{ fontFamily: F, fontSize: 11, color: C.dim, marginBottom: 10 }}>Drag a block to move it · hold <b style={{ color: C.muted }}>Option/Alt</b> (or ⌘) while dragging to copy it.</div>
      <Panel style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)', borderBottom: `1px solid ${C.border}` }}>
          <div />
          {weekDates.map((d, i) => {
            const isT = d.toISOString().slice(0, 10) === todayStr
            return (
              <div key={i} style={{ padding: '10px 4px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F, fontSize: 9, color: C.dim, letterSpacing: '0.08em' }}>{DAYS_SHORT[d.getDay()]}</div>
                <div style={{ fontFamily: F, fontSize: 17, fontWeight: 700, color: isT ? C.amber : C.text, marginTop: 2 }}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>
        <div style={{ position: 'relative', maxHeight: '64vh', overflowY: 'auto' }}>
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)' }}>
            <div>
              {HOURS.slice(START_H).map(h => <div key={h} style={{ height: HOUR_H, fontFamily: F, fontSize: 9, color: C.dim, textAlign: 'right', paddingRight: 6, paddingTop: 2 }}>{t12(h, 0).replace(':00', '')}</div>)}
            </div>
            {weekDates.map((d, di) => (
              <div key={di} style={{ position: 'relative', borderLeft: `1px solid ${C.border}` }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const hour = START_H + Math.floor((e.clientY - rect.top) / HOUR_H)
                  setModal({ type: 'new', slot: { dow: d.getDay(), hour: Math.max(0, Math.min(23, hour)) } })
                }}>
                {HOURS.slice(START_H).map(h => <div key={h} style={{ height: HOUR_H, borderBottom: `1px solid ${C.border}` }} />)}
                {events.filter(ev => shouldShow(ev, d) && !ev.allDay).map(ev => {
                  const top = ((ev.startH - START_H) + (ev.startM || 0) / 60) * HOUR_H
                  const h = Math.max(22, (((ev.endH ?? ev.startH + 1) - ev.startH) + ((ev.endM || 0) - (ev.startM || 0)) / 60) * HOUR_H)
                  const ec = getEvColor(ev.color)
                  if (top < 0) return null
                  return (
                    <div key={ev.id} onMouseDown={e => beginDrag(e, ev)} onClick={e => e.stopPropagation()}
                      style={{ position: 'absolute', top, left: 2, right: 2, height: h, background: ec.bg, borderLeft: `3px solid ${ec.border}`, borderRadius: 3, padding: '3px 6px', cursor: 'grab', overflow: 'hidden', zIndex: 2, userSelect: 'none' }}>
                      <div style={{ fontFamily: F, fontSize: 10.5, fontWeight: 600, color: '#fff', lineHeight: 1.15 }}>{ev.title}</div>
                      <div style={{ fontFamily: F, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>{t12(ev.startH, ev.startM)}</div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Panel>
      {modal && <EventModal event={modal.type === 'edit' ? modal.event : null} slot={modal.slot} onSave={saveEv} onDelete={deleteEv} onClose={() => setModal(null)} theme={theme} />}
    </div>
  )
}

function EventModal({ event, slot, onSave, onDelete, onClose, theme }) {
  const [title, setTitle] = useState(event?.title || '')
  const [desc, setDesc] = useState(event?.desc || '')
  const [dow, setDow] = useState(event?.dayOfWeek ?? slot?.dow ?? 1)
  const [startH, setStartH] = useState(event?.startH ?? slot?.hour ?? 9)
  const [startM, setStartM] = useState(event?.startM ?? 0)
  const [endH, setEndH] = useState(event?.endH ?? (slot?.hour ?? 9) + 1)
  const [endM, setEndM] = useState(event?.endM ?? 0)
  const [color, setColor] = useState(event?.color || 'blue')
  const [repeat, setRepeat] = useState(event?.repeat || 'none')
  const [allDay, setAllDay] = useState(event?.allDay || false)
  const submit = () => {
    if (!title.trim()) return
    onSave({ id: event?.id || uid('e'), title: title.trim(), desc: desc.trim(), dayOfWeek: dow, startH, startM, endH, endM, color, repeat, allDay })
  }
  return (
    <div className="modal-wrap" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card" style={{ width: 420, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 6, boxShadow: 'var(--card-shadow-sel)', padding: '20px 22px', animation: 'modalIn 0.2s ease' }}>
        <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, marginBottom: 16 }}>{event ? 'Edit block' : 'New block'}</div>
        <div style={{ marginBottom: 12 }}><span style={lbl}>What</span><input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} placeholder="e.g. Gym" style={fld} /></div>
        <div style={{ marginBottom: 12 }}><span style={lbl}>Note (optional)</span><input value={desc} onChange={e => setDesc(e.target.value)} style={fld} /></div>
        <div style={{ marginBottom: 12 }}><span style={lbl}>Day</span>
          <select value={dow} onChange={e => setDow(Number(e.target.value))} style={fld}>{DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontFamily: F, fontSize: 13, color: C.muted }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> All day
        </label>
        {!allDay && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}><span style={lbl}>Start</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={startH} onChange={e => setStartH(Number(e.target.value))} style={fld}>{HOURS.map(h => <option key={h} value={h}>{t12(h, 0).replace(':00', '')}</option>)}</select>
                <select value={startM} onChange={e => setStartM(Number(e.target.value))} style={fld}>{[0, 15, 30, 45].map(m => <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>)}</select>
              </div>
            </div>
            <div style={{ flex: 1 }}><span style={lbl}>End</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={endH} onChange={e => setEndH(Number(e.target.value))} style={fld}>{HOURS.map(h => <option key={h} value={h}>{t12(h, 0).replace(':00', '')}</option>)}</select>
                <select value={endM} onChange={e => setEndM(Number(e.target.value))} style={fld}>{[0, 15, 30, 45].map(m => <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>)}</select>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 12 }}><span style={lbl}>Repeat</span>
          <select value={repeat} onChange={e => setRepeat(e.target.value)} style={fld}>
            <option value="none">Weekly (this day)</option><option value="daily">Every day</option><option value="weekdays">Weekdays (Mon–Fri)</option>
          </select>
        </div>
        <div style={{ marginBottom: 18 }}><span style={lbl}>Color</span>
          <div style={{ display: 'flex', gap: 8 }}>{EVENT_COLORS.map(c => <button key={c.id} onClick={() => setColor(c.id)} style={{ width: 26, height: 26, borderRadius: 3, background: c.border, border: color === c.id ? `2px solid ${C.text}` : '2px solid transparent', cursor: 'pointer' }} />)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {event ? <button onClick={() => onDelete(event.id)} style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer' }}>Delete</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} style={{ fontFamily: F, fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 3, cursor: 'pointer', border: 'none', background: C.blue, color: theme === 'light' ? '#fff' : '#0b0b0c' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// TODAY
// ════════════════════════════════════════════════════════════════════════════════
function computeStreak(data) {
  let streak = 0
  const d = new Date(); d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 400; i++) {
    const key = d.toISOString().slice(0, 10)
    const dd = data[key]
    const active = dd && ((dd.done && Object.values(dd.done).some(Boolean)) || (dd.personal && dd.personal.some(p => p.done)) || (dd.notes && dd.notes.trim()))
    if (active) streak++
    else if (i > 0) break
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function TodayView({ data, setData, events }) {
  const today = new Date()
  const todayStr = todayKey()
  const dd = data[todayStr] || { done: {}, notes: '', personal: [] }
  const [newTask, setNewTask] = useState('')
  const scheduled = events.filter(ev => shouldShow(ev, today) && !ev.allDay).sort((a, b) => (a.startH + a.startM / 60) - (b.startH + b.startM / 60))

  const update = patch => { const next = { ...data, [todayStr]: { done: {}, notes: '', personal: [], ...dd, ...patch } }; setData(next); saveData(next) }
  const toggleDone = id => update({ done: { ...dd.done, [id]: !dd.done?.[id] } })
  const addTask = () => { const t = newTask.trim(); if (!t) return; update({ personal: [...(dd.personal || []), { id: uid('p'), text: t, done: false }] }); setNewTask('') }
  const togglePersonal = id => update({ personal: (dd.personal || []).map(p => p.id === id ? { ...p, done: !p.done } : p) })
  const delPersonal = id => update({ personal: (dd.personal || []).filter(p => p.id !== id) })

  const doneCount = scheduled.filter(ev => dd.done?.[ev.id]).length
  const pct = scheduled.length ? Math.round(doneCount / scheduled.length * 100) : 0
  const row = { display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', marginBottom: 7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4 }
  const check = done => ({ width: 20, height: 20, borderRadius: 3, border: `1.5px solid ${done ? C.green : C.border2}`, background: done ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0b0c', fontSize: 12 })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      <H1>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</H1>

      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', margin: '22px 0 10px' }}>The plan — what today is meant to be</div>
      {scheduled.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 11, color: C.muted, marginBottom: 6 }}>
            <span>Today so far</span><span>{doneCount}/{scheduled.length} · {pct}%</span>
          </div>
          <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: C.green, borderRadius: 3, transition: 'width 0.3s' }} /></div>
        </div>
      )}
      {scheduled.length === 0 ? (
        <Panel style={{ padding: '24px', textAlign: 'center', marginBottom: 22 }}><div style={{ fontFamily: F, fontSize: 13, color: C.muted }}>Nothing planned today. Add blocks in Calendar.</div></Panel>
      ) : scheduled.map(ev => {
        const done = !!dd.done?.[ev.id]
        return (
          <div key={ev.id} style={{ ...row, marginTop: 8 }}>
            <div onClick={() => toggleDone(ev.id)} style={check(done)}>{done ? '✓' : ''}</div>
            <div style={{ width: 3, height: 26, borderRadius: 2, background: getEvColor(ev.color).border }} />
            <div style={{ flex: 1, opacity: done ? 0.55 : 1 }}>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.text, textDecoration: done ? 'line-through' : 'none' }}>{ev.title}</div>
              <div style={{ fontFamily: F, fontSize: 11, color: C.dim }}>{t12(ev.startH, ev.startM)} – {t12(ev.endH, ev.endM)}</div>
            </div>
          </div>
        )
      })}

      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', margin: '26px 0 10px' }}>My own list</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask() }} placeholder="add something…" style={{ ...fld, flex: 1 }} />
        <button onClick={addTask} style={obtn(C.blue)}>Add</button>
      </div>
      {(dd.personal || []).map(p => (
        <div key={p.id} style={row}>
          <div onClick={() => togglePersonal(p.id)} style={check(p.done)}>{p.done ? '✓' : ''}</div>
          <span style={{ flex: 1, fontFamily: F, fontSize: 14, color: p.done ? C.muted : C.text, textDecoration: p.done ? 'line-through' : 'none' }}>{p.text}</span>
          <button onClick={() => delPersonal(p.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 15, cursor: 'pointer' }}>×</button>
        </div>
      ))}

      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', margin: '26px 0 10px' }}>A note to myself</div>
      <textarea value={dd.notes || ''} onChange={e => update({ notes: e.target.value })} placeholder="How did today go? Log a win, or just be honest about it." rows={4} style={{ ...fld, background: C.surface, boxShadow: 'var(--card-shadow)', padding: '12px 14px' }} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY
// ════════════════════════════════════════════════════════════════════════════════
function monthsToPayoff(balance, apr, monthly) {
  if (balance <= 0) return 0
  if (!monthly || monthly <= 0) return null
  const r = (apr || 0) / 100 / 12
  if (r <= 0) return Math.ceil(balance / monthly)
  if (monthly <= balance * r) return Infinity
  return Math.ceil(-Math.log(1 - (r * balance) / monthly) / Math.log(1 + r))
}
function payoffDateLabel(months) {
  if (months == null) return null
  if (!isFinite(months)) return 'never (payment too low)'
  const d = new Date(); d.setMonth(d.getMonth() + months)
  return `${months} mo · ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
}

function MoneyView({ finance, setFinance, isMobile }) {
  const [modal, setModal] = useState(null)
  const [newMile, setNewMile] = useState('')
  const debts = finance.debts || []
  const totalBalance = debts.reduce((a, d) => a + Number(d.balance || 0), 0)
  const totalStart = debts.reduce((a, d) => a + Number(d.startBalance || d.balance || 0), 0)
  const paidOff = Math.max(0, totalStart - totalBalance)
  const pctPaid = totalStart > 0 ? Math.round(paidOff / totalStart * 100) : 0
  const monthlyTotal = debts.reduce((a, d) => a + Number(d.monthlyPayment || 0), 0)
  const allMonths = debts.filter(d => d.balance > 0).map(d => monthsToPayoff(d.balance, d.apr, d.monthlyPayment)).filter(m => m != null && isFinite(m))
  const debtFreeMonths = allMonths.length ? Math.max(...allMonths) : null
  const active = debts.filter(d => d.balance > 0)
  const cleared = debts.filter(d => d.balance <= 0)
  const efPct = finance.emergencyGoal > 0 ? Math.min(100, Math.round(finance.emergencySaved / finance.emergencyGoal * 100)) : 0

  const setF = fn => setFinance(f => fn(f))
  const logPayment = (debtId, amt) => {
    amt = Number(amt); if (!amt || amt <= 0) return
    setF(f => ({ ...f, debts: f.debts.map(d => d.id === debtId ? { ...d, balance: Math.max(0, +(d.balance - amt).toFixed(2)) } : d), payments: [{ id: uid('pay'), debtId, amount: amt, date: todayKey() }, ...(f.payments || [])].slice(0, 100) }))
  }
  const saveDebt = debt => { setF(f => ({ ...f, debts: f.debts.some(d => d.id === debt.id) ? f.debts.map(d => d.id === debt.id ? debt : d) : [...f.debts, debt] })); setModal(null) }
  const delDebt = id => { if (confirmSafe('Remove this debt?')) { setF(f => ({ ...f, debts: f.debts.filter(d => d.id !== id) })); setModal(null) } }
  const adjustEF = amt => setF(f => ({ ...f, emergencySaved: Math.max(0, +(Number(f.emergencySaved || 0) + amt).toFixed(2)) }))
  const toggleMile = id => setF(f => ({ ...f, milestones: (f.milestones || []).map(m => m.id === id ? { ...m, done: !m.done } : m) }))
  const addMile = () => { const t = newMile.trim(); if (!t) return; setF(f => ({ ...f, milestones: [...(f.milestones || []), { id: uid('m'), text: t, done: false }] })); setNewMile('') }
  const delMile = id => setF(f => ({ ...f, milestones: (f.milestones || []).filter(m => m.id !== id) }))

  const stat = (label, value, color) => (
    <Panel style={{ padding: '16px 18px' }}>
      <div style={{ fontFamily: F, fontSize: 'clamp(20px,3.4vw,28px)', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 10, color: C.muted, marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </Panel>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', animation: 'fadeUp 0.3s ease', paddingBottom: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <H1>Money</H1>
        <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginTop: 6 }}>Every dollar off the debt is fuel for everything else. Watch it shrink.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {stat('Debt left', money(totalBalance, false), C.red)}
        {stat('Paid off', money(paidOff, false), C.green)}
        {stat('To debt-free', pctPaid + '%', C.blue)}
        {stat('Debt-free in', debtFreeMonths != null ? debtFreeMonths + ' mo' : '—', C.amber)}
      </div>

      <Panel style={{ padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 8 }}>
          <span>Overall progress to debt-free</span><span>{money(paidOff, false)} of {money(totalStart, false)}</span>
        </div>
        <div style={{ height: 12, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: pctPaid + '%', background: C.green, borderRadius: 3, transition: 'width 0.4s' }} /></div>
        {monthlyTotal > 0 && debtFreeMonths != null && isFinite(debtFreeMonths) && <div style={{ fontFamily: F, fontSize: 11.5, color: C.dim, marginTop: 8 }}>At {money(monthlyTotal, false)}/mo across all debts, you&rsquo;re debt-free around {payoffDateLabel(debtFreeMonths).split('·')[1]}.</div>}
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 2px 10px' }}>
        <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800 }}>Debts</span>
        <button onClick={() => setModal({ type: 'new' })} style={obtn(C.blue)}>+ Add debt</button>
      </div>
      {active.map(d => {
        const st = Number(d.startBalance || d.balance)
        const paid = Math.max(0, st - d.balance)
        const p = st > 0 ? Math.round(paid / st * 100) : 0
        const mo = monthsToPayoff(d.balance, d.apr, d.monthlyPayment)
        return (
          <Panel key={d.id} style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color || C.blue }} />
                  <span style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: C.text }}>{d.name}</span>
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: C.dim, marginTop: 3 }}>{d.apr ? d.apr + '% APR · ' : ''}{d.monthlyPayment ? money(d.monthlyPayment, false) + '/mo' : 'no monthly payment set'}{mo != null && isFinite(mo) && d.monthlyPayment ? ' · ' + payoffDateLabel(mo) : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: C.text }}>{money(d.balance)}</div>
                <div style={{ fontFamily: F, fontSize: 10.5, color: C.muted }}>{money(paid, false)} of {money(st, false)} paid</div>
              </div>
            </div>
            <div style={{ height: 8, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}><div style={{ height: '100%', width: p + '%', background: d.color || C.blue, borderRadius: 3, transition: 'width 0.4s' }} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setModal({ type: 'edit', debt: d })} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11.5, cursor: 'pointer' }}>edit</button>
              <button onClick={() => setModal({ type: 'pay', debt: d })} style={obtn(C.green)}>+ Log payment</button>
            </div>
          </Panel>
        )
      })}
      {cleared.length > 0 && cleared.map(d => (
        <Panel key={d.id} style={{ padding: '13px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
          <span style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 700, color: C.green }}>{d.name} — paid off</span>
          <button onClick={() => setModal({ type: 'edit', debt: d })} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>edit</button>
        </Panel>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginTop: 20 }}>
        <Panel style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Emergency fund</div>
          <div style={{ fontFamily: F, fontSize: 11.5, color: C.muted, marginBottom: 12 }}>A cushion so a surprise doesn&rsquo;t become new debt.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 6 }}><span>{money(finance.emergencySaved, false)} saved</span><span>goal {money(finance.emergencyGoal, false)}</span></div>
          <div style={{ height: 10, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}><div style={{ height: '100%', width: efPct + '%', background: C.amber, borderRadius: 3, transition: 'width 0.4s' }} /></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[25, 50, 100].map(a => <button key={a} onClick={() => adjustEF(a)} style={obtn(C.amber)}>+{money(a, false)}</button>)}
            <button onClick={() => { const v = ask('Add how much to the fund?'); if (v) adjustEF(Number(v)) }} style={obtn(C.muted)}>+ custom</button>
            <button onClick={() => adjustEF(-25)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>−$25</button>
          </div>
        </Panel>
        <Panel style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Milestones</div>
          {(finance.milestones || []).map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
              <div onClick={() => toggleMile(m.id)} style={{ width: 18, height: 18, borderRadius: 3, border: `1.5px solid ${m.done ? C.green : C.border2}`, background: m.done ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0b0c', fontSize: 11 }}>{m.done ? '✓' : ''}</div>
              <span style={{ flex: 1, fontFamily: F, fontSize: 12.5, color: m.done ? C.muted : C.text, textDecoration: m.done ? 'line-through' : 'none' }}>{m.text}</span>
              <button onClick={() => delMile(m.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 13, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={newMile} onChange={e => setNewMile(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMile() }} placeholder="+ milestone" style={{ ...fld, flex: 1, fontSize: 12, padding: '7px 9px' }} />
          </div>
        </Panel>
      </div>

      {(finance.payments || []).length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Recent payments</div>
          {(finance.payments || []).slice(0, 8).map(p => {
            const d = debts.find(x => x.id === p.debtId)
            return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12.5, color: C.muted, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}><span>{d ? d.name : 'Payment'} · {p.date}</span><span style={{ color: C.green, fontWeight: 700 }}>−{money(p.amount)}</span></div>
          })}
        </div>
      )}

      {modal && <DebtModal modal={modal} onSave={saveDebt} onDelete={delDebt} onPay={(id, amt) => { logPayment(id, amt); setModal(null) }} onClose={() => setModal(null)} />}
    </div>
  )
}

function DebtModal({ modal, onSave, onDelete, onPay, onClose }) {
  const d = modal.debt
  const isPay = modal.type === 'pay'
  const [name, setName] = useState(d?.name || '')
  const [balance, setBalance] = useState(d?.balance ?? '')
  const [startBalance, setStartBalance] = useState(d?.startBalance ?? d?.balance ?? '')
  const [apr, setApr] = useState(d?.apr ?? '')
  const [monthly, setMonthly] = useState(d?.monthlyPayment ?? '')
  const [payAmt, setPayAmt] = useState('')
  const submit = () => {
    if (isPay) { onPay(d.id, payAmt); return }
    if (!name.trim()) return
    const bal = Number(balance) || 0
    onSave({ id: d?.id || uid('d'), name: name.trim(), balance: bal, startBalance: Number(startBalance) || bal, apr: Number(apr) || 0, monthlyPayment: Number(monthly) || 0, color: d?.color || '#5a78a8' })
  }
  return (
    <div className="modal-wrap" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card" style={{ width: 400, maxWidth: '100%', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 6, boxShadow: 'var(--card-shadow-sel)', padding: '20px 22px', animation: 'modalIn 0.2s ease' }}>
        <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, marginBottom: 16 }}>{isPay ? `Log payment · ${d.name}` : d ? 'Edit debt' : 'Add a debt'}</div>
        {isPay ? (
          <>
            <span style={lbl}>Amount paid</span>
            <input autoFocus type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} placeholder="0.00" style={{ ...fld, marginBottom: 12 }} />
            <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 14 }}>Current balance: {money(d.balance)}</div>
          </>
        ) : (
          <>
            <span style={lbl}>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Car loan" style={{ ...fld, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><span style={lbl}>Balance now</span><input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" style={{ ...fld, marginBottom: 12 }} /></div>
              <div style={{ flex: 1 }}><span style={lbl}>Started at</span><input type="number" value={startBalance} onChange={e => setStartBalance(e.target.value)} placeholder="0" style={{ ...fld, marginBottom: 12 }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><span style={lbl}>APR %</span><input type="number" value={apr} onChange={e => setApr(e.target.value)} placeholder="0" style={{ ...fld, marginBottom: 12 }} /></div>
              <div style={{ flex: 1 }}><span style={lbl}>Monthly payment</span><input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="0" style={{ ...fld, marginBottom: 12 }} /></div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          {d && !isPay ? <button onClick={() => onDelete(d.id)} style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer' }}>Delete</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} style={{ fontFamily: F, fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 3, cursor: 'pointer', border: 'none', background: isPay ? C.green : C.blue, color: '#0b0b0c' }}>{isPay ? 'Log it' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// AVOIDING
// ════════════════════════════════════════════════════════════════════════════════
function AvoidingView({ avoiding, setAvoiding, scheduleBlock, addToToday }) {
  const [text, setText] = useState('')
  const [showFaced, setShowFaced] = useState(false)
  const [flash, setFlash] = useState(null)
  const ping = m => { setFlash(m); setTimeout(() => setFlash(null), 1600) }
  const activeItems = avoiding.filter(a => !a.done)
  const faced = avoiding.filter(a => a.done).sort((a, b) => (b.facedAt || 0) - (a.facedAt || 0))
  const add = () => { const t = text.trim(); if (!t) return; setAvoiding([{ id: uid('av'), text: t, why: '', step: '', created: Date.now(), done: false }, ...avoiding]); setText('') }
  const patch = (id, p) => setAvoiding(avoiding.map(a => a.id === id ? { ...a, ...p } : a))
  const face = id => setAvoiding(avoiding.map(a => a.id === id ? { ...a, done: true, facedAt: Date.now() } : a))
  const unface = id => setAvoiding(avoiding.map(a => a.id === id ? { ...a, done: false, facedAt: null } : a))
  const del = id => setAvoiding(avoiding.filter(a => a.id !== id))
  const daysSince = ts => Math.floor((Date.now() - (ts || Date.now())) / 86400000)
  const ageChip = dnum => { const c = dnum >= 14 ? C.red : dnum >= 4 ? C.amber : C.muted; const txt = dnum <= 0 ? 'today' : dnum === 1 ? '1 day' : dnum + ' days'; return <span style={{ fontFamily: F, fontSize: 10, color: c, whiteSpace: 'nowrap', border: `1px solid ${c}`, borderRadius: 3, padding: '2px 9px' }}>sitting {txt}</span> }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      {flash && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 3, padding: '9px 18px', fontFamily: F, fontSize: 12, color: C.text, boxShadow: 'var(--card-shadow-sel)' }}>{flash}</div>}
      <div style={{ marginBottom: 20 }}>
        <H1>What am I avoiding?</H1>
        <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>The thing you keep sliding past is usually the thing. Name it so it stops running you from the shadows.</p>
      </div>
      <Panel style={{ padding: '16px 18px', marginBottom: 18 }}>
        <span style={lbl}>Name something you&rsquo;re dodging</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="the call, the email, the gym, the hard conversation…" style={{ ...fld, flex: 1, minWidth: 200 }} />
          <button onClick={add} style={{ fontFamily: F, fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue }}>Name it</button>
        </div>
      </Panel>
      <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, margin: '0 2px 12px' }}>On the table <span style={{ color: C.muted, fontSize: 12, fontWeight: 500 }}>{activeItems.length}</span></div>
      {activeItems.length === 0 ? (
        <Panel style={{ padding: '30px 20px', textAlign: 'center' }}><div style={{ fontFamily: F, fontSize: 14, color: C.muted }}>Nothing named right now.</div><div style={{ fontFamily: F, fontSize: 12, color: C.dim, marginTop: 6 }}>When something starts nagging, put it up here before it grows.</div></Panel>
      ) : activeItems.map(a => {
        const dnum = daysSince(a.created)
        return (
          <Panel key={a.id} style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{a.text}</div>{ageChip(dnum)}
            </div>
            <div style={{ marginBottom: 12 }}><span style={lbl}>Why am I really dodging it?</span><textarea value={a.why} onChange={e => patch(a.id, { why: e.target.value })} rows={2} placeholder="fear, boredom, don't know how to start…" style={fld} /></div>
            <div style={{ marginBottom: 14 }}><span style={lbl}>The smallest possible first step</span><input value={a.step} onChange={e => patch(a.id, { step: e.target.value })} placeholder="open the doc. send one line. 5 minutes." style={fld} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => del(a.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>remove</button>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button onClick={() => { addToToday((a.step && a.step.trim()) ? a.step.trim() : a.text); ping('Added to Today →') }} style={obtn(C.muted)}>+ Do today</button>
                <button onClick={() => { scheduleBlock({ title: 'Face: ' + a.text, desc: a.step || '', color: 'amber' }); ping('Scheduled on Calendar →') }} style={obtn(C.amber)}>Schedule</button>
                <button onClick={() => face(a.id)} style={obtn(C.green)}>✓ I faced it</button>
              </div>
            </div>
          </Panel>
        )
      })}
      {faced.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button onClick={() => setShowFaced(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, color: C.green }}>Faced</span><span style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{faced.length}</span><span style={{ color: C.dim, fontSize: 11 }}>{showFaced ? '▲' : '▼'}</span>
          </button>
          <div style={{ fontFamily: F, fontSize: 11, color: C.dim, margin: '2px 2px 10px' }}>Every one of these is a thing you stopped running from.</div>
          {showFaced && faced.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 7 }}>
              <span style={{ color: C.green }}>✓</span>
              <span style={{ flex: 1, fontFamily: F, fontSize: 13, color: C.muted, textDecoration: 'line-through' }}>{a.text}</span>
              <button onClick={() => unface(a.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>undo</button>
              <button onClick={() => del(a.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 13, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// LOOKING BACK heatmap (embedded in Journal)
// ════════════════════════════════════════════════════════════════════════════════
function IntelView({ data, embed }) {
  const weeks = 12
  const cells = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today); start.setDate(today.getDate() - (weeks * 7 - 1))
  start.setDate(start.getDate() - start.getDay())
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const dd = data[key]
    let level = 0
    if (dd) {
      const done = dd.done ? Object.values(dd.done).filter(Boolean).length : 0
      const pers = dd.personal ? dd.personal.filter(p => p.done).length : 0
      const total = done + pers + (dd.notes && dd.notes.trim() ? 1 : 0)
      level = total === 0 ? 0 : total <= 1 ? 1 : total <= 3 ? 2 : total <= 5 ? 3 : 4
    }
    cells.push({ key, level, future: d > today })
  }
  const colors = [C.surface2, 'rgba(125,155,114,0.35)', 'rgba(125,155,114,0.6)', 'rgba(125,155,114,0.85)', C.green]
  const cols = []
  for (let w = 0; w < weeks; w++) cols.push(cells.slice(w * 7, w * 7 + 7))
  const trackedDays = cells.filter(c => c.level > 0).length
  const cleanDays = cells.filter(c => c.level >= 3).length
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <div style={{ fontFamily: F, fontSize: embed ? 14 : 20, fontWeight: 800, marginBottom: 4 }}>Looking back</div>
      <p style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 14 }}>The last 12 weeks — did I show up?</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[['Days shown up', trackedDays, C.blue], ['Strong days', cleanDays, C.green], ['Follow-through', trackedDays ? Math.round(cleanDays / trackedDays * 100) + '%' : '—', C.amber]].map(([l, v, c]) => (
          <Panel key={l} style={{ padding: '14px' }}><div style={{ fontFamily: F, fontSize: 24, fontWeight: 800, color: c, lineHeight: 1 }}>{v}</div><div style={{ fontFamily: F, fontSize: 10, color: C.muted, marginTop: 6 }}>{l}</div></Panel>
        ))}
      </div>
      <Panel style={{ padding: 16, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {cols.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {col.map(c => <div key={c.key} title={c.key} style={{ width: 14, height: 14, borderRadius: 2, background: c.future ? 'transparent' : colors[c.level], border: c.future ? `1px dashed ${C.border}` : 'none' }} />)}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// VISION pieces (Board & Wins — inside Goals)
// ════════════════════════════════════════════════════════════════════════════════
function BoardTab({ vision, setV }) {
  const [editing, setEditing] = useState(null)
  const items = vision.items || []
  const setItems = next => setV({ items: next })
  const addImage = () => { const u = ask('Paste an image URL:'); if (u) setItems([...items, { id: uid('img'), kind: 'image', src: u.trim(), x: 30 + items.length * 12, y: 30 + items.length * 12, w: 220, h: 160, z: items.length }]) }
  const addGoal = () => { const it = { id: uid('g'), kind: 'goal', text: 'New goal', progress: 0, x: 40, y: 40, w: 240, h: 120, z: items.length }; setItems([...items, it]); setEditing(it.id) }
  const addNote = () => { const it = { id: uid('n'), kind: 'text', text: 'A reminder…', x: 40, y: 40, w: 200, h: 100, z: items.length }; setItems([...items, it]); setEditing(it.id) }
  const patch = (id, p) => setItems(items.map(i => i.id === id ? { ...i, ...p } : i))
  const del = id => { setItems(items.filter(i => i.id !== id)); setEditing(null) }
  const upload = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setItems([...items, { id: uid('img'), kind: 'image', src: r.result, x: 40, y: 40, w: 220, h: 160, z: items.length }]); r.readAsDataURL(f); e.target.value = '' }
  const fileRef = useRef()
  const dragStart = (e, it) => {
    const board = e.currentTarget.closest('[data-board]').getBoundingClientRect()
    const offX = e.clientX - board.left - it.x, offY = e.clientY - board.top - it.y
    const move = ev => { patch(it.id, { x: Math.max(0, ev.clientX - board.left - offX), y: Math.max(0, ev.clientY - board.top - offY) }) }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={addImage} style={obtn(C.blue)}>+ Image URL</button>
        <button onClick={() => fileRef.current.click()} style={obtn(C.muted)}>+ Upload image</button>
        <button onClick={addGoal} style={obtn(C.green)}>+ Goal</button>
        <button onClick={addNote} style={obtn(C.muted)}>+ Note</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} />
      </div>
      <div data-board style={{ position: 'relative', width: '100%', minHeight: 460, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', boxShadow: 'var(--card-shadow)', backgroundImage: `radial-gradient(var(--surface2) 1px, transparent 1px)`, backgroundSize: '22px 22px' }}>
        {items.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}><div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.muted }}>Your board is empty.</div><div style={{ fontFamily: F, fontSize: 12, color: C.dim }}>Add images of the life you want. Drag them anywhere.</div></div>}
        {items.slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map(it => (
          <div key={it.id} onMouseDown={e => { if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') dragStart(e, it) }}
            onClick={() => setEditing(it.id)}
            style={{ position: 'absolute', left: it.x, top: it.y, width: it.w, minHeight: it.kind === 'image' ? undefined : it.h, height: it.kind === 'image' ? it.h : undefined, cursor: 'move', zIndex: (it.z || 0) + 1, border: editing === it.id ? `2px solid ${C.blue}` : '2px solid transparent', borderRadius: 5, boxShadow: 'var(--card-shadow)' }}>
            {it.kind === 'image' && <img src={it.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4, display: 'block' }} />}
            {it.kind === 'goal' && (
              <div style={{ background: C.surface2, borderRadius: 4, padding: '12px 14px', height: '100%', borderLeft: `3px solid ${C.green}` }}>
                <input value={it.text} onChange={e => patch(it.id, { text: e.target.value })} style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontFamily: F, fontSize: 14, fontWeight: 700, outline: 'none', marginBottom: 8 }} />
                <div style={{ height: 7, background: C.surface3, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}><div style={{ height: '100%', width: (it.progress || 0) + '%', background: C.green, borderRadius: 3 }} /></div>
                <input type="range" min={0} max={100} value={it.progress || 0} onChange={e => patch(it.id, { progress: Number(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ fontFamily: F, fontSize: 10, color: C.muted, textAlign: 'right' }}>{it.progress || 0}%</div>
              </div>
            )}
            {it.kind === 'text' && <textarea value={it.text} onChange={e => patch(it.id, { text: e.target.value })} style={{ width: '100%', height: '100%', background: C.surface2, border: 'none', borderRadius: 4, color: C.text, fontFamily: F, fontSize: 13, padding: '12px 14px', outline: 'none', resize: 'none', borderLeft: `3px solid ${C.amber}` }} />}
            {editing === it.id && <button onClick={e => { e.stopPropagation(); del(it.id) }} style={{ position: 'absolute', top: -10, right: -10, width: 22, height: 22, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: F, fontSize: 11, color: C.dim, marginTop: 10 }}>Click to select (× removes). Drag to move. Slide a goal to update progress.</div>
    </div>
  )
}

function WinsTab({ vision, setV }) {
  const [text, setText] = useState('')
  const wins = vision.wins || []
  const add = () => { const t = text.trim(); if (!t) return; setV({ wins: [{ id: uid('w'), text: t, date: todayKey() }, ...wins] }); setText('') }
  const del = id => setV({ wins: wins.filter(w => w.id !== id) })
  return (
    <div style={{ maxWidth: 620 }}>
      <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginBottom: 16 }}>Proof you&rsquo;re moving. Log every win. Read them on the hard days.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="something you did / got / became…" style={{ ...fld, flex: 1 }} />
        <button onClick={add} style={obtn(C.amber)}>Log win</button>
      </div>
      {wins.length === 0 ? <div style={{ fontFamily: F, fontSize: 12, color: C.dim }}>No wins logged yet. Start today.</div> : wins.map(w => (
        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '12px 14px', marginBottom: 8, boxShadow: 'var(--card-shadow)' }}>
          <span style={{ color: C.amber, fontSize: 14 }}>★</span>
          <span style={{ flex: 1, fontFamily: F, fontSize: 14, color: C.text }}>{w.text}</span>
          <span style={{ fontFamily: F, fontSize: 10.5, color: C.dim }}>{w.date}</span>
          <button onClick={() => del(w.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 14, cursor: 'pointer' }}>×</button>
        </div>
      ))}
    </div>
  )
}

function MotivationMode({ images, onClose }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => { const i = setInterval(() => setIdx(v => (v + 1) % images.length), 4000); return () => clearInterval(i) }, [images.length])
  useEffect(() => { const h = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [])
  if (!images.length) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <img src={images[idx].src} alt="" style={{ maxWidth: '92%', maxHeight: '86%', objectFit: 'contain', borderRadius: 5 }} />
      <div style={{ position: 'absolute', bottom: 30, display: 'flex', gap: 7 }}>{images.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === idx ? '#f2f2f3' : '#2a2a2e' }} />)}</div>
      <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 28, background: 'none', border: 'none', color: '#f2f2f3', fontSize: 28, cursor: 'pointer' }}>×</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// JOURNAL
// ════════════════════════════════════════════════════════════════════════════════
const MOODS = [['rough', 'var(--red)'], ['low', 'var(--amber)'], ['ok', 'var(--muted)'], ['good', 'var(--holo)'], ['great', 'var(--green)']]
const PROMPTS = [
  'What did you avoid today — and what did it cost you?',
  'What went right that you should repeat?',
  'Where did you show discipline? Where did you fold?',
  'What are you grateful for right now?',
  'What did you learn — about work, people, or yourself?',
  'If today repeated for a year, where would it take you?',
  'What is one thing you can do better tomorrow?',
  'Who did you help, and who helped you?',
  'What is weighing on you that you haven\'t said out loud?',
  'What did progress look like today, even if small?',
]
const normalizeJournal = arr => (arr || []).map(e => ({ id: e.id || ('j_' + (e.date || '') + '_' + (e.ts || Math.round(Math.random() * 1e6))), title: e.title || '', mood: e.mood || '', edited: e.edited || 0, ...e }))

function JournalView({ vision, setVision, data }) {
  const entries = useMemo(() => normalizeJournal(vision.journal).sort((a, b) => (b.ts || 0) - (a.ts || 0)), [vision.journal])
  const [editId, setEditId] = useState(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [mood, setMood] = useState('')
  const [q, setQ] = useState('')
  const [promptIdx, setPromptIdx] = useState(() => dayIndex() % PROMPTS.length)
  const [flash, setFlash] = useState(null)
  const composerRef = useRef()
  const ping = m => { setFlash(m); setTimeout(() => setFlash(null), 1700) }

  const wc = wordCount(text)
  const now = new Date()
  const writeStreak = (() => {
    const days = new Set(entries.map(e => e.date))
    let s = 0; const d = new Date(); d.setHours(0, 0, 0, 0)
    for (let i = 0; i < 400; i++) { const k = d.toISOString().slice(0, 10); if (days.has(k)) s++; else if (i > 0) break; d.setDate(d.getDate() - 1) }
    return s
  })()
  const totalWords = entries.reduce((a, e) => a + wordCount(e.text), 0)

  const commit = () => {
    if (!text.trim() && !title.trim()) { ping('Write something first'); return }
    let next
    if (editId) next = entries.map(e => e.id === editId ? { ...e, title: title.trim(), text, mood, edited: Date.now() } : e)
    else next = [{ id: uid('j'), date: todayKey(), ts: Date.now(), title: title.trim(), text, mood }, ...entries]
    setVision(v => ({ ...v, journal: next }))
    setEditId(null); setTitle(''); setText(''); setMood('')
    ping(editId ? 'Entry updated' : 'Entry posted')
  }
  const startEdit = e => { setEditId(e.id); setTitle(e.title || ''); setText(e.text || ''); setMood(e.mood || ''); if (composerRef.current) composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const cancelEdit = () => { setEditId(null); setTitle(''); setText(''); setMood('') }
  const del = id => { if (!confirmSafe('Delete this entry for good?')) return; setVision(v => ({ ...v, journal: entries.filter(e => e.id !== id) })); if (editId === id) cancelEdit() }
  const usePrompt = () => { const p = PROMPTS[promptIdx]; setText(t => t ? t + '\n\n' + p + '\n' : p + '\n'); setPromptIdx(i => (i + 1) % PROMPTS.length) }

  const filtered = q.trim() ? entries.filter(e => (e.text + ' ' + e.title).toLowerCase().includes(q.toLowerCase())) : entries
  const moodDot = m => { const f = MOODS.find(x => x[0] === m); return f ? f[1] : null }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      {flash && <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '10px 20px', fontFamily: F, fontSize: 12, color: C.text, boxShadow: 'var(--card-shadow-sel)' }}>{flash}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <H1>The Log</H1>
          <p style={{ fontFamily: F, fontSize: 11, color: C.muted, marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Your book. End every day honest.</p>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          {[[entries.length, 'entries'], [writeStreak, 'day streak'], [totalWords.toLocaleString(), 'words']].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}><div style={{ fontFamily: F, fontSize: 20, fontWeight: 800, color: l === 'day streak' && writeStreak > 0 ? C.amber : C.text }}>{v}</div><div style={{ fontFamily: F, fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim }}>{l}</div></div>
          ))}
        </div>
      </div>

      {/* composer */}
      <div ref={composerRef} className="meidcard" style={{ borderRadius: 6, padding: '18px 20px', marginBottom: 22, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800 }}>{editId ? 'Editing entry' : now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          {editId && <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>cancel edit</button>}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={{ ...fld, fontSize: 16, fontWeight: 700, marginBottom: 10 }} />
        <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="What actually happened today? What did you face, feel, learn?" style={{ ...fld, fontSize: 14.5, padding: 14, lineHeight: 1.7 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontFamily: F, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.dim }}>Mood</span>
          {MOODS.map(([m, col]) => (
            <button key={m} onClick={() => setMood(mood === m ? '' : m)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: mood === m ? C.surface3 : 'transparent', border: `1px solid ${mood === m ? col : C.border}`, borderRadius: 20, padding: '4px 10px', cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
              <span style={{ fontFamily: F, fontSize: 11, color: mood === m ? C.text : C.muted, textTransform: 'capitalize' }}>{m}</span>
            </button>
          ))}
        </div>
        <div style={{ background: C.surface2, borderRadius: 4, padding: '10px 12px', margin: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontFamily: F, fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>{PROMPTS[promptIdx]}</span>
          <button onClick={usePrompt} style={obtn(C.holo)}>Use</button>
          <button onClick={() => setPromptIdx(i => (i + 1) % PROMPTS.length)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 15, cursor: 'pointer' }} title="Another prompt">↻</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: F, fontSize: 11, color: wc >= 150 ? C.green : C.muted }}>{wc} words{wc >= 150 ? ' · a full day ✓' : ''}</span>
          <button onClick={commit} style={{ fontFamily: F, fontSize: 13, fontWeight: 800, padding: '10px 22px', borderRadius: 4, cursor: 'pointer', border: 'none', background: C.blue, color: '#0b0b0c' }}>{editId ? 'Save changes' : 'Post entry'}</button>
        </div>
      </div>

      {/* search */}
      {entries.length > 3 && (
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your entries…" style={{ ...fld, marginBottom: 16 }} />
      )}

      {/* entries as book pages */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', fontFamily: F, fontSize: 13, color: C.dim }}>{q ? 'No entries match that.' : 'No entries yet. Write your first one above.'}</div>
      ) : filtered.map((e, i) => (
        <div key={e.id} className="jpage" style={{ padding: '18px 20px', marginBottom: 14, borderLeftColor: moodDot(e.mood) || 'var(--holo)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: F, fontSize: 10.5, color: C.dim, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 7 }}>
                {e.mood && <span style={{ width: 8, height: 8, borderRadius: '50%', background: moodDot(e.mood) }} />}
                {new Date(e.ts || e.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                {e.edited ? ' · edited' : ''}
              </div>
              {e.title && <div style={{ fontFamily: F, fontSize: 17, fontWeight: 800, color: C.text, marginTop: 4, letterSpacing: '-0.01em' }}>{e.title}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => startEdit(e)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
              <button onClick={() => del(e.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 15, cursor: 'pointer' }}>×</button>
            </div>
          </div>
          <p className={'jbody' + (e.title ? '' : ' drop')}>{e.text}</p>
        </div>
      ))}

      {data && <div style={{ marginTop: 30 }}><IntelView data={data} embed /></div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// ME — Body (holo) · Gym · Fuel · Career · Skills · Week
// ════════════════════════════════════════════════════════════════════════════════
const ME_TABS = [['body', 'Body'], ['gym', 'Gym'], ['fuel', 'Fuel'], ['career', 'Career'], ['skills', 'Skills'], ['week', 'My Week']]

function MeView({ me, setMe, applyWeek, isMobile }) {
  const [tab, setTab] = useState('body')
  const [flash, setFlash] = useState(null)
  const ping = m => { setFlash(m); setTimeout(() => setFlash(null), 1800) }
  const weighIns = (me.weighIns || []).slice().sort((a, b) => a.date.localeCompare(b.date))
  const curW = weighIns.length ? weighIns[weighIns.length - 1].lbs : me.startWeight
  const span = me.startWeight - me.goalWeight
  const pct = span > 0 ? Math.min(100, Math.round((me.startWeight - curW) / span * 100)) : 0
  const es = (me.languages || []).find(l => l.id === 'es')
  const vitals = [
    ['Height', `5'${me.heightIn % 12}"`],
    ['Weight', curW + ' lb'],
    ['Goal', me.goalWeight + ' lb'],
    ['Spanish', es ? LEVELS[es.level] : '—'],
  ]
  return (
    <div style={{ maxWidth: 920, margin: '0 auto', animation: 'fadeUp 0.3s ease', paddingBottom: 20 }}>
      {flash && <div style={{ position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 4, padding: '10px 20px', fontFamily: F, fontSize: 12, color: C.text, boxShadow: 'var(--card-shadow-sel)' }}>{flash}</div>}

      {/* identity dossier band */}
      <div className="meidcard" style={{ borderRadius: 16, padding: isMobile ? '18px' : '22px 26px', marginBottom: 18, display: 'flex', gap: isMobile ? 16 : 24, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', position: 'relative', overflow: 'hidden', boxShadow: '0 16px 44px rgba(0,0,0,0.4)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 80% at 12% 30%, var(--holoDim), transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ width: isMobile ? 108 : 124, flexShrink: 0, zIndex: 1 }}><HoloFigure current={curW} start={me.startWeight} goal={me.goalWeight} /></div>
        <div style={{ flex: 1, minWidth: 0, zIndex: 1, textAlign: isMobile ? 'center' : 'left' }}>
          <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.holo, marginBottom: 4 }}>Operative File</div>
          <div style={{ fontFamily: F, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{me.career?.current?.title || 'Program Coordinator'}</div>
          <div style={{ fontFamily: F, fontSize: 13, color: C.muted, marginTop: 4 }}>{me.career?.current?.company || 'CLEAResult'} · en route to the United Nations</div>
          <div style={{ display: 'flex', gap: isMobile ? 12 : 20, marginTop: 14, flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
            {vitals.map(([l, v]) => (
              <div key={l}><div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: C.text }}>{v}</div><div style={{ fontFamily: F, fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.dim }}>{l}</div></div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 10, color: C.dim, marginBottom: 4 }}><span>CUT PROGRESS</span><span>{pct}% · {me.startWeight}→{me.goalWeight}</span></div>
            <div style={{ height: 6, background: C.surface3, borderRadius: 3, overflow: 'hidden', maxWidth: isMobile ? '100%' : 320, margin: isMobile ? '0 auto' : 0 }}><div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg,var(--holo),var(--green))', borderRadius: 3 }} /></div>
          </div>
        </div>
      </div>

      {/* segmented pill tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: 4, marginBottom: 20, background: C.surface2, borderRadius: 10, border: `1px solid ${C.border}` }}>
        {ME_TABS.map(([id, label]) => (
          <button key={id} className="segtab" onClick={() => setTab(id)} style={{ flex: isMobile ? '0 0 auto' : 1, fontFamily: F, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '9px 14px', cursor: 'pointer', border: 'none', borderRadius: 7, background: tab === id ? C.surface : 'transparent', color: tab === id ? C.text : C.muted, boxShadow: tab === id ? 'var(--card-shadow)' : 'none', whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </div>
      {tab === 'body' && <BodyTab me={me} setMe={setMe} isMobile={isMobile} />}
      {tab === 'gym' && <GymTab me={me} setMe={setMe} />}
      {tab === 'fuel' && <FuelTab me={me} />}
      {tab === 'career' && <CareerTab me={me} setMe={setMe} />}
      {tab === 'skills' && <SkillsTab me={me} setMe={setMe} />}
      {tab === 'week' && <WeekTab me={me} applyWeek={applyWeek} ping={ping} />}
    </div>
  )
}

// ── holographic figure: morphs with weight ──
function HoloFigure({ current, start, goal }) {
  const span = Math.max(1, start - goal)
  const t = Math.max(0, Math.min(1.15, (current - goal) / span)) // 1 = start build, 0 = goal build
  const cx = 80
  const sw = 25 + 8 * t     // half shoulder width
  const ww = 13.5 + 13 * t  // half waist
  const hw = 16.5 + 9 * t   // half hip
  const th = 8.5 + 4.5 * t  // thigh half-width
  const cf = 5.5 + 2 * t    // calf half-width
  const ar = 5.5 + 2.5 * t  // arm half-width

  const torso = (sw2, ww2, hw2) =>
    `M ${cx - sw2} 56 C ${cx - sw2 - 2} 70, ${cx - ww2 - 2} 84, ${cx - ww2} 96 C ${cx - ww2 + 1} 104, ${cx - hw2} 110, ${cx - hw2} 118 L ${cx + hw2} 118 C ${cx + hw2} 110, ${cx + ww2 - 1} 104, ${cx + ww2} 96 C ${cx + ww2 + 2} 84, ${cx + sw2 + 2} 70, ${cx + sw2} 56 Z`
  const leg = (s, hw2, th2, cf2) =>
    `M ${cx + s * 3} 118 L ${cx + s * hw2} 118 C ${cx + s * (th2 + 5)} 152, ${cx + s * (cf2 + 4)} 186, ${cx + s * (cf2 + 3)} 214 L ${cx + s * 3.5} 214 C ${cx + s * 5} 186, ${cx + s * 4} 152, ${cx + s * 3} 118 Z`
  const arm = s => {
    const x0 = cx + s * (sw + 2)
    return `M ${x0} 58 C ${x0 + s * ar * 2} 62, ${x0 + s * ar * 2} 62, ${x0 + s * ar * 2} 74 L ${x0 + s * ar * 1.6} 116 C ${x0 + s * ar * 1.2} 122, ${x0 + s * ar * 0.2} 122, ${x0 + s * ar * 0.1} 116 L ${x0} 74 Z`
  }
  const figure = (sw2, ww2, hw2, th2, cf2, key, style) => (
    <g key={key} {...style}>
      <circle cx={cx} cy={30} r={14.5} />
      <rect x={cx - 5.5} y={44} width={11} height={12} rx={3} />
      <path d={torso(sw2, ww2, hw2)} />
      <path d={arm(-1)} />
      <path d={arm(1)} />
      <path d={leg(-1, hw2, th2, cf2)} />
      <path d={leg(1, hw2, th2, cf2)} />
    </g>
  )
  const gsw = 25, gww = 13.5, ghw = 16.5, gth = 8.5, gcf = 5.5
  return (
    <svg viewBox="0 0 160 236" width="100%" style={{ maxWidth: 230, display: 'block', margin: '0 auto', animation: 'holoPulse 4s ease-in-out infinite' }}>
      <defs>
        <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.4" fill="var(--holo)" opacity="0.35" />
        </pattern>
        <mask id="figmask">
          <g fill="#fff">{figure(sw, ww, hw, th, cf, 'm')}</g>
        </mask>
      </defs>
      {/* grid floor */}
      <ellipse cx={cx} cy={224} rx={54} ry={8} fill="none" stroke="var(--holo)" strokeWidth="1" opacity="0.35" />
      <ellipse cx={cx} cy={224} rx={34} ry={5} fill="none" stroke="var(--holo)" strokeWidth="0.8" opacity="0.22" />
      {/* goal ghost */}
      <g fill="none" stroke="var(--holo)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.4">{figure(gsw, gww, ghw, gth, gcf, 'g')}</g>
      {/* current body */}
      <g fill="var(--holoDim)" stroke="var(--holo)" strokeWidth="1.8">{figure(sw, ww, hw, th, cf, 'c')}</g>
      {/* scanlines inside body */}
      <rect x="0" y="0" width="160" height="236" fill="url(#scan)" mask="url(#figmask)" style={{ animation: 'scanMove 1.6s linear infinite' }} />
    </svg>
  )
}

function BodyTab({ me, setMe, isMobile }) {
  const [w, setW] = useState('')
  const weighIns = (me.weighIns || []).slice().sort((a, b) => a.date.localeCompare(b.date))
  const current = weighIns.length ? weighIns[weighIns.length - 1].lbs : me.startWeight
  const lost = Math.max(0, me.startWeight - current)
  const toGo = Math.max(0, current - me.goalWeight)
  const totalSpan = me.startWeight - me.goalWeight
  const pct = totalSpan > 0 ? Math.min(100, Math.round(lost / totalSpan * 100)) : 0
  const log = () => { const v = Number(w); if (!v || v < 60 || v > 500) return; setMe(m => ({ ...m, weighIns: [...(m.weighIns || []).filter(x => x.date !== todayKey()), { id: uid('w'), date: todayKey(), lbs: v }] })); setW('') }
  const delWeigh = id => setMe(m => ({ ...m, weighIns: (m.weighIns || []).filter(x => x.id !== id) }))
  const editNums = () => { const s = ask('Start weight (lbs)?'); const g = ask('Goal weight (lbs)?'); setMe(m => ({ ...m, startWeight: Number(s) || m.startWeight, goalWeight: Number(g) || m.goalWeight })) }

  const spark = (() => {
    if (weighIns.length < 2) return null
    const W = 560, H = 110, pad = 10
    const lo = Math.min(...weighIns.map(x => x.lbs), me.goalWeight) - 2
    const hi = Math.max(...weighIns.map(x => x.lbs), me.startWeight) + 2
    const pts = weighIns.map((x, i) => {
      const px = pad + (i / (weighIns.length - 1)) * (W - pad * 2)
      const py = pad + (1 - (x.lbs - lo) / (hi - lo)) * (H - pad * 2)
      return [px, py]
    })
    const goalY = pad + (1 - (me.goalWeight - lo) / (hi - lo)) * (H - pad * 2)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <line x1={pad} y1={goalY} x2={W - pad} y2={goalY} stroke="var(--green)" strokeDasharray="5 5" strokeWidth="1.5" opacity="0.7" />
        <text x={W - pad} y={goalY - 5} textAnchor="end" fontSize="10" fill="var(--green)" fontFamily="Inter">goal {me.goalWeight}</text>
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--holo)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--holo)" />)}
      </svg>
    )
  })()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '250px 1fr', gap: 18, alignItems: 'start' }}>
      {/* holographic figure */}
      <Panel style={{ padding: '20px 14px 12px', textAlign: 'center' }}>
        <HoloFigure current={current} start={me.startWeight} goal={me.goalWeight} />
        <div style={{ fontFamily: F, fontSize: 26, fontWeight: 800, color: C.holo, marginTop: 6 }}>{current}<span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}> lb</span></div>
        <div style={{ fontFamily: F, fontSize: 10, color: C.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>solid = now · dashed = goal</div>
      </Panel>

      <div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          {[[`5'${me.heightIn % 12}"`, 'Height'], [me.startWeight + ' lb', 'Started'], [me.goalWeight + ' lb', 'Goal'], [lost.toFixed(1) + ' lb', 'Lost']].map(([v, l]) => (
            <Panel key={l} style={{ padding: '13px 14px' }}>
              <div style={{ fontFamily: F, fontSize: 19, fontWeight: 800, color: l === 'Lost' && lost > 0 ? C.green : C.text, lineHeight: 1 }}>{v}</div>
              <div style={{ fontFamily: F, fontSize: 9.5, color: C.muted, marginTop: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
            </Panel>
          ))}
        </div>
        <Panel style={{ padding: '15px 17px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 8 }}>
            <span>{me.startWeight} → {me.goalWeight} lbs</span>
            <span>{pct}% there · {toGo.toFixed(1)} to go <span onClick={editNums} style={{ cursor: 'pointer', color: C.dim }}>✎</span></span>
          </div>
          <div style={{ height: 10, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: C.holo, borderRadius: 3, transition: 'width 0.4s' }} /></div>
        </Panel>
        <Panel style={{ padding: '15px 17px', marginBottom: 14 }}>
          <span style={lbl}>Log today&rsquo;s weigh-in — same time each day, mornings are best</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={w} onChange={e => setW(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') log() }} placeholder={String(current)} style={{ ...fld, flex: 1 }} />
            <button onClick={log} style={obtn(C.holo)}>Log it</button>
          </div>
        </Panel>
        {spark && <Panel style={{ padding: '15px 17px', marginBottom: 14 }}>{spark}</Panel>}
        {weighIns.length > 0 && (
          <div>
            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>History</div>
            {weighIns.slice().reverse().slice(0, 8).map(x => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12.5, color: C.muted, padding: '7px 2px', borderBottom: `1px solid ${C.border}` }}>
                <span>{x.date}</span><span style={{ color: C.text, fontWeight: 700 }}>{x.lbs} lb <span onClick={() => delWeigh(x.id)} style={{ color: C.dim, cursor: 'pointer', marginLeft: 8 }}>×</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GymTab({ me, setMe }) {
  const routine = me.routine || []
  const patch = (id, p) => setMe(m => ({ ...m, routine: m.routine.map(r => r.id === id ? { ...r, ...p } : r) }))
  const add = () => setMe(m => ({ ...m, routine: [...m.routine, { id: uid('r'), day: 3, name: 'New day', items: '' }] }))
  const del = id => setMe(m => ({ ...m, routine: m.routine.filter(r => r.id !== id) }))
  const todayDow = new Date().getDay()
  return (
    <div>
      <p style={{ fontFamily: F, fontSize: 12.5, color: C.muted, marginBottom: 14 }}>Your split — edit anything. Today&rsquo;s session is marked. The 6am pushups/situps run daily on top of this.</p>
      {routine.slice().sort((a, b) => a.day - b.day).map(r => {
        const isToday = r.day === todayDow
        return (
          <Panel key={r.id} style={{ padding: '15px 17px', marginBottom: 12, border: isToday ? `1px solid ${C.blue}` : `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <select value={r.day} onChange={e => patch(r.id, { day: Number(e.target.value) })} style={{ ...fld, width: 130 }}>
                {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input value={r.name} onChange={e => patch(r.id, { name: e.target.value })} style={{ ...fld, flex: 1, minWidth: 140, fontSize: 14, fontWeight: 700 }} />
              {isToday && <span style={{ fontFamily: F, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 3, padding: '3px 10px' }}>TODAY</span>}
              <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 14, cursor: 'pointer' }}>×</button>
            </div>
            <textarea value={r.items} onChange={e => patch(r.id, { items: e.target.value })} rows={Math.max(3, (r.items || '').split('\n').length)} placeholder={'One exercise per line…'} style={{ ...fld, lineHeight: 1.7 }} />
          </Panel>
        )
      })}
      <button onClick={add} style={obtn(C.blue)}>+ Add a day</button>
    </div>
  )
}

function FuelTab({ me }) {
  const kcal = 1950, protein = 155
  const foods = [
    ['Eggs', '~$4/dozen · 6g protein each'],
    ['Chicken (thighs/breast)', 'the backbone — buy family packs'],
    ['Ground turkey 93%', 'quick bowls, tacos, pasta'],
    ['Canned tuna', 'cheapest protein per dollar there is'],
    ['Greek yogurt (plain, big tub)', '~17g protein per serving'],
    ['Cottage cheese', 'night-time protein'],
    ['Rice + beans', 'cheap volume, real food'],
    ['Frozen vegetables', 'no waste, always ready'],
    ['Oats', 'breakfast base for pennies'],
    ['Whey protein', 'only if the budget allows — food first'],
  ]
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[[kcal.toLocaleString(), 'Calories / day'], [protein + 'g', 'Protein / day'], ['$350', 'Food budget / mo']].map(([v, l]) => (
          <Panel key={l} style={{ padding: '15px 16px' }}>
            <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: F, fontSize: 9.5, color: C.muted, marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
          </Panel>
        ))}
      </div>
      <Panel style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, marginBottom: 8 }}>The cut, kept simple</div>
        <div style={{ fontFamily: F, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
          At 5&rsquo;5&rdquo; and {me.startWeight} lbs, roughly <b style={{ color: C.text }}>{kcal.toLocaleString()} calories</b> and <b style={{ color: C.text }}>{protein}g protein</b> a day loses about 1–1.5 lb a week without starving. Protein first at every meal — it keeps muscle on while the fat comes off, especially with your lifting.
          <br /><br />Cook most meals ($250 groceries), keep restaurants inside $100, drink mostly water, don&rsquo;t drink calories. One rule beats ten: <b style={{ color: C.text }}>if you didn&rsquo;t plan it, don&rsquo;t eat it.</b>
        </div>
      </Panel>
      <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Cheap protein that fits the budget</div>
      {foods.map(([n, d]) => (
        <div key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: F, fontSize: 12.5, padding: '8px 2px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.text, fontWeight: 600 }}>{n}</span><span style={{ color: C.muted, textAlign: 'right' }}>{d}</span>
        </div>
      ))}
      <div style={{ fontFamily: F, fontSize: 10.5, color: C.dim, marginTop: 12 }}>Sensible guidance, not medical advice — adjust to how your body responds.</div>
    </div>
  )
}

function CareerTab({ me, setMe }) {
  const c = me.career
  const [skill, setSkill] = useState('')
  const setC = p => setMe(m => ({ ...m, career: { ...m.career, ...p } }))
  const addSkill = () => { const s = skill.trim(); if (!s) return; setC({ skills: [...c.skills, s] }); setSkill('') }
  const delSkill = s => setC({ skills: c.skills.filter(x => x !== s) })
  const addPast = () => { const t = ask('Job title?'); if (!t) return; const co = ask('Company?') || ''; const y = ask('Years (e.g. 2022–2024)?') || ''; setC({ past: [...(c.past || []), { id: uid('j'), title: t, company: co, years: y }] }) }
  const delPast = id => setC({ past: (c.past || []).filter(j => j.id !== id) })
  return (
    <div style={{ maxWidth: 680 }}>
      <Panel style={{ padding: '16px 18px', marginBottom: 14, borderLeft: `3px solid ${C.blue}` }}>
        <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Now</div>
        <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: C.text }}>{c.current.title} · {c.current.company}</div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.muted, marginTop: 4 }}>{c.current.notes}</div>
      </Panel>
      <Panel style={{ padding: '16px 18px', marginBottom: 14, borderLeft: `3px solid ${C.amber}` }}>
        <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>The destination</div>
        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.text }}>{c.target}</div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginTop: 4 }}>Every skill below is a brick in that road.</div>
      </Panel>
      <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, margin: '18px 0 10px' }}>Skills I&rsquo;m stacking</div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
        {c.skills.map(s => <span key={s} style={{ fontFamily: F, fontSize: 12, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 3, padding: '5px 12px', color: C.text }}>{s} <span onClick={() => delSkill(s)} style={{ color: C.dim, cursor: 'pointer' }}>×</span></span>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={skill} onChange={e => setSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSkill() }} placeholder="+ new skill" style={{ ...fld, flex: 1 }} />
        <button onClick={addSkill} style={obtn(C.blue)}>Add</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800 }}>Where I&rsquo;ve been</span>
        <button onClick={addPast} style={{ background: 'none', border: 'none', color: C.blue, fontSize: 12, cursor: 'pointer' }}>+ add past job</button>
      </div>
      {(c.past || []).length === 0 ? <div style={{ fontFamily: F, fontSize: 12, color: C.dim }}>Add your past roles to build the timeline.</div> : (c.past || []).map(j => (
        <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 13, padding: '9px 2px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.text }}>{j.title}{j.company ? ' · ' + j.company : ''}</span>
          <span style={{ color: C.muted }}>{j.years} <span onClick={() => delPast(j.id)} style={{ color: C.dim, cursor: 'pointer', marginLeft: 6 }}>×</span></span>
        </div>
      ))}
    </div>
  )
}

// ── skills: languages + hobby XP bars ──
const levelName = xp => xp < 15 ? 'Novice' : xp < 35 ? 'Beginner' : xp < 60 ? 'Intermediate' : xp < 80 ? 'Advanced' : xp < 95 ? 'Expert' : 'Master'

function SkillsTab({ me, setMe }) {
  const langs = me.languages || []
  const hobbies = me.hobbies || []
  const setLevel = (id, level) => setMe(m => ({ ...m, languages: m.languages.map(l => l.id === id ? { ...l, level } : l) }))
  const patchHobby = (id, fn) => setMe(m => ({ ...m, hobbies: (m.hobbies || []).map(h => h.id === id ? fn(h) : h) }))
  const logPractice = (id, minutes) => patchHobby(id, h => ({ ...h, xp: Math.min(100, +(h.xp + minutes / 30).toFixed(1)), log: [{ id: uid('s'), date: todayKey(), minutes }, ...(h.log || [])].slice(0, 300) }))
  const setXp = id => { const v = ask('Set skill level 0–100:'); if (v == null || v === '') return; patchHobby(id, h => ({ ...h, xp: Math.max(0, Math.min(100, Number(v) || 0)) })) }
  const addHobby = () => { const n = ask('Name the skill/hobby:'); if (!n) return; setMe(m => ({ ...m, hobbies: [...(m.hobbies || []), { id: uid('h'), name: n.trim(), xp: 0, log: [] }] })) }
  const delHobby = id => { if (confirmSafe('Remove this skill?')) setMe(m => ({ ...m, hobbies: (m.hobbies || []).filter(h => h.id !== id) })) }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Languages — the UN currency</div>
      <p style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 14 }}>Tap the level you&rsquo;re at. Spanish to B2 and French to B1 make you a real international candidate.</p>
      {langs.map(l => (
        <Panel key={l.id} style={{ padding: '15px 17px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700 }}>{l.flag} {l.name}</span>
            <span style={{ fontFamily: F, fontSize: 11, color: C.muted }}>target: {LEVELS[l.target]}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LEVELS.map((lv, i) => {
              const reached = i <= l.level && i > 0
              const isTarget = i === l.target
              return (
                <button key={lv} onClick={() => setLevel(l.id, i)} style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 3, cursor: 'pointer', border: `1px solid ${reached ? C.green : isTarget ? C.amber : C.border}`, background: reached ? 'rgba(125,155,114,0.15)' : 'transparent', color: reached ? C.green : isTarget ? C.amber : C.muted }}>{lv}</button>
              )
            })}
          </div>
        </Panel>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '24px 0 4px' }}>
        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 800 }}>Skill bars</div>
        <button onClick={addHobby} style={{ background: 'none', border: 'none', color: C.blue, fontSize: 12, cursor: 'pointer' }}>+ add a skill</button>
      </div>
      <p style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 14 }}>Practice fills the bar — 30 minutes = 1 point. Level yourself up like a character.</p>
      {hobbies.map(h => {
        const week = (h.log || []).filter(s => (Date.now() - new Date(s.date).getTime()) < 7 * 86400000)
        const totalH = Math.round((h.log || []).reduce((a, s) => a + s.minutes, 0) / 60)
        return (
          <Panel key={h.id} style={{ padding: '15px 17px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={h.name} onChange={e => patchHobby(h.id, x => ({ ...x, name: e.target.value }))} style={{ background: 'transparent', border: 'none', fontFamily: F, fontSize: 15, fontWeight: 700, color: C.text, outline: 'none', flex: 1, minWidth: 120 }} />
              <span style={{ fontFamily: F, fontSize: 11, color: C.holo, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{levelName(h.xp)} · {Math.round(h.xp)}/100</span>
            </div>
            <div style={{ height: 10, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: h.xp + '%', background: `linear-gradient(90deg, var(--holo), ${C.blue})`, borderRadius: 3, transition: 'width 0.2s' }} />
            </div>
            <input type="range" min={0} max={100} value={Math.round(h.xp)} onChange={e => patchHobby(h.id, x => ({ ...x, xp: Number(e.target.value) }))} style={{ width: '100%', accentColor: C.holo, marginBottom: 8, cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: F, fontSize: 11, color: C.dim }}>{week.length} session{week.length !== 1 ? 's' : ''} this week · {totalH}h all-time · drag to set, or log time:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => logPractice(h.id, 15)} style={obtn(C.muted)}>+15m</button>
                <button onClick={() => logPractice(h.id, 30)} style={obtn(C.holo)}>+30m</button>
                <button onClick={() => logPractice(h.id, 60)} style={obtn(C.holo)}>+1h</button>
                <button onClick={() => delHobby(h.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer' }}>×</button>
              </div>
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

function WeekTab({ me, applyWeek, ping }) {
  const tmpl = buildWeekTemplate(me)
  const byDay = DAYS_FULL.map((d, i) => ({ day: d, items: tmpl.filter(t => t.dayOfWeek === i) }))
  return (
    <div style={{ maxWidth: 720 }}>
      <Panel style={{ padding: '18px 20px', marginBottom: 18, borderLeft: `3px solid ${C.amber}` }}>
        <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Your weekly rhythm</div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
          Work owns Mon–Fri days, so everything else lives in the edges: gym after work, languages and guitar rotate evenings, Substack gets Saturday morning, Sunday is Flight Pathways plus the weekly review. One tap loads it all into your calendar — then Sync to phone so it alarms you.
        </div>
        <button onClick={() => { const n = applyWeek(); ping(n > 0 ? `Added ${n} blocks to your calendar →` : 'Already loaded — check your calendar') }}
          style={{ fontFamily: F, fontSize: 13, fontWeight: 700, padding: '11px 20px', borderRadius: 3, cursor: 'pointer', border: 'none', background: C.blue, color: '#0b0b0c' }}>Load my week into the calendar →</button>
      </Panel>
      {byDay.map(({ day, items }) => items.length > 0 && (
        <div key={day} style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{day}</div>
          {items.sort((a, b) => a.startH - b.startH).map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: '9px 13px', marginBottom: 6 }}>
              <div style={{ width: 4, height: 22, borderRadius: 2, background: getEvColor(t.color).border }} />
              <span style={{ flex: 1, fontFamily: F, fontSize: 13, color: C.text }}>{t.title}</span>
              <span style={{ fontFamily: F, fontSize: 11, color: C.muted }}>{t12(t.startH, t.startM)}–{t12(t.endH, t.endM)}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{ fontFamily: F, fontSize: 11, color: C.dim }}>Change your gym days in the Gym tab and this plan follows. Loading skips anything already on your calendar.</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// GOALS — the unlock chain
// ════════════════════════════════════════════════════════════════════════════════
function GoalsView({ goals, setGoals, vision, setVision, finance, me }) {
  const [tab, setTab] = useState('goals')
  const [motiv, setMotiv] = useState(false)
  const setV = patch => setVision(v => ({ ...v, ...patch }))
  const images = (vision.items || []).filter(i => i.kind === 'image')
  return (
    <div style={{ animation: 'fadeUp 0.3s ease', paddingBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <H1>Goals</H1>
        {images.length > 0 && tab === 'board' && <button onClick={() => setMotiv(true)} style={obtn(C.amber)}>Motivation mode</button>}
      </div>
      <div style={{ display: 'flex', gap: 4, margin: '14px 0 20px', borderBottom: `1px solid ${C.border}` }}>
        {[['goals', 'The Chain'], ['board', 'Board'], ['wins', 'Wins']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ fontFamily: F, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 13px', cursor: 'pointer', border: 'none', background: 'transparent', color: tab === id ? C.blue : C.muted, borderBottom: tab === id ? `2px solid ${C.blue}` : '2px solid transparent' }}>{label}</button>
        ))}
      </div>
      {tab === 'goals' && <ChainTab goals={goals} setGoals={setGoals} finance={finance} me={me} />}
      {tab === 'board' && <BoardTab vision={vision} setV={setV} />}
      {tab === 'wins' && <WinsTab vision={vision} setV={setV} />}
      {motiv && <MotivationMode images={images} onClose={() => setMotiv(false)} />}
    </div>
  )
}

function ChainTab({ goals, setGoals, finance, me }) {
  const [postTitle, setPostTitle] = useState('')
  const toggleMs = (listKey, gid, mid) => setGoals(g => ({ ...g, [listKey]: g[listKey].map(goal => goal.id === gid ? { ...goal, ms: goal.ms.map(m => m.id === mid ? { ...m, done: !m.done } : m) } : goal) }))
  const pct = goal => { const t = goal.ms.length; const d = goal.ms.filter(m => m.done).length; return t ? Math.round(d / t * 100) : 0 }
  const debts = finance.debts || []
  const totalBalance = debts.reduce((a, d) => a + Number(d.balance || 0), 0)
  const sub = goals.substack || { posts: 0, subs: 0, log: [] }
  const setSub = p => setGoals(g => ({ ...g, substack: { ...(g.substack || {}), ...p } }))
  const logPost = () => { const t = postTitle.trim() || 'Untitled post'; setSub({ posts: (sub.posts || 0) + 1, log: [{ id: uid('sp'), date: todayKey(), title: t }, ...(sub.log || [])].slice(0, 100) }); setPostTitle('') }
  const editSubs = () => { const v = ask('Current subscriber count?'); if (v != null && v !== '') setSub({ subs: Number(v) || 0 }) }
  const es = (me.languages || []).find(l => l.id === 'es')

  const goalCard = (goal, idx, listKey, extra) => {
    const p = pct(goal)
    const complete = p === 100
    return (
      <Panel key={goal.id} style={{ padding: '17px 19px', marginBottom: 14, borderLeft: `3px solid ${complete ? C.green : idx === 0 && listKey === 'chain' ? C.amber : C.border2}` }}>
        <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
          {listKey === 'chain' && <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: complete ? C.green : C.blue, opacity: 0.55, lineHeight: 1, minWidth: 24 }}>{idx + 1}</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800, color: C.text }}>{goal.title} {complete && '✓'}</div>
              <span style={{ fontFamily: F, fontSize: 12, color: complete ? C.green : C.muted, fontWeight: 700 }}>{p}%</span>
            </div>
            <div style={{ fontFamily: F, fontSize: 12, color: C.muted, margin: '3px 0 10px' }}>{goal.sub}</div>
            <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}><div style={{ height: '100%', width: p + '%', background: complete ? C.green : C.blue, borderRadius: 3, transition: 'width 0.3s' }} /></div>
            {extra}
            {goal.ms.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
                <div onClick={() => toggleMs(listKey, goal.id, m.id)} style={{ width: 17, height: 17, borderRadius: 3, border: `1.5px solid ${m.done ? C.green : C.border2}`, background: m.done ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0b0c', fontSize: 10 }}>{m.done ? '✓' : ''}</div>
                <span style={{ fontFamily: F, fontSize: 13, color: m.done ? C.muted : C.text, textDecoration: m.done ? 'line-through' : 'none' }}>{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.55 }}>No fake deadlines — the goals unlock in <b style={{ color: C.text }}>sequence</b>. Money first, because every dollar of interest you stop paying becomes fuel for everything below it.</p>
      {goals.chain.map((g, i) => goalCard(g, i, 'chain',
        g.id === 'g_fin' ? <div style={{ fontFamily: F, fontSize: 11.5, color: C.dim, marginBottom: 10 }}>Live from Money: <b style={{ color: totalBalance > 0 ? C.red : C.green }}>{money(totalBalance, false)}</b> still on the books.</div>
          : g.id === 'g_un' && es ? <div style={{ fontFamily: F, fontSize: 11.5, color: C.dim, marginBottom: 10 }}>Live from Skills: Spanish is at <b style={{ color: C.amber }}>{LEVELS[es.level]}</b> — B2 is the bar.</div> : null))}

      <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, margin: '24px 0 12px' }}>Running alongside</div>

      <Panel style={{ padding: '17px 19px', marginBottom: 14, borderLeft: `3px solid ${C.amber}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ fontFamily: F, fontSize: 16, fontWeight: 800 }}>Substack</div>
          <span onClick={editSubs} style={{ fontFamily: F, fontSize: 12, color: C.muted, cursor: 'pointer' }}>{sub.subs || 0} subscribers ✎</span>
        </div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 12 }}>&ldquo;Big on Substack&rdquo; is just &ldquo;published consistently for a long time.&rdquo; Saturday mornings are yours — protect them.</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'center', background: C.surface2, borderRadius: 4, padding: '10px 6px' }}>
            <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: C.amber }}>{sub.posts || 0}</div>
            <div style={{ fontFamily: F, fontSize: 9.5, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>posts published</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', background: C.surface2, borderRadius: 4, padding: '10px 6px' }}>
            <div style={{ fontFamily: F, fontSize: 22, fontWeight: 800, color: C.text }}>{(sub.log || []).filter(l => (Date.now() - new Date(l.date).getTime()) < 30 * 86400000).length}</div>
            <div style={{ fontFamily: F, fontSize: 9.5, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>last 30 days</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={postTitle} onChange={e => setPostTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') logPost() }} placeholder="post title…" style={{ ...fld, flex: 1 }} />
          <button onClick={logPost} style={obtn(C.amber)}>+ Published one</button>
        </div>
        {(sub.log || []).slice(0, 4).map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12, color: C.muted, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}><span>{l.title}</span><span style={{ color: C.dim }}>{l.date}</span></div>)}
      </Panel>

      {goals.parallel.map((g, i) => goalCard(g, i, 'parallel', null))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════════════════
const BOOT_LINES = ['Lighting the forge...', 'You are not finished. That is the point.', 'What you avoid today is still here tomorrow.', 'So pick one hard thing. Start there.', 'Back to work.']
function BootScreen() {
  const [n, setN] = useState(0)
  useEffect(() => { if (n < BOOT_LINES.length) { const t = setTimeout(() => setN(n + 1), 360); return () => clearTimeout(t) } }, [n])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0b0c', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
      <div style={{ width: 380, maxWidth: '90%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Ember size={52} color="#f2f2f3" /></div>
          <div style={{ fontFamily: F, fontSize: 28, fontWeight: 800, letterSpacing: '0.2em', color: '#ececee' }}>FORGE</div>
        </div>
        <div style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '20px 22px', minHeight: 168 }}>
          {BOOT_LINES.slice(0, n).map((l, i) => (
            <div key={i} style={{ fontFamily: F, fontSize: i === BOOT_LINES.length - 1 ? 15 : 13, fontWeight: i === BOOT_LINES.length - 1 ? 700 : 400, color: i === BOOT_LINES.length - 1 ? '#ececee' : '#8a8f98', lineHeight: '24px', animation: 'slideIn 0.2s ease', marginTop: i === BOOT_LINES.length - 1 ? 6 : 0 }}>
              <span style={{ color: '#4d5057', marginRight: 8 }}>{i === BOOT_LINES.length - 1 ? '❯' : '·'}</span>{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SHELL — top nav layout
// ════════════════════════════════════════════════════════════════════════════════
function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 820)
  useEffect(() => { const f = () => setM(window.innerWidth <= 820); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return m
}
const NAV = [['calendar', 'Calendar'], ['today', 'Today'], ['me', 'Me'], ['money', 'Money'], ['goals', 'Goals'], ['avoiding', 'Avoiding'], ['journal', 'Journal']]

// ════════════════════════════════════════════════════════════════════════════════
// HUB — Me centerpiece, sections orbiting
// ════════════════════════════════════════════════════════════════════════════════
// ── circular progress ring ──
function Ring({ pct, size = 74, stroke = 7, color, value, unit, label, onClick }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(1, (pct || 0) / 100)))
  return (
    <button onClick={onClick} className="ringbtn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: 0 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: F, fontSize: size * 0.25, fontWeight: 800, color: C.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
          {unit && <div style={{ fontFamily: F, fontSize: 8, color: C.dim, letterSpacing: '0.06em', marginTop: 1 }}>{unit}</div>}
        </div>
      </div>
      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted }}>{label}</div>
    </button>
  )
}

function HubClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  const h = t.getHours() % 12 || 12, m = String(t.getMinutes()).padStart(2, '0'), s = String(t.getSeconds()).padStart(2, '0')
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: F, fontSize: 'clamp(38px,7vw,60px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{h}<span style={{ animation: 'blink 2s step-end infinite' }}>:</span>{m}</span>
      <span style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: C.muted }}>{s} {t.getHours() >= 12 ? 'PM' : 'AM'}</span>
    </div>
  )
}

function HubView({ go, me, data, events, finance, goals, avoiding, vision, streak, journalDue, isMobile }) {
  const todayStr = todayKey()
  const dd = data[todayStr] || { done: {}, personal: [] }
  const weighIns = (me.weighIns || []).slice().sort((a, b) => a.date.localeCompare(b.date))
  const curW = weighIns.length ? weighIns[weighIns.length - 1].lbs : me.startWeight
  const today = new Date()
  const scheduled = events.filter(ev => shouldShow(ev, today) && !ev.allDay).sort((a, b) => (a.startH + a.startM / 60) - (b.startH + b.startM / 60))
  const doneToday = scheduled.filter(ev => dd.done?.[ev.id]).length + (dd.personal || []).filter(p => p.done).length
  const totalToday = scheduled.length + (dd.personal || []).length
  const todayPct = totalToday ? Math.round(doneToday / totalToday * 100) : 0
  const nowMin = today.getHours() * 60 + today.getMinutes()
  const nextBlock = scheduled.find(ev => (ev.startH * 60 + (ev.startM || 0)) >= nowMin && !dd.done?.[ev.id])
  const minsUntil = nextBlock ? (nextBlock.startH * 60 + (nextBlock.startM || 0)) - nowMin : null
  const untilLabel = minsUntil == null ? '' : minsUntil <= 0 ? 'now' : minsUntil < 60 ? `in ${minsUntil}m` : `in ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`
  const debts = finance.debts || []
  const debtLeft = debts.reduce((a, d) => a + Number(d.balance || 0), 0)
  const startDebt = debts.reduce((a, d) => a + Number(d.startBalance || d.balance || 0), 0)
  const debtPct = startDebt > 0 ? Math.round((startDebt - debtLeft) / startDebt * 100) : 0
  const cutSpan = me.startWeight - me.goalWeight
  const cutPct = cutSpan > 0 ? Math.min(100, Math.round((me.startWeight - curW) / cutSpan * 100)) : 0
  const lbLost = Math.max(0, me.startWeight - curW)
  const chainPct = (() => { const gs = goals.chain || []; if (!gs.length) return 0; const per = gs.map(g => { const t = g.ms.length; return t ? g.ms.filter(m => m.done).length / t : 0 }); return Math.round(per.reduce((a, b) => a + b, 0) / gs.length * 100) })()
  const nextMs = (() => { for (const g of (goals.chain || [])) { const m = g.ms.find(x => !x.done); if (m) return g.title + ' — ' + m.text } return 'All milestones cleared' })()
  const avoidCount = (avoiding || []).filter(a => !a.done).length
  const journalEntries = (vision.journal || []).length

  const rings = [
    { label: 'Cut', pct: cutPct, value: lbLost.toFixed(0), unit: 'lb lost', color: C.holo, go: 'me' },
    { label: 'Today', pct: todayPct, value: `${doneToday}/${totalToday}`, unit: 'done', color: C.blue, go: 'today' },
    { label: 'Debt-free', pct: debtPct, value: debtPct, unit: '%', color: C.green, go: 'money' },
    { label: 'Goals', pct: chainPct, value: chainPct, unit: '%', color: C.amber, go: 'goals' },
  ]

  const cards = [
    { id: 'calendar', label: 'Schedule', accent: C.blue, big: scheduled.length ? scheduled.length : '0', sub: scheduled.length ? 'blocks today' : 'open week', foot: nextBlock ? 'Next · ' + nextBlock.title : 'nothing queued' },
    { id: 'today', label: 'Today', accent: C.green, big: `${doneToday}/${totalToday}`, sub: 'done today', foot: totalToday ? `${todayPct}% complete` : 'add your first task', prog: todayPct },
    { id: 'money', label: 'Money', accent: C.red, big: money(debtLeft, false), sub: 'debt remaining', foot: `${debtPct}% to debt-free`, prog: debtPct },
    { id: 'goals', label: 'Goals', accent: C.amber, big: chainPct + '%', sub: 'up the chain', foot: nextMs, prog: chainPct },
    { id: 'avoiding', label: 'Avoiding', accent: C.holo, big: avoidCount, sub: avoidCount === 1 ? 'thing on the table' : 'things on the table', foot: avoidCount ? 'face one today' : 'clear — nothing dodged' },
    { id: 'journal', label: 'Journal', accent: C.muted, big: journalEntries, sub: journalEntries === 1 ? 'entry' : 'entries', foot: journalDue ? 'Due tonight' : 'close the day honest', badge: journalDue },
  ]

  const Card = c => (
    <button key={c.id} className="hubtile" onClick={() => go(c.id)}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 128, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 2, background: c.accent, opacity: 0.8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }}>{c.label}</span>
        <span style={{ color: c.accent, fontSize: 14 }}>→</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: F, fontSize: 'clamp(22px,3vw,28px)', fontWeight: 800, color: C.text, letterSpacing: '-0.02em', lineHeight: 1 }}>{c.big}</span>
        <span style={{ fontFamily: F, fontSize: 11, color: C.dim }}>{c.sub}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 11.5, color: C.dim, marginTop: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.foot}</div>
      {c.prog != null && <div style={{ height: 4, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', width: c.prog + '%', background: c.accent, borderRadius: 3, transition: 'width .6s ease' }} /></div>}
      {c.badge && <span style={{ position: 'absolute', top: 14, right: 32, width: 7, height: 7, borderRadius: '50%', background: C.red, animation: 'dotPulse 1.6s ease-in-out infinite' }} />}
    </button>
  )

  const quick = [
    ['Weigh in', 'me'], ['Add task', 'today'], ['New entry', 'journal'], ['Log payment', 'money'], ['Face something', 'avoiding'],
  ]

  return (
    <div style={{ animation: 'hubIn 0.5s cubic-bezier(.2,.8,.2,1)', maxWidth: 1060, margin: '0 auto' }}>
      {/* HERO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', flexDirection: isMobile ? 'column' : 'row', gap: 16, marginBottom: 22 }}>
        <div>
          <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: C.holo, letterSpacing: '0.04em' }}>{greeting()}.</div>
          <HubClock />
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.muted, marginTop: 4 }}>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <button onClick={() => go(nextBlock ? 'calendar' : 'today')} className="hubtile" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 18px', minWidth: isMobile ? '100%' : 240, boxShadow: 'var(--card-shadow)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: nextBlock ? getEvColor(nextBlock.color).border : C.dim }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim, marginBottom: 3 }}>{nextBlock ? 'Next up ' + untilLabel : 'Schedule'}</div>
            <div style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.text }}>{nextBlock ? nextBlock.title : 'Nothing left today'}</div>
            <div style={{ fontFamily: F, fontSize: 11, color: C.muted }}>{nextBlock ? t12(nextBlock.startH, nextBlock.startM) + ' – ' + t12(nextBlock.endH, nextBlock.endM) : 'you\'re clear'}</div>
          </div>
        </button>
      </div>

      {/* COMMAND DECK — Me + rings */}
      <div className="mecard" style={{ background: 'linear-gradient(150deg, var(--surface2), var(--surface))', border: `1px solid ${C.border2}`, borderRadius: 20, padding: isMobile ? '22px 18px' : '26px 30px', marginBottom: 20, boxShadow: '0 22px 64px rgba(0,0,0,0.45)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 70% at 18% 40%, var(--holoDim), transparent 62%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 18 : 30, position: 'relative', zIndex: 1 }}>
          <button onClick={() => go('me')} className="ringbtn" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: isMobile ? 130 : 150 }}><HoloFigure current={curW} start={me.startWeight} goal={me.goalWeight} /></div>
            <div style={{ fontFamily: F, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>{curW}<span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}> → {me.goalWeight} lb</span></div>
            <div style={{ fontFamily: F, fontSize: 10.5, color: C.holo, fontWeight: 700, letterSpacing: '0.06em' }}>OPEN PROFILE →</div>
          </button>
          <div style={{ flex: 1, width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 16 : 8, justifyItems: 'center' }}>
              {rings.map(r => <Ring key={r.label} pct={r.pct} value={r.value} unit={r.unit} label={r.label} color={r.color} onClick={() => go(r.go)} size={isMobile ? 78 : 88} />)}
            </div>
            <button onClick={() => go('goals')} style={{ width: '100%', marginTop: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 15px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: F, fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 3, padding: '3px 7px', flexShrink: 0 }}>Next</span>
              <span style={{ flex: 1, fontFamily: F, fontSize: 12.5, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nextMs}</span>
              <span style={{ color: C.dim, fontSize: 14 }}>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: isMobile ? 12 : 16, marginBottom: 20 }}>
        {cards.map(Card)}
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {quick.map(([label, v]) => (
          <button key={label} onClick={() => go(v)} className="hubtile" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: '8px 16px', cursor: 'pointer', fontFamily: F, fontSize: 12, fontWeight: 600, color: C.muted }}>{label}</button>
        ))}
      </div>
    </div>
  )
}
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
function profileFirst(me) { return '' }


function ForgeApp({ profileName, onLock }) {
  const [booting, setBooting] = useState(true)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('hub')
  const [weekOffset, setWeekOffset] = useState(0)
  const [theme, setThemeState] = useState(loadTheme)
  const [events, setEvents] = useState(loadEvents)
  const [data, setData] = useState(loadData)
  const [vision, setVision] = useState(() => { const v = loadVision(); return v ? { ...DEFAULT_VISION, ...v } : DEFAULT_VISION })
  const [avoiding, setAvoiding] = useState(loadAvoiding)
  const [finance, setFinance] = useState(() => { const f = loadFinance(); return f ? { ...DEFAULT_FINANCE, ...f } : DEFAULT_FINANCE })
  const [me, setMe] = useState(() => { const m = loadMe(); return m ? { ...DEFAULT_ME, ...m } : DEFAULT_ME })
  const [goals, setGoals] = useState(() => { const g = loadGoals(); return g ? { ...DEFAULT_GOALS, ...g } : DEFAULT_GOALS })
  const isMobile = useIsMobile()

  useEffect(() => { const t = setTimeout(() => setBooting(false), 2100); const t2 = setTimeout(() => setReady(true), 2200); return () => { clearTimeout(t); clearTimeout(t2) } }, [])
  useEffect(() => { saveVision(vision) }, [vision])
  useEffect(() => { saveAvoiding(avoiding) }, [avoiding])
  useEffect(() => { saveFinance(finance) }, [finance])
  useEffect(() => { saveMe(me) }, [me])
  useEffect(() => { saveGoals(goals) }, [goals])

  const setTheme = t => { setThemeState(t); saveTheme(t) }
  const changeEvents = e => { setEvents(e); saveEvents(e) }
  const scheduleBlock = ({ title, desc = '', color = 'amber' }) => {
    const dow = (new Date().getDay() + 1) % 7
    changeEvents([...events, { id: uid('e'), title, desc, color, startH: 9, startM: 0, endH: 10, endM: 0, dayOfWeek: dow, allDay: false, repeat: 'none' }])
  }
  const addToToday = text => {
    const k = todayKey(); const dd = data[k] || { done: {}, notes: '', personal: [] }
    const next = { ...data, [k]: { ...dd, personal: [...(dd.personal || []), { id: uid('p'), text, done: false }] } }
    setData(next); saveData(next)
  }
  const applyWeek = () => {
    const tmpl = buildWeekTemplate(me)
    const additions = tmpl.filter(t => !events.some(e => e.title === t.title && e.dayOfWeek === t.dayOfWeek))
      .map(t => ({ id: uid('e'), desc: '', repeat: 'none', allDay: false, ...t }))
    if (additions.length === 0) return 0
    changeEvents([...events, ...additions])
    return additions.length
  }

  const streak = useMemo(() => computeStreak(data), [data])
  const journalDue = (() => { const done = (vision.journal || []).some(e => e.date === todayKey() && wordCount(e.text) >= 150); return new Date().getHours() >= 21 && !done })()

  if (booting) return <><style>{CSS}</style><BootScreen /></>

  const smallBtn = { background: 'none', border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontFamily: F, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 12px', height: 32, cursor: 'pointer' }
  const isHub = view === 'hub'
  const titleOf = { calendar: 'Schedule', today: 'Today', me: 'Me', money: 'Money', goals: 'Goals', avoiding: 'Avoiding', journal: 'Journal' }[view] || ''

  return (
    <>
      <style>{CSS}</style>
      <div className="app-root" data-theme={theme}>
        <Background />

        {/* minimal bar — no section tabs. Left = Forge / back-to-home. Right = streak, theme, lock. */}
        <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 10, height: 54, padding: isMobile ? '0 16px' : '0 26px', background: 'var(--surface)', borderBottom: `1px solid ${C.border}`, backdropFilter: 'blur(14px)' }}>
          {isHub ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Ember size={20} color={C.blue} />
              <span style={{ fontFamily: F, fontSize: 14, fontWeight: 800, letterSpacing: '0.18em', color: C.text }}>FORGE</span>
              {profileName && <span style={{ fontFamily: F, fontSize: 10.5, color: C.dim }}>/ {profileName}</span>}
            </div>
          ) : (
            <button onClick={() => setView('hub')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontFamily: F, fontSize: 18, color: C.muted, lineHeight: 1 }}>‹</span>
              <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: C.muted }}>HOME</span>
              <span style={{ fontFamily: F, fontSize: 12, color: C.dim }}>/</span>
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '0.02em' }}>{titleOf}</span>
            </button>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: F, fontSize: 12, color: streak > 0 ? C.amber : C.dim }}><b style={{ fontSize: 14, fontWeight: 800 }}>{streak}</b>{!isMobile && <span style={{ fontSize: 9, letterSpacing: '0.1em' }}> DAY STREAK</span>}</span>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={smallBtn}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <button onClick={onLock} style={smallBtn}>Lock</button>
          </div>
        </header>

        <main className="main-pad" style={{ position: 'relative', zIndex: 1, maxWidth: 1080, margin: '0 auto', padding: isHub ? '34px 28px 80px' : '26px 36px 90px', opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}>
          {isHub ? (
            <HubView go={setView} me={me} data={data} events={events} finance={finance} goals={goals} avoiding={avoiding} vision={vision} streak={streak} journalDue={journalDue} isMobile={isMobile} />
          ) : (
            <div key={view} style={{ animation: 'zoomEnter 0.34s cubic-bezier(.2,.8,.2,1)' }}>
              {view === 'calendar' && <WeeklyCalendar weekOffset={weekOffset} setWeekOffset={setWeekOffset} events={events} onEventsChange={changeEvents} isMobile={isMobile} theme={theme} />}
              {view === 'today' && <TodayView data={data} setData={setData} events={events} />}
              {view === 'me' && <MeView me={me} setMe={setMe} applyWeek={applyWeek} isMobile={isMobile} />}
              {view === 'money' && <MoneyView finance={finance} setFinance={setFinance} isMobile={isMobile} />}
              {view === 'goals' && <GoalsView goals={goals} setGoals={setGoals} vision={vision} setVision={setVision} finance={finance} me={me} />}
              {view === 'avoiding' && <AvoidingView avoiding={avoiding} setAvoiding={setAvoiding} scheduleBlock={scheduleBlock} addToToday={addToToday} />}
              {view === 'journal' && <JournalView vision={vision} setVision={setVision} data={data} />}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PROFILES + GATE
// ════════════════════════════════════════════════════════════════════════════════
const AVATAR_COLORS = ['#8a8f98', '#7d9b72', '#c65949', '#6b7f96', '#8f7a9e', '#5f8f83', '#b9975f']
const avatarColor = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length] }

function LoginGate({ profiles, setProfiles, onUnlock }) {
  const G = { bg: '#0b0b0c', card: '#111113', card2: '#17171a', border: 'rgba(255,255,255,0.1)', accent: '#f2f2f3', text: '#ececee', muted: '#8a8f98', dim: '#4d5057', red: '#c65949' }
  const [mode, setMode] = useState(profiles.length ? 'pick' : 'create')
  const [selId, setSelId] = useState(loadLastProfile() || '')
  const [pass, setPass] = useState('')
  const [nm, setNm] = useState(''), [p1, setP1] = useState(''), [p2, setP2] = useState(''), [err, setErr] = useState('')
  const sel = profiles.find(p => p.id === selId)
  const unlock = () => { if (!sel) return; if (hashPass(pass) !== sel.passHash) { setErr('Wrong passcode'); return } onUnlock(sel.id) }
  const create = () => {
    const name = nm.trim()
    if (!name) { setErr('Add a name'); return }
    if (p1.length < 4) { setErr('Passcode needs at least 4 characters'); return }
    if (p1 !== p2) { setErr("Passcodes don't match"); return }
    const id = 'u_' + Date.now().toString(36) + Math.round(Math.random() * 1e4).toString(36)
    const next = [...profiles, { id, name, passHash: hashPass(p1), createdAt: Date.now() }]
    if (profiles.length === 0) migrateLegacyInto(id)
    saveProfiles(next); setProfiles(next); onUnlock(id)
  }
  const removeProfile = p => { if (!confirmSafe('Delete "' + p.name + '" and ALL its data on this device?')) return; deleteProfileData(p.id); const next = profiles.filter(x => x.id !== p.id); saveProfiles(next); setProfiles(next); if (selId === p.id) setSelId(''); if (next.length === 0) setMode('create') }
  const input = { width: '100%', background: G.card2, border: `1px solid ${G.border}`, borderRadius: 4, color: G.text, fontSize: 16, padding: '12px 13px', outline: 'none', fontFamily: F, boxSizing: 'border-box', marginBottom: 10 }
  const accBtn = { width: '100%', fontFamily: F, fontSize: 14, fontWeight: 700, padding: 12, borderRadius: 4, cursor: 'pointer', border: 'none', background: G.accent, color: '#0b0b0c', marginTop: 4 }
  return (
    <div style={{ position: 'fixed', inset: 0, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto', fontFamily: F }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
      <div style={{ position: 'relative', width: 380, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Ember size={48} color={G.accent} /></div>
          <div style={{ fontFamily: F, fontSize: 27, fontWeight: 800, letterSpacing: '0.2em', color: G.text }}>FORGE</div>
          <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.32em', color: G.dim, marginTop: 6, textTransform: 'uppercase' }}>made, not born</div>
        </div>
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 6, padding: '22px 20px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          {mode === 'pick' ? (
            <div>
              {!sel ? (<>
                <div style={{ fontSize: 16, fontWeight: 800, color: G.text, marginBottom: 14 }}>Who&rsquo;s this?</div>
                {profiles.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 4, cursor: 'pointer', border: `1px solid ${G.border}`, marginBottom: 8, background: G.card2 }} onClick={() => { setSelId(p.id); setPass(''); setErr('') }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#0b0b0c' }}>{(p.name[0] || '?').toUpperCase()}</div>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: G.text }}>{p.name}</span>
                    <span onClick={e => { e.stopPropagation(); removeProfile(p) }} style={{ color: G.dim, fontSize: 13, cursor: 'pointer', padding: '2px 6px' }}>×</span>
                  </div>
                ))}
                <button onClick={() => { setMode('create'); setErr(''); setNm(''); setP1(''); setP2('') }} style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: 11, borderRadius: 4, cursor: 'pointer', border: `1px dashed ${G.border}`, background: 'transparent', color: G.muted, marginTop: 4, fontFamily: F }}>+ Add someone</button>
              </>) : (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor(sel.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#0b0b0c' }}>{(sel.name[0] || '?').toUpperCase()}</div>
                  <div><div style={{ fontSize: 16, fontWeight: 800, color: G.text }}>{sel.name}</div><div onClick={() => { setSelId(''); setErr('') }} style={{ fontSize: 11, color: G.muted, cursor: 'pointer' }}>← not you?</div></div>
                </div>
                <input autoFocus type="password" value={pass} onChange={e => { setPass(e.target.value); setErr('') }} onKeyDown={e => { if (e.key === 'Enter') unlock() }} placeholder="Passcode" style={input} />
                {err && <div style={{ fontSize: 12, color: G.red, marginBottom: 8 }}>{err}</div>}
                <button onClick={unlock} style={accBtn}>Unlock</button>
              </>)}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: G.text, marginBottom: 4 }}>{profiles.length ? 'New profile' : 'Set up your profile'}</div>
              <div style={{ fontSize: 11.5, color: G.muted, marginBottom: 16, lineHeight: 1.5 }}>{profiles.length ? 'Separate space, separate passcode.' : 'This locks your space on this device. Your existing data moves into this first profile.'}</div>
              <input value={nm} onChange={e => { setNm(e.target.value); setErr('') }} placeholder="Name" style={input} />
              <input type="password" value={p1} onChange={e => { setP1(e.target.value); setErr('') }} placeholder="Passcode (4+ characters)" style={input} />
              <input type="password" value={p2} onChange={e => { setP2(e.target.value); setErr('') }} onKeyDown={e => { if (e.key === 'Enter') create() }} placeholder="Confirm passcode" style={input} />
              {err && <div style={{ fontSize: 12, color: G.red, marginBottom: 8 }}>{err}</div>}
              <button onClick={create} style={accBtn}>Create &amp; enter</button>
              {profiles.length > 0 && <button onClick={() => { setMode('pick'); setErr('') }} style={{ width: '100%', fontSize: 12, padding: 10, borderRadius: 4, cursor: 'pointer', border: 'none', background: 'transparent', color: G.muted, marginTop: 6, fontFamily: F }}>← back</button>}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: G.dim, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>A local lock for privacy — not bank-grade security. Forgot a passcode? No recovery — delete the profile and start fresh.</div>
      </div>
    </div>
  )
}

export default function App() {
  const [profiles, setProfiles] = useState(loadProfiles)
  const [activeId, setActiveId] = useState(null)
  const unlock = id => { setActiveProfile(id); saveLastProfile(id); setActiveId(id) }
  const lock = () => { setActiveProfile(null); setActiveId(null) }
  if (!activeId) return <LoginGate profiles={profiles} setProfiles={setProfiles} onUnlock={unlock} />
  const me = profiles.find(p => p.id === activeId)
  return <ForgeApp key={activeId} profileName={me ? me.name : ''} onLock={lock} />
}

// ════════════════════════════════════════════════════════════════════════════════
// .ics export
// ════════════════════════════════════════════════════════════════════════════════
function downloadText(name, text, mime) {
  try {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 200)
  } catch (e) { try { alert('Could not export here. Open the app in your own browser and try again.') } catch {} }
}
const ICS_DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const _p2 = n => String(n).padStart(2, '0')
const icsLocal = d => `${d.getFullYear()}${_p2(d.getMonth() + 1)}${_p2(d.getDate())}T${_p2(d.getHours())}${_p2(d.getMinutes())}00`
const icsDay = d => `${d.getFullYear()}${_p2(d.getMonth() + 1)}${_p2(d.getDate())}`
const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
function nextDow(dow) { const t = new Date(); const diff = ((dow ?? 1) - t.getDay() + 7) % 7; const d = new Date(t); d.setDate(t.getDate() + diff); d.setHours(0, 0, 0, 0); return d }
function icsStartDate(ev) {
  if (ev.repeat === 'daily') { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
  if (ev.repeat === 'weekdays') { const t = new Date(); const d = new Date(t); d.setHours(0, 0, 0, 0); const wd = t.getDay(); if (wd === 0) d.setDate(d.getDate() + 1); else if (wd === 6) d.setDate(d.getDate() + 2); return d }
  return nextDow(ev.dayOfWeek)
}
function icsRRule(ev) {
  if (ev.repeat === 'daily') return 'FREQ=DAILY'
  if (ev.repeat === 'weekdays') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
  return 'FREQ=WEEKLY;BYDAY=' + ICS_DOW[ev.dayOfWeek ?? 1]
}
function buildICS(events, leadMin) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FORGE//Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:FORGE — Schedule']
  const stamp = icsStamp()
  ;(events || []).forEach(ev => {
    const base = icsStartDate(ev)
    L.push('BEGIN:VEVENT', 'UID:' + (ev.id || uid('e')) + '@forge-planner', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEsc(ev.title || 'Block'))
    if (ev.desc) L.push('DESCRIPTION:' + icsEsc(ev.desc))
    if (ev.allDay) {
      const end = new Date(base); end.setDate(base.getDate() + 1)
      L.push('DTSTART;VALUE=DATE:' + icsDay(base), 'DTEND;VALUE=DATE:' + icsDay(end), 'RRULE:' + icsRRule(ev))
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title || 'Block'), 'TRIGGER;RELATED=START:PT9H', 'END:VALARM')
    } else {
      const s = new Date(base); s.setHours(ev.startH || 0, ev.startM || 0, 0, 0)
      let e = new Date(base); e.setHours(ev.endH ?? ((ev.startH || 0) + 1), ev.endM || 0, 0, 0)
      if (e <= s) e = new Date(s.getTime() + 30 * 60000)
      L.push('DTSTART:' + icsLocal(s), 'DTEND:' + icsLocal(e), 'RRULE:' + icsRRule(ev))
      const trig = (leadMin > 0) ? ('-PT' + leadMin + 'M') : 'PT0S'
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title || 'Block'), 'TRIGGER:' + trig, 'END:VALARM')
    }
    L.push('END:VEVENT')
  })
  L.push('END:VCALENDAR')
  return L.join('\r\n') + '\r\n'
}