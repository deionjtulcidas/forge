import { useState, useEffect, useRef, useMemo } from 'react'

// ════════════════════════════════════════════════════════════════════════════════
// FORGE — personal planner. Single file. Data lives in the browser (localStorage),
// namespaced per profile. Storage keys are kept identical to prior versions so
// existing data (calendar, streak, profiles, etc.) survives this rewrite.
// ════════════════════════════════════════════════════════════════════════════════

const uid = p => p + '_' + Date.now() + '_' + Math.round(Math.random() * 1e4)
const todayKey = () => new Date().toISOString().slice(0, 10)
const ask = m => { try { return window.prompt(m) } catch { return null } }
const confirmSafe = m => { try { return window.confirm(m) } catch { return true } }

// ── per-profile namespacing ──
let ACTIVE_PROFILE = null
const setActiveProfile = id => { ACTIVE_PROFILE = id }
const PK = k => ACTIVE_PROFILE ? ('p:' + ACTIVE_PROFILE + ':' + k) : k
const APP_KEYS = ['hud_events', 'hud_v4', 'hud_vision', 'hud_theme', 'forge_name', 'forge_avoiding', 'forge_finance', 'hud_alert_lead']

const hashPass = s => { let h = 5381; for (let i = 0; i < s.length; i++) { h = (((h << 5) + h) + s.charCodeAt(i)) | 0 } return (h >>> 0).toString(36) }
const loadProfiles = () => { try { return JSON.parse(localStorage.getItem('forge_profiles') || '[]') } catch { return [] } }
const saveProfiles = p => { try { localStorage.setItem('forge_profiles', JSON.stringify(p)) } catch {} }
const loadLastProfile = () => { try { return localStorage.getItem('forge_last_profile') || '' } catch { return '' } }
const saveLastProfile = id => { try { localStorage.setItem('forge_last_profile', id) } catch {} }
const migrateLegacyInto = id => { try { APP_KEYS.forEach(k => { const v = localStorage.getItem(k); const nk = 'p:' + id + ':' + k; if (v != null && localStorage.getItem(nk) == null) localStorage.setItem(nk, v) }) } catch {} }
const deleteProfileData = id => { try { APP_KEYS.forEach(k => localStorage.removeItem('p:' + id + ':' + k)); ['hud_v4', 'hud_events', 'hud_vision', 'forge_avoiding', 'forge_finance'].forEach(() => {}) } catch {} }

// ── stores ──
const loadEvents = () => { try { return JSON.parse(localStorage.getItem(PK('hud_events')) || '[]') } catch { return [] } }
const saveEvents = e => { try { localStorage.setItem(PK('hud_events'), JSON.stringify(e)) } catch {} }
const loadData = () => { try { return JSON.parse(localStorage.getItem(PK('hud_v4')) || '{}') } catch { return {} } }
const saveData = d => { try { localStorage.setItem(PK('hud_v4'), JSON.stringify(d)) } catch {} }
const loadVision = () => { try { return JSON.parse(localStorage.getItem(PK('hud_vision')) || 'null') } catch { return null } }
const saveVision = v => { try { localStorage.setItem(PK('hud_vision'), JSON.stringify(v)) } catch {} }
const loadTheme = () => { try { return localStorage.getItem(PK('hud_theme')) || 'dark' } catch { return 'dark' } }
const saveTheme = t => { try { localStorage.setItem(PK('hud_theme'), t) } catch {} }
const loadName = () => { try { return localStorage.getItem(PK('forge_name')) || '' } catch { return '' } }
const saveName = n => { try { localStorage.setItem(PK('forge_name'), n) } catch {} }
const loadAvoiding = () => { try { return JSON.parse(localStorage.getItem(PK('forge_avoiding')) || '[]') } catch { return [] } }
const saveAvoiding = a => { try { localStorage.setItem(PK('forge_avoiding'), JSON.stringify(a)) } catch {} }
const loadFinance = () => { try { return JSON.parse(localStorage.getItem(PK('forge_finance')) || 'null') } catch { return null } }
const saveFinance = f => { try { localStorage.setItem(PK('forge_finance'), JSON.stringify(f)) } catch {} }
const loadLead = () => { try { const v = Number(localStorage.getItem(PK('hud_alert_lead'))); return Number.isFinite(v) ? v : 10 } catch { return 10 } }
const saveLead = v => { try { localStorage.setItem(PK('hud_alert_lead'), String(v)) } catch {} }

const DEFAULT_VISION = { items: [], focus: [{ id: uid('f'), text: '', done: false }, { id: uid('f'), text: '', done: false }, { id: uid('f'), text: '', done: false }], wins: [] }
const DEFAULT_FINANCE = {
  debts: [
    { id: 'd_cc', name: 'Discover Card', balance: 2856.86, startBalance: 2856.86, apr: 24.99, monthlyPayment: 300, color: '#cf7b6b' },
    { id: 'd_loan', name: 'Student Loans', balance: 20000, startBalance: 20000, apr: 6, monthlyPayment: 250, color: '#7fa8c9' },
  ],
  emergencyGoal: 1000, emergencySaved: 0,
  payments: [],
  milestones: [
    { id: uid('m'), text: 'Pay off the Discover card', done: false },
    { id: uid('m'), text: 'Build a $1,000 emergency fund', done: false },
    { id: uid('m'), text: 'Start attacking the student loans', done: false },
    { id: uid('m'), text: 'Hit $10,000 paid on loans', done: false },
    { id: uid('m'), text: 'Debt-free', done: false },
  ],
}

// ── stoic quotes (public-domain phrasings) ──
const QUOTES = [
  ['You have power over your mind — not outside events. Realize this, and you will find strength.', 'Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.', 'Seneca'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['No man is free who is not master of himself.', 'Epictetus'],
  ['First say to yourself what you would be; then do what you have to do.', 'Epictetus'],
  ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
  ['The impediment to action advances action. What stands in the way becomes the way.', 'Marcus Aurelius'],
  ['He who fears death will never do anything worthy of a living man.', 'Seneca'],
  ['Difficulties strengthen the mind, as labor does the body.', 'Seneca'],
  ['If it is not right, do not do it; if it is not true, do not say it.', 'Marcus Aurelius'],
  ['Luck is what happens when preparation meets opportunity.', 'Seneca'],
  ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
  ['Begin at once to live, and count each separate day as a separate life.', 'Seneca'],
  ['The best revenge is to be unlike him who performed the injury.', 'Marcus Aurelius'],
  ['Man is not worried by real problems so much as by his imagined anxieties.', 'Epictetus'],
  ['How long are you going to wait before you demand the best for yourself?', 'Epictetus'],
  ['Confine yourself to the present.', 'Marcus Aurelius'],
  ['A gem cannot be polished without friction, nor a man perfected without trials.', 'Seneca'],
  ['You become what you give your attention to.', 'Epictetus'],
  ['Very little is needed to make a happy life; it is all within yourself.', 'Marcus Aurelius'],
]
const wordCount = s => (s || '').trim().split(/\s+/).filter(Boolean).length
const dayOfYear = () => { const n = new Date(); return Math.floor((n - new Date(n.getFullYear(), 0, 0)) / 86400000) }
const dailyQuote = () => QUOTES[dayOfYear() % QUOTES.length]

const BOOT_LINES = [
  'Lighting the forge...',
  'You are not finished. That is the point.',
  'What you avoid today is still here tomorrow.',
  'So pick one hard thing. Start there.',
  'Back to work.',
]

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const EVENT_COLORS = [
  { id: 'blue', bg: 'rgba(91,141,239,0.85)', border: '#5b8def' },
  { id: 'green', bg: 'rgba(122,168,122,0.85)', border: '#7aa87a' },
  { id: 'purple', bg: 'rgba(166,143,217,0.85)', border: '#a68fd9' },
  { id: 'red', bg: 'rgba(207,123,107,0.9)', border: '#cf7b6b' },
  { id: 'amber', bg: 'rgba(217,138,74,0.9)', border: '#d98a4a' },
  { id: 'teal', bg: 'rgba(95,183,161,0.85)', border: '#5fb7a1' },
  { id: 'pink', bg: 'rgba(217,143,176,0.85)', border: '#d98fb0' },
]
const getEvColor = id => EVENT_COLORS.find(c => c.id === id) || EVENT_COLORS[0]

const money = (n, cents = true) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })

// ── theme tokens ──
const THEME_TOKENS = `
  :root, .app-root[data-theme="dark"]{
    --bg:#14110e; --surface:#1c1815; --surface2:#231e1a; --surface3:#2b2520;
    --border:rgba(224,168,99,0.12); --border2:rgba(224,168,99,0.3);
    --blue:#dca15f; --blueBright:#f0bd80; --blueDim:rgba(224,168,99,0.1); --blueGlow:rgba(224,168,99,0.38);
    --text:#ece2d5; --muted:#9c8d7c; --dim:#5c5045;
    --amber:#d98a4a; --amberGlow:rgba(217,138,74,0.4);
    --green:#93a777; --greenGlow:rgba(147,167,119,0.35); --red:#cf7b6b;
    --vignette:rgba(15,11,8,0.92); --card-shadow:0 6px 22px rgba(0,0,0,0.4); --card-shadow-sel:0 10px 30px rgba(0,0,0,0.46);
  }
  .app-root[data-theme="light"]{
    --bg:#f3ede3; --surface:#fbf7f0; --surface2:#f1e9dc; --surface3:#e7ddcd;
    --border:rgba(120,86,46,0.16); --border2:rgba(120,86,46,0.34);
    --blue:#b3792e; --blueBright:#c98e3f; --blueDim:rgba(179,121,46,0.1); --blueGlow:rgba(179,121,46,0.3);
    --text:#2b2118; --muted:#6f6155; --dim:#a99680;
    --amber:#b0682f; --amberGlow:rgba(176,104,47,0.32);
    --green:#5f7a48; --greenGlow:rgba(95,122,72,0.3); --red:#b85746;
    --vignette:rgba(243,237,227,0.55); --card-shadow:0 5px 18px rgba(43,33,24,0.1); --card-shadow-sel:0 9px 26px rgba(43,33,24,0.16);
  }
`
const C = {
  bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)', surface3: 'var(--surface3)',
  border: 'var(--border)', border2: 'var(--border2)', blue: 'var(--blue)', blueBright: 'var(--blueBright)',
  blueDim: 'var(--blueDim)', blueGlow: 'var(--blueGlow)', text: 'var(--text)', muted: 'var(--muted)', dim: 'var(--dim)',
  amber: 'var(--amber)', amberGlow: 'var(--amberGlow)', green: 'var(--green)', greenGlow: 'var(--greenGlow)', red: 'var(--red)',
}
const SER = "'Fraunces',Georgia,serif"
const F = "'Inter',-apple-system,system-ui,sans-serif"

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&display=swap');
  ${THEME_TOKENS}
  *{box-sizing:border-box}
  .app-root{min-height:100vh;background:var(--bg);color:var(--text);font-family:${F}}
  @keyframes glowPulse{0%,100%{opacity:0.5}50%{opacity:1}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes modalIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
  @keyframes dotPulse{0%,100%{opacity:0.4}50%{opacity:1}}
  @keyframes blink{50%{opacity:0}}
  @keyframes slideIn{from{opacity:0}to{opacity:1}}
  ::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:6px}::-webkit-scrollbar-track{background:transparent}
  input,textarea,select{font-family:${F}}
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
    .modal-card{width:100% !important;max-width:100% !important;border-radius:16px 16px 0 0 !important;max-height:92vh !important}
    input,textarea,select,button{font-size:16px}
  }
`

// ── icon: forge flame ──
function Ember({ size = 40, color = 'var(--blue)', glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ filter: glow ? `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 13px ${color})` : 'none', display: 'block' }}>
      <path d="M33 4c2 9-4 13-9 18-6 6-11 12-11 21 0 10 8 17 19 17s19-7 19-18c0-7-3-12-7-17-1 4-3 6-6 7 3-9-1-19-4-25z" fill={color} opacity="0.92" />
      <path d="M32 30c1 5-3 7-5 11-1 3-1 5-1 7 0 5 3 8 7 8s8-4 8-9c0-4-2-7-4-10-1 2-2 3-4 4 1-4 0-8-1-11z" fill="var(--bg)" opacity="0.55" />
    </svg>
  )
}

function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 60% at 50% 118%,var(--blueDim) 0%,transparent 62%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%,transparent 30%,var(--vignette) 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '12%', right: '12%', height: 1, background: 'linear-gradient(90deg,transparent,var(--blueGlow),transparent)', boxShadow: '0 0 50px var(--blueGlow)', animation: 'glowPulse 8s ease-in-out infinite' }} />
    </div>
  )
}

function Panel({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: 'var(--card-shadow)', ...style }}>{children}</div>
}

function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  return <span style={{ fontFamily: F, fontSize: 13, color: C.muted, letterSpacing: '0.04em' }}>{t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
}

function DailyQuote({ style = {} }) {
  const [q, a] = dailyQuote()
  return (
    <div style={{ borderLeft: `3px solid ${C.amber}`, paddingLeft: 14, ...style }}>
      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 4 }}>From the Stoics · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      <div style={{ fontFamily: SER, fontSize: 14, color: C.text, lineHeight: 1.4, fontStyle: 'italic' }}>&ldquo;{q}&rdquo;</div>
      <div style={{ fontFamily: F, fontSize: 11, color: C.muted, marginTop: 3 }}>— {a}</div>
    </div>
  )
}

function NavItem({ code, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: 'none', background: active ? C.blueDim : 'transparent', width: '100%', textAlign: 'left', position: 'relative' }}>
      <span style={{ fontFamily: SER, fontSize: 10, color: active ? C.blue : C.dim, minWidth: 16 }}>{code}</span>
      <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? C.blue : C.muted }}>{label}</span>
      {badge && <span style={{ position: 'absolute', right: 12, width: 7, height: 7, borderRadius: '50%', background: C.red, boxShadow: `0 0 6px ${C.red}`, animation: 'dotPulse 1.6s ease-in-out infinite' }} />}
    </button>
  )
}

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
        style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, padding: 8, outline: 'none' }}>
        <option value={0}>at start</option><option value={5}>5 min before</option><option value={10}>10 min before</option><option value={15}>15 min before</option><option value={30}>30 min before</option>
      </select>
      <button onClick={exportICS} title="Download .ics for Apple/Google Calendar"
        style={{ fontFamily: F, fontSize: 11, fontWeight: 600, padding: '9px 14px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${C.amber}`, background: 'transparent', color: C.amber, whiteSpace: 'nowrap' }}>⤓ Sync to phone</button>
    </div>
  )

  if (isMobile) {
    const d = weekDates[selDay]
    const dayEvs = events.filter(ev => shouldShow(ev, d)).sort((a, b) => (a.allDay ? -1 : 1) - (b.allDay ? -1 : 1) || ((a.startH || 0) + (a.startM || 0) / 60) - ((b.startH || 0) + (b.startM || 0) / 60))
    return (
      <div style={{ animation: 'fadeUp 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: SER, fontSize: 22, fontWeight: 600 }}>{d.toLocaleDateString('en-US', { month: 'long' })}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, width: 38, height: 38, fontSize: 17, cursor: 'pointer' }}>‹</button>
            <button onClick={() => { setWeekOffset(0); setSelDay(new Date().getDay()) }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 11, padding: '0 12px', cursor: 'pointer' }}>today</button>
            <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, width: 38, height: 38, fontSize: 17, cursor: 'pointer' }}>›</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {weekDates.map((wd, i) => {
            const sel = i === selDay, isT = wd.toISOString().slice(0, 10) === todayStr
            return (
              <button key={i} onClick={() => setSelDay(i)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, cursor: 'pointer', border: `1px solid ${sel ? C.blue : C.border}`, background: sel ? C.blueDim : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontFamily: F, fontSize: 9, color: sel ? C.blue : C.muted }}>{DAYS_SHORT[wd.getDay()].slice(0, 1)}</span>
                <span style={{ fontFamily: SER, fontSize: 15, fontWeight: 600, color: sel ? C.blue : isT ? C.amber : C.text }}>{wd.getDate()}</span>
              </button>
            )
          })}
        </div>
        <button onClick={() => setModal({ type: 'new', slot: { dow: d.getDay(), hour: 9 } })} style={{ width: '100%', fontFamily: F, fontSize: 13, fontWeight: 600, padding: 11, borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue, marginBottom: 12 }}>+ Add a block</button>
        <div style={{ marginBottom: 16 }}>{exportUI}</div>
        {dayEvs.length === 0 ? (
          <Panel style={{ padding: '30px 18px', textAlign: 'center' }}>
            <div style={{ fontFamily: F, fontSize: 13, color: C.muted }}>Nothing planned for {DAYS_FULL[d.getDay()]}.</div>
          </Panel>
        ) : dayEvs.map(ev => {
          const ec = getEvColor(ev.color)
          return (
            <div key={ev.id} onClick={() => setModal({ type: 'edit', event: ev })} style={{ display: 'flex', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ width: 4, borderRadius: 3, background: ec.border, flexShrink: 0 }} />
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

  // desktop week grid
  const HOUR_H = 46, START_H = 6
  const now = new Date()
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, width: 34, height: 34, cursor: 'pointer' }}>‹</button>
          <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 11, padding: '0 12px', height: 34, cursor: 'pointer' }}>TODAY</button>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, width: 34, height: 34, cursor: 'pointer' }}>›</button>
          <span style={{ fontFamily: SER, fontSize: 22, fontWeight: 600 }}>{weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          <LiveClock />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {exportUI}
          <button onClick={() => setModal({ type: 'new', slot: { dow: new Date().getDay(), hour: 9 } })} style={{ fontFamily: F, fontSize: 11, fontWeight: 600, padding: '9px 16px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue }}>+ New block</button>
        </div>
      </div>
      <Panel style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)', borderBottom: `1px solid ${C.border}` }}>
          <div />
          {weekDates.map((d, i) => {
            const isT = d.toISOString().slice(0, 10) === todayStr
            return (
              <div key={i} style={{ padding: '10px 4px', textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F, fontSize: 9, color: C.dim, letterSpacing: '0.08em' }}>{DAYS_SHORT[d.getDay()]}</div>
                <div style={{ fontFamily: SER, fontSize: 18, fontWeight: 600, color: isT ? C.amber : C.text, marginTop: 2 }}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>
        <div style={{ position: 'relative', maxHeight: '64vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7,1fr)' }}>
            <div>
              {HOURS.slice(START_H).map(h => <div key={h} style={{ height: HOUR_H, fontFamily: F, fontSize: 9, color: C.dim, textAlign: 'right', paddingRight: 6, paddingTop: 2 }}>{t12(h, 0).replace(':00', '')}</div>)}
            </div>
            {weekDates.map((d, di) => (
              <div key={di} style={{ position: 'relative', borderLeft: `1px solid ${C.border}` }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const hour = START_H + Math.floor(y / HOUR_H)
                  setModal({ type: 'new', slot: { dow: d.getDay(), hour: Math.max(0, Math.min(23, hour)) } })
                }}>
                {HOURS.slice(START_H).map(h => <div key={h} style={{ height: HOUR_H, borderBottom: `1px solid ${C.border}` }} />)}
                {events.filter(ev => shouldShow(ev, d) && !ev.allDay).map(ev => {
                  const top = ((ev.startH - START_H) + (ev.startM || 0) / 60) * HOUR_H
                  const h = Math.max(22, (((ev.endH ?? ev.startH + 1) - ev.startH) + ((ev.endM || 0) - (ev.startM || 0)) / 60) * HOUR_H)
                  const ec = getEvColor(ev.color)
                  if (top < 0) return null
                  return (
                    <div key={ev.id} onClick={e => { e.stopPropagation(); setModal({ type: 'edit', event: ev }) }}
                      style={{ position: 'absolute', top, left: 2, right: 2, height: h, background: ec.bg, borderLeft: `3px solid ${ec.border}`, borderRadius: 5, padding: '3px 6px', cursor: 'pointer', overflow: 'hidden', zIndex: 2 }}>
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

  const fld = { width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13, padding: '9px 11px', outline: 'none', fontFamily: F }
  const lbl = { fontFamily: F, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.dim, marginBottom: 5, display: 'block' }

  const submit = () => {
    if (!title.trim()) return
    onSave({ id: event?.id || uid('e'), title: title.trim(), desc: desc.trim(), dayOfWeek: dow, startH, startM, endH, endM, color, repeat, allDay })
  }
  return (
    <div className="modal-wrap" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,7,4,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card" style={{ width: 420, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 12, boxShadow: 'var(--card-shadow-sel)', padding: '20px 22px', animation: 'modalIn 0.2s ease' }}>
        <div style={{ fontFamily: SER, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{event ? 'Edit block' : 'New block'}</div>
        <div style={{ marginBottom: 12 }}><span style={lbl}>What</span><input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} placeholder="e.g. Workout" style={fld} /></div>
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
          <div style={{ display: 'flex', gap: 8 }}>{EVENT_COLORS.map(c => <button key={c.id} onClick={() => setColor(c.id)} style={{ width: 28, height: 28, borderRadius: '50%', background: c.border, border: color === c.id ? `2px solid ${C.text}` : '2px solid transparent', cursor: 'pointer' }} />)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {event ? <button onClick={() => onDelete(event.id)} style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer' }}>Delete</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 7, cursor: 'pointer', border: 'none', background: C.blue, color: theme === 'light' ? '#fff' : '#1a140d' }}>Save</button>
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
    else { /* today not done yet — keep counting back */ }
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
  const row = { display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', marginBottom: 7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9 }
  const check = done => ({ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${done ? C.green : C.border2}`, background: done ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15120e', fontSize: 12 })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontFamily: SER, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 600 }}>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
      </div>
      <DailyQuote style={{ margin: '16px 0 20px' }} />

      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', marginBottom: 10 }}>The plan — what today is meant to be</div>
      {scheduled.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 11, color: C.muted, marginBottom: 6 }}>
            <span>Today so far</span><span>{doneCount}/{scheduled.length} · {pct}%</span>
          </div>
          <div style={{ height: 6, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: C.green, borderRadius: 4, transition: 'width 0.3s' }} /></div>
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

      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', margin: '26px 0 10px' }}>My own list — things I actually want to get done</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask() }} placeholder="add something…" style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, padding: '10px 12px', outline: 'none', fontFamily: F }} />
        <button onClick={addTask} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: '0 16px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue }}>Add</button>
      </div>
      {(dd.personal || []).map(p => (
        <div key={p.id} style={row}>
          <div onClick={() => togglePersonal(p.id)} style={check(p.done)}>{p.done ? '✓' : ''}</div>
          <span style={{ flex: 1, fontFamily: F, fontSize: 14, color: p.done ? C.muted : C.text, textDecoration: p.done ? 'line-through' : 'none' }}>{p.text}</span>
          <button onClick={() => delPersonal(p.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 15, cursor: 'pointer' }}>×</button>
        </div>
      ))}

      <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.1em', color: C.muted, textTransform: 'uppercase', margin: '26px 0 10px' }}>A note to myself</div>
      <textarea value={dd.notes || ''} onChange={e => update({ notes: e.target.value })} placeholder="How did today go? Log a win, or just be honest about it. Either counts." rows={4} style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: '12px 14px', outline: 'none', fontFamily: F, resize: 'vertical', boxShadow: 'var(--card-shadow)' }} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// MONEY — debt & progress tracker
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
      <div style={{ fontFamily: SER, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 10.5, color: C.muted, marginTop: 6, letterSpacing: '0.04em' }}>{label}</div>
    </Panel>
  )
  const obtn = c => ({ fontFamily: F, fontSize: 12, fontWeight: 600, padding: '8px 13px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${c}`, background: 'transparent', color: c, whiteSpace: 'nowrap' })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', animation: 'fadeUp 0.3s ease', paddingBottom: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: SER, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 600 }}>Money</h1>
        <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginTop: 6 }}>Every dollar off your debt is a dollar toward the life you&rsquo;re building. Watch it shrink.</p>
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
        <div style={{ height: 12, background: C.surface2, borderRadius: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: pctPaid + '%', background: `linear-gradient(90deg,${C.green},${C.blue})`, borderRadius: 8, transition: 'width 0.4s' }} /></div>
        {monthlyTotal > 0 && debtFreeMonths != null && isFinite(debtFreeMonths) && <div style={{ fontFamily: F, fontSize: 11.5, color: C.dim, marginTop: 8 }}>At {money(monthlyTotal, false)}/mo across all debts, you&rsquo;re debt-free around {payoffDateLabel(debtFreeMonths).split('·')[1]}.</div>}
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 2px 10px' }}>
        <span style={{ fontFamily: SER, fontSize: 17, fontWeight: 600 }}>Debts</span>
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
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color || C.blue }} />
                  <span style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, color: C.text }}>{d.name}</span>
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: C.dim, marginTop: 3 }}>{d.apr ? d.apr + '% APR · ' : ''}{d.monthlyPayment ? money(d.monthlyPayment, false) + '/mo' : 'no monthly payment set'}{mo != null && isFinite(mo) && d.monthlyPayment ? ' · ' + payoffDateLabel(mo) : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: SER, fontSize: 22, fontWeight: 600, color: C.text }}>{money(d.balance)}</div>
                <div style={{ fontFamily: F, fontSize: 10.5, color: C.muted }}>{money(paid, false)} of {money(st, false)} paid</div>
              </div>
            </div>
            <div style={{ height: 8, background: C.surface2, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}><div style={{ height: '100%', width: p + '%', background: d.color || C.blue, borderRadius: 6, transition: 'width 0.4s' }} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setModal({ type: 'edit', debt: d })} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11.5, cursor: 'pointer' }}>edit</button>
              <button onClick={() => setModal({ type: 'pay', debt: d })} style={obtn(C.green)}>＋ Log a payment</button>
            </div>
          </Panel>
        )
      })}
      {cleared.length > 0 && cleared.map(d => (
        <Panel key={d.id} style={{ padding: '13px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>🎉</span>
          <span style={{ flex: 1, fontFamily: SER, fontSize: 15, fontWeight: 600, color: C.green }}>{d.name} — paid off</span>
          <button onClick={() => setModal({ type: 'edit', debt: d })} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>edit</button>
        </Panel>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginTop: 20 }}>
        <Panel style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: SER, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Emergency fund</div>
          <div style={{ fontFamily: F, fontSize: 11.5, color: C.muted, marginBottom: 12 }}>A cushion so a surprise doesn&rsquo;t become new debt.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 6 }}><span>{money(finance.emergencySaved, false)} saved</span><span>goal {money(finance.emergencyGoal, false)}</span></div>
          <div style={{ height: 10, background: C.surface2, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}><div style={{ height: '100%', width: efPct + '%', background: C.amber, borderRadius: 6, transition: 'width 0.4s' }} /></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[25, 50, 100].map(a => <button key={a} onClick={() => adjustEF(a)} style={obtn(C.amber)}>+{money(a, false)}</button>)}
            <button onClick={() => { const v = ask('Add how much to the fund?'); if (v) adjustEF(Number(v)) }} style={obtn(C.muted)}>+ custom</button>
            <button onClick={() => adjustEF(-25)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>−$25</button>
          </div>
        </Panel>
        <Panel style={{ padding: '16px 18px' }}>
          <div style={{ fontFamily: SER, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Milestones</div>
          {(finance.milestones || []).map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
              <div onClick={() => toggleMile(m.id)} style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${m.done ? C.green : C.border2}`, background: m.done ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15120e', fontSize: 11 }}>{m.done ? '✓' : ''}</div>
              <span style={{ flex: 1, fontFamily: F, fontSize: 12.5, color: m.done ? C.muted : C.text, textDecoration: m.done ? 'line-through' : 'none' }}>{m.text}</span>
              <button onClick={() => delMile(m.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 13, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={newMile} onChange={e => setNewMile(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMile() }} placeholder="+ milestone" style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, padding: '7px 9px', outline: 'none', fontFamily: F }} />
          </div>
        </Panel>
      </div>

      {(finance.payments || []).length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontFamily: SER, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Recent payments</div>
          {(finance.payments || []).slice(0, 8).map(p => {
            const d = debts.find(x => x.id === p.debtId)
            return <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F, fontSize: 12.5, color: C.muted, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}><span>{d ? d.name : 'Payment'} · {p.date}</span><span style={{ color: C.green, fontWeight: 600 }}>−{money(p.amount)}</span></div>
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
  const fld = { width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 14, padding: '10px 12px', outline: 'none', fontFamily: F, marginBottom: 12 }
  const lbl = { fontFamily: F, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.dim, marginBottom: 5, display: 'block' }
  const submit = () => {
    if (isPay) { onPay(d.id, payAmt); return }
    if (!name.trim()) return
    const bal = Number(balance) || 0
    onSave({ id: d?.id || uid('d'), name: name.trim(), balance: bal, startBalance: Number(startBalance) || bal, apr: Number(apr) || 0, monthlyPayment: Number(monthly) || 0, color: d?.color || '#dca15f' })
  }
  return (
    <div className="modal-wrap" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(10,7,4,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card" style={{ width: 400, maxWidth: '100%', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: 12, boxShadow: 'var(--card-shadow-sel)', padding: '20px 22px', animation: 'modalIn 0.2s ease' }}>
        <div style={{ fontFamily: SER, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{isPay ? `Log a payment · ${d.name}` : d ? 'Edit debt' : 'Add a debt'}</div>
        {isPay ? (
          <>
            <span style={lbl}>Amount paid</span>
            <input autoFocus type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} placeholder="0.00" style={fld} />
            <div style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 14 }}>Current balance: {money(d.balance)}</div>
          </>
        ) : (
          <>
            <span style={lbl}>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Car loan" style={fld} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><span style={lbl}>Balance now</span><input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" style={fld} /></div>
              <div style={{ flex: 1 }}><span style={lbl}>Started at</span><input type="number" value={startBalance} onChange={e => setStartBalance(e.target.value)} placeholder="0" style={fld} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><span style={lbl}>APR %</span><input type="number" value={apr} onChange={e => setApr(e.target.value)} placeholder="0" style={fld} /></div>
              <div style={{ flex: 1 }}><span style={lbl}>Monthly payment</span><input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="0" style={fld} /></div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          {d && !isPay ? <button onClick={() => onDelete(d.id)} style={{ background: 'none', border: 'none', color: C.red, fontSize: 12, cursor: 'pointer' }}>Delete</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.muted, fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 7, cursor: 'pointer', border: 'none', background: isPay ? C.green : C.blue, color: '#15120e' }}>{isPay ? 'Log it' : 'Save'}</button>
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
  const ageChip = dnum => { const c = dnum >= 14 ? C.red : dnum >= 4 ? C.amber : C.muted; const txt = dnum <= 0 ? 'today' : dnum === 1 ? '1 day' : dnum + ' days'; return <span style={{ fontFamily: F, fontSize: 10, color: c, whiteSpace: 'nowrap', border: `1px solid ${c}`, borderRadius: 20, padding: '2px 9px' }}>sitting {txt}</span> }
  const lbl = { fontFamily: F, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, marginBottom: 5, display: 'block' }
  const field = { width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13, padding: '9px 11px', outline: 'none', fontFamily: F, resize: 'vertical' }
  const obtn = c => ({ fontFamily: F, fontSize: 11.5, fontWeight: 600, padding: '7px 12px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${c}`, background: 'transparent', color: c })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      {flash && <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: C.surface3, border: `1px solid ${C.border2}`, borderRadius: 20, padding: '9px 18px', fontFamily: F, fontSize: 12, color: C.text, boxShadow: 'var(--card-shadow-sel)' }}>{flash}</div>}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: SER, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 600 }}>What am I avoiding?</h1>
        <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>The thing you keep sliding past is usually the thing. Name it here — not to feel bad, but so it stops running you from the shadows.</p>
      </div>
      <Panel style={{ padding: '16px 18px', marginBottom: 18 }}>
        <span style={lbl}>Name something you&rsquo;re dodging</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="the call, the email, the gym, the hard conversation…" style={{ ...field, flex: 1, minWidth: 200 }} />
          <button onClick={add} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${C.blue}`, background: C.blueDim, color: C.blue }}>Name it</button>
        </div>
      </Panel>
      <div style={{ fontFamily: SER, fontSize: 15, fontWeight: 600, margin: '0 2px 12px' }}>On the table <span style={{ color: C.muted, fontSize: 12 }}>{activeItems.length}</span></div>
      {activeItems.length === 0 ? (
        <Panel style={{ padding: '30px 20px', textAlign: 'center' }}><div style={{ fontFamily: F, fontSize: 14, color: C.muted }}>Nothing named right now.</div><div style={{ fontFamily: F, fontSize: 12, color: C.dim, marginTop: 6 }}>When something starts nagging, put it up here before it grows.</div></Panel>
      ) : activeItems.map(a => {
        const dnum = daysSince(a.created)
        return (
          <Panel key={a.id} style={{ padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, color: C.text, lineHeight: 1.25 }}>{a.text}</div>{ageChip(dnum)}
            </div>
            <div style={{ marginBottom: 12 }}><span style={lbl}>Why am I really dodging it?</span><textarea value={a.why} onChange={e => patch(a.id, { why: e.target.value })} rows={2} placeholder="fear, boredom, don't know how to start…" style={field} /></div>
            <div style={{ marginBottom: 14 }}><span style={lbl}>The smallest possible first step</span><input value={a.step} onChange={e => patch(a.id, { step: e.target.value })} placeholder="open the doc. send one line. 5 minutes." style={field} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => del(a.id)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer' }}>remove</button>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button onClick={() => { addToToday((a.step && a.step.trim()) ? a.step.trim() : a.text); ping('Added to Today →') }} style={obtn(C.muted)}>+ Do today</button>
                <button onClick={() => { scheduleBlock({ title: 'Face: ' + a.text, desc: a.step || '', color: 'amber' }); ping('Scheduled on Calendar →') }} style={obtn(C.amber)}>◷ Schedule it</button>
                <button onClick={() => face(a.id)} style={obtn(C.green)}>✓ I faced it</button>
              </div>
            </div>
          </Panel>
        )
      })}
      {faced.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button onClick={() => setShowFaced(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: SER, fontSize: 15, fontWeight: 600, color: C.green }}>Faced</span><span style={{ fontFamily: F, fontSize: 12, color: C.muted }}>{faced.length}</span><span style={{ color: C.dim, fontSize: 11 }}>{showFaced ? '▲' : '▼'}</span>
          </button>
          <div style={{ fontFamily: F, fontSize: 11, color: C.dim, margin: '2px 2px 10px' }}>Every one of these is a thing you stopped running from.</div>
          {showFaced && faced.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 7 }}>
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
// LOOKING BACK (heatmap)
// ════════════════════════════════════════════════════════════════════════════════
function IntelView({ data }) {
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
  const colors = [C.surface2, 'rgba(147,167,119,0.35)', 'rgba(147,167,119,0.6)', 'rgba(147,167,119,0.85)', C.green]
  const cols = []
  for (let w = 0; w < weeks; w++) cols.push(cells.slice(w * 7, w * 7 + 7))
  const trackedDays = cells.filter(c => c.level > 0).length
  const cleanDays = cells.filter(c => c.level >= 3).length

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      <h1 style={{ fontFamily: SER, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 600, marginBottom: 6 }}>Looking Back</h1>
      <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginBottom: 20 }}>The last 12 weeks — did I show up?</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[['Days shown up', trackedDays, C.blue], ['Strong days', cleanDays, C.green], ['Follow-through', trackedDays ? Math.round(cleanDays / trackedDays * 100) + '%' : '—', C.amber]].map(([l, v, c]) => (
          <Panel key={l} style={{ padding: '16px' }}><div style={{ fontFamily: SER, fontSize: 30, fontWeight: 600, color: c, lineHeight: 1 }}>{v}</div><div style={{ fontFamily: F, fontSize: 10.5, color: C.muted, marginTop: 6 }}>{l}</div></Panel>
        ))}
      </div>
      <Panel style={{ padding: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {cols.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {col.map(c => <div key={c.key} title={c.key} style={{ width: 15, height: 15, borderRadius: 3, background: c.future ? 'transparent' : colors[c.level], border: c.future ? `1px dashed ${C.border}` : 'none' }} />)}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, fontFamily: F, fontSize: 10, color: C.dim }}>
          less {colors.map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />)} more
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// VISION (simplified: Board · Focus · Wins)
// ════════════════════════════════════════════════════════════════════════════════
const VIS_TABS = [['board', 'Board'], ['focus', 'Focus'], ['wins', 'Wins']]

function VisionBoard({ vision, setVision, theme }) {
  const [tab, setTab] = useState('board')
  const [motiv, setMotiv] = useState(false)
  const setV = patch => setVision(v => ({ ...v, ...patch }))
  const images = (vision.items || []).filter(i => i.kind === 'image')
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontFamily: SER, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 600 }}>Vision</h1>
          <p style={{ fontFamily: F, fontSize: 12, color: C.muted, marginTop: 4, letterSpacing: '0.02em', textTransform: 'uppercase' }}>The life you&rsquo;re building. Look at it often.</p>
        </div>
        {images.length > 0 && <button onClick={() => setMotiv(true)} style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${C.amber}`, background: 'transparent', color: C.amber }}>▶ Motivation mode</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '16px 0 18px', borderBottom: `1px solid ${C.border}` }}>
        {VIS_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ fontFamily: F, fontSize: 13, fontWeight: tab === id ? 600 : 500, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: tab === id ? C.blueDim : 'transparent', color: tab === id ? C.blue : C.muted }}>{label}</button>
        ))}
      </div>
      {tab === 'board' && <BoardTab vision={vision} setV={setV} />}
      {tab === 'focus' && <FocusTab vision={vision} setV={setV} />}
      {tab === 'wins' && <WinsTab vision={vision} setV={setV} />}
      {motiv && <MotivationMode images={images} onClose={() => setMotiv(false)} />}
    </div>
  )
}

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
        <button onClick={addImage} style={btnStyle(C.blue)}>+ Image URL</button>
        <button onClick={() => fileRef.current.click()} style={btnStyle(C.muted)}>+ Upload image</button>
        <button onClick={addGoal} style={btnStyle(C.green)}>+ Goal</button>
        <button onClick={addNote} style={btnStyle(C.muted)}>+ Note</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} />
      </div>
      <div data-board style={{ position: 'relative', width: '100%', minHeight: 460, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--card-shadow)', backgroundImage: `radial-gradient(var(--surface2) 1px, transparent 1px)`, backgroundSize: '22px 22px' }}>
        {items.length === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}><div style={{ fontFamily: SER, fontSize: 17, color: C.muted }}>Your board is empty.</div><div style={{ fontFamily: F, fontSize: 12, color: C.dim }}>Add images of the life you want, plus goals to chase. Drag them anywhere.</div></div>}
        {items.slice().sort((a, b) => (a.z || 0) - (b.z || 0)).map(it => (
          <div key={it.id} onMouseDown={e => { if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') dragStart(e, it) }}
            onClick={() => setEditing(it.id)}
            style={{ position: 'absolute', left: it.x, top: it.y, width: it.w, minHeight: it.kind === 'image' ? undefined : it.h, height: it.kind === 'image' ? it.h : undefined, cursor: 'move', zIndex: (it.z || 0) + 1, border: editing === it.id ? `2px solid ${C.blue}` : '2px solid transparent', borderRadius: 10, boxShadow: 'var(--card-shadow)' }}>
            {it.kind === 'image' && <img src={it.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }} />}
            {it.kind === 'goal' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: '12px 14px', height: '100%', borderLeft: `3px solid ${C.green}` }}>
                <input value={it.text} onChange={e => patch(it.id, { text: e.target.value })} style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontFamily: SER, fontSize: 15, fontWeight: 600, outline: 'none', marginBottom: 8 }} />
                <div style={{ height: 7, background: C.surface3, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}><div style={{ height: '100%', width: (it.progress || 0) + '%', background: C.green, borderRadius: 4 }} /></div>
                <input type="range" min={0} max={100} value={it.progress || 0} onChange={e => patch(it.id, { progress: Number(e.target.value) })} style={{ width: '100%' }} />
                <div style={{ fontFamily: F, fontSize: 10, color: C.muted, textAlign: 'right' }}>{it.progress || 0}%</div>
              </div>
            )}
            {it.kind === 'text' && <textarea value={it.text} onChange={e => patch(it.id, { text: e.target.value })} style={{ width: '100%', height: '100%', background: C.surface2, border: 'none', borderRadius: 8, color: C.text, fontFamily: SER, fontSize: 14, padding: '12px 14px', outline: 'none', resize: 'none', borderLeft: `3px solid ${C.amber}` }} />}
            {editing === it.id && <button onClick={e => { e.stopPropagation(); del(it.id) }} style={{ position: 'absolute', top: -10, right: -10, width: 22, height: 22, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: F, fontSize: 11, color: C.dim, marginTop: 10 }}>Tip: click an item to select it (then the × removes it). Drag to move. Slide a goal to update its progress.</div>
    </div>
  )
}
const btnStyle = c => ({ fontFamily: F, fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${c}`, background: 'transparent', color: c })

function FocusTab({ vision, setV }) {
  const focus = vision.focus && vision.focus.length ? vision.focus : DEFAULT_VISION.focus
  const set = (id, p) => setV({ focus: focus.map(f => f.id === id ? { ...f, ...p } : f) })
  return (
    <div style={{ maxWidth: 620 }}>
      <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginBottom: 18 }}>If you did only three things to move your life forward, what are they? Keep these in view.</p>
      {focus.map((f, i) => (
        <Panel key={f.id} style={{ padding: '16px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontFamily: SER, fontSize: 30, fontWeight: 600, color: C.blue, opacity: 0.5, width: 30 }}>{i + 1}</div>
          <input value={f.text} onChange={e => set(f.id, { text: e.target.value })} placeholder={`Priority ${i + 1}`} style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontFamily: SER, fontSize: 17, fontWeight: 600, outline: 'none', textDecoration: f.done ? 'line-through' : 'none', opacity: f.done ? 0.5 : 1 }} />
          <div onClick={() => set(f.id, { done: !f.done })} style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${f.done ? C.green : C.border2}`, background: f.done ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15120e', fontSize: 13 }}>{f.done ? '✓' : ''}</div>
        </Panel>
      ))}
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
      <p style={{ fontFamily: F, fontSize: 13, color: C.muted, marginBottom: 16 }}>Proof you&rsquo;re moving. Log every win — big or small. Read them on the hard days.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="something you did / got / became…" style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, padding: '10px 12px', outline: 'none', fontFamily: F }} />
        <button onClick={add} style={{ fontFamily: F, fontSize: 13, fontWeight: 600, padding: '0 16px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.amber}`, background: 'transparent', color: C.amber }}>Log win</button>
      </div>
      {wins.length === 0 ? <div style={{ fontFamily: F, fontSize: 12, color: C.dim }}>No wins logged yet. Start today.</div> : wins.map(w => (
        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', marginBottom: 8, boxShadow: 'var(--card-shadow)' }}>
          <span style={{ color: C.amber, fontSize: 15 }}>★</span>
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
      <img src={images[idx].src} alt="" style={{ maxWidth: '92%', maxHeight: '86%', objectFit: 'contain', borderRadius: 10, boxShadow: '0 0 80px rgba(220,161,95,0.3)' }} />
      <div style={{ position: 'absolute', bottom: 30, display: 'flex', gap: 7 }}>{images.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === idx ? '#dca15f' : '#3a3128' }} />)}</div>
      <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 28, background: 'none', border: 'none', color: '#dca15f', fontSize: 28, cursor: 'pointer' }}>×</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// JOURNAL
// ════════════════════════════════════════════════════════════════════════════════
function JournalView({ vision, setVision }) {
  const journal = vision.journal || []
  const todayEntry = journal.find(e => e.date === todayKey())
  const [text, setText] = useState(todayEntry?.text || '')
  const now = new Date()
  const nightMode = now.getHours() >= 21
  const wc = wordCount(text)
  const required = 150
  const done = wc >= required
  const [q, a] = dailyQuote()

  const save = () => {
    const entry = { date: todayKey(), text, ts: Date.now() }
    const next = journal.some(e => e.date === todayKey()) ? journal.map(e => e.date === todayKey() ? entry : e) : [entry, ...journal]
    setVision(v => ({ ...v, journal: next }))
  }
  useEffect(() => { const i = setTimeout(save, 500); return () => clearTimeout(i) }, [text])
  const past = journal.filter(e => e.date !== todayKey()).sort((a, b) => (b.ts || 0) - (a.ts || 0))

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', animation: 'fadeUp 0.3s ease' }}>
      <h1 style={{ fontFamily: SER, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 600, marginBottom: 6 }}>Journal</h1>
      <p style={{ fontFamily: F, fontSize: 12, color: C.muted, marginBottom: 18, letterSpacing: '0.02em', textTransform: 'uppercase' }}>End the day honest. Even when it was a bad one.</p>
      <DailyQuote style={{ marginBottom: 18 }} />
      <Panel style={{ padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Tonight&rsquo;s reflection</div>
        <div style={{ fontFamily: F, fontSize: 11.5, color: C.muted, marginBottom: 12 }}>{nightMode ? 'Write at least 150 words about today — the good, the bad, the honest.' : 'Come back after 9pm to close out the day. But you can start now.'}</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={9} placeholder="What actually happened today? What did you avoid, face, feel, learn?" style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: '14px', outline: 'none', fontFamily: F, resize: 'vertical', lineHeight: 1.6 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ height: 5, flex: 1, background: C.surface2, borderRadius: 3, overflow: 'hidden', marginRight: 12 }}><div style={{ height: '100%', width: Math.min(100, wc / required * 100) + '%', background: done ? C.green : C.amber, borderRadius: 3 }} /></div>
          <span style={{ fontFamily: F, fontSize: 11, color: done ? C.green : C.muted }}>{wc}/{required} words {done ? '✓' : ''}</span>
        </div>
      </Panel>
      {past.length > 0 && (
        <>
          <div style={{ fontFamily: SER, fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Past entries</div>
          {past.map(e => (
            <Panel key={e.date} style={{ padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontFamily: F, fontSize: 10.5, color: C.dim, marginBottom: 6 }}>{new Date(e.ts || e.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
              <div style={{ fontFamily: F, fontSize: 13, color: C.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.text}</div>
            </Panel>
          ))}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════════════════
function BootScreen() {
  const [n, setN] = useState(0)
  useEffect(() => { if (n < BOOT_LINES.length) { const t = setTimeout(() => setN(n + 1), 360); return () => clearTimeout(t) } }, [n])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#14110e', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000 }}>
      <div style={{ width: 380, maxWidth: '90%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, animation: 'glowPulse 3s ease-in-out infinite' }}><Ember size={56} color="#dca15f" glow /></div>
          <div style={{ fontFamily: SER, fontSize: 30, fontWeight: 600, letterSpacing: '0.18em', color: '#ece2d5' }}>FORGE</div>
        </div>
        <div style={{ background: '#1c1815', border: '1px solid rgba(224,168,99,0.2)', borderRadius: 12, padding: '20px 22px', minHeight: 170 }}>
          {BOOT_LINES.slice(0, n).map((l, i) => (
            <div key={i} style={{ fontFamily: i === BOOT_LINES.length - 1 ? SER : F, fontSize: i === BOOT_LINES.length - 1 ? 16 : 13, fontWeight: i === BOOT_LINES.length - 1 ? 600 : 400, color: i === BOOT_LINES.length - 1 ? '#ece2d5' : '#9c8d7c', lineHeight: '24px', animation: 'slideIn 0.2s ease', marginTop: i === BOOT_LINES.length - 1 ? 6 : 0 }}>
              <span style={{ color: '#5c5045', marginRight: 8 }}>{i === BOOT_LINES.length - 1 ? '❯' : '·'}</span>{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// SHELL
// ════════════════════════════════════════════════════════════════════════════════
function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 820)
  useEffect(() => { const f = () => setM(window.innerWidth <= 820); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return m
}
const NAV = [['calendar', 'Calendar', '01'], ['today', 'Today', '02'], ['money', 'Money', '03'], ['avoiding', 'Avoiding', '04'], ['intel', 'Looking Back', '05'], ['vision', 'Vision', '06'], ['journal', 'Journal', '07']]

function ForgeApp({ profileName, onLock }) {
  const [booting, setBooting] = useState(true)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('calendar')
  const [weekOffset, setWeekOffset] = useState(0)
  const [theme, setThemeState] = useState(loadTheme)
  const [events, setEvents] = useState(loadEvents)
  const [data, setData] = useState(loadData)
  const [vision, setVision] = useState(() => { const v = loadVision(); return v ? { ...DEFAULT_VISION, ...v } : DEFAULT_VISION })
  const [avoiding, setAvoiding] = useState(loadAvoiding)
  const [finance, setFinance] = useState(() => { const f = loadFinance(); return f ? { ...DEFAULT_FINANCE, ...f } : DEFAULT_FINANCE })
  const isMobile = useIsMobile()

  useEffect(() => { const t = setTimeout(() => setBooting(false), 2100); const t2 = setTimeout(() => setReady(true), 2200); return () => { clearTimeout(t); clearTimeout(t2) } }, [])
  useEffect(() => { saveVision(vision) }, [vision])
  useEffect(() => { saveAvoiding(avoiding) }, [avoiding])
  useEffect(() => { saveFinance(finance) }, [finance])

  const setTheme = t => { setThemeState(t); saveTheme(t) }
  const changeEvents = e => { setEvents(e); saveEvents(e) }

  const scheduleBlock = ({ title, desc = '', color = 'amber' }) => {
    const dow = (new Date().getDay() + 1) % 7
    const next = [...events, { id: uid('e'), title, desc, color, startH: 9, startM: 0, endH: 10, endM: 0, dayOfWeek: dow, allDay: false, repeat: 'none' }]
    changeEvents(next)
  }
  const addToToday = text => {
    const k = todayKey(); const dd = data[k] || { done: {}, notes: '', personal: [] }
    const next = { ...data, [k]: { ...dd, personal: [...(dd.personal || []), { id: uid('p'), text, done: false }] } }
    setData(next); saveData(next)
  }

  const streak = useMemo(() => computeStreak(data), [data])
  const journalDue = (() => { const done = (vision.journal || []).some(e => e.date === todayKey() && wordCount(e.text) >= 150); return new Date().getHours() >= 21 && !done })()

  if (booting) return <><style>{CSS}</style><BootScreen /></>

  return (
    <>
      <style>{CSS}</style>
      <div className="app-root" data-theme={theme}>
        <Background />
        <div className="topbar-m">
          <Ember size={24} color={C.blue} glow />
          <span style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, letterSpacing: '0.14em', color: C.text }}>FORGE</span>
          {profileName && <span style={{ fontFamily: F, fontSize: 11, color: C.dim }}>· {profileName}</span>}
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: F, fontSize: 12, color: streak > 0 ? C.amber : C.dim, fontWeight: 600 }}>🔥 {streak}</span>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 15, width: 36, height: 36, cursor: 'pointer' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={onLock} title="Lock" style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 9, color: C.muted, fontSize: 14, width: 36, height: 36, cursor: 'pointer' }}>🔒</button>
        </div>

        <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1, opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}>
          <nav className="only-desktop" style={{ width: 220, flexShrink: 0, background: 'var(--surface)', borderRight: `1px solid ${C.border}`, padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 0, height: '100vh', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26, paddingLeft: 8 }}>
              <div style={{ animation: 'glowPulse 7s ease-in-out infinite' }}><Ember size={30} color={C.blue} glow /></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: SER, fontSize: 20, fontWeight: 600, color: C.text, lineHeight: 1, letterSpacing: '0.14em' }}>FORGE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontFamily: F, fontSize: 10, color: C.muted, letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileName || 'made, not born'}</span>
                  <button onClick={onLock} title="Lock" style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer', padding: 0 }}>🔒</button>
                </div>
              </div>
            </div>
            {NAV.map(([id, label, code]) => <NavItem key={id} code={code} label={label} active={view === id} onClick={() => setView(id)} badge={id === 'journal' && journalDue} />)}
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontFamily: F, fontSize: 12 }}>{theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}</button>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 12 }}>
              <div style={{ background: C.surface, border: `1px solid ${streak > 0 ? C.border2 : C.border}`, borderRadius: 8, padding: '16px 12px', textAlign: 'center', boxShadow: streak > 0 ? 'var(--card-shadow)' : 'none' }}>
                <div style={{ fontFamily: SER, fontSize: 42, fontWeight: 600, color: C.amber, lineHeight: 1 }}>{streak}</div>
                <div style={{ fontSize: 18, margin: '4px 0 2px' }}>🔥</div>
                <div style={{ fontFamily: F, fontSize: 8, color: C.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>days showing up</div>
                <div style={{ fontFamily: F, fontSize: 9, marginTop: 8, color: streak > 0 ? C.amber : C.dim }}>{streak > 0 ? "don't break the chain" : 'today can be day one'}</div>
              </div>
            </div>
          </nav>

          <main className="main-pad" style={{ flex: 1, minWidth: 0, padding: '28px 40px', overflowX: 'hidden' }}>
            {view === 'calendar' && <WeeklyCalendar weekOffset={weekOffset} setWeekOffset={setWeekOffset} events={events} onEventsChange={changeEvents} isMobile={isMobile} theme={theme} />}
            {view === 'today' && <TodayView data={data} setData={setData} events={events} />}
            {view === 'money' && <MoneyView finance={finance} setFinance={setFinance} isMobile={isMobile} />}
            {view === 'avoiding' && <AvoidingView avoiding={avoiding} setAvoiding={setAvoiding} scheduleBlock={scheduleBlock} addToToday={addToToday} />}
            {view === 'intel' && <IntelView data={data} />}
            {view === 'vision' && <VisionBoard vision={vision} setVision={setVision} theme={theme} />}
            {view === 'journal' && <JournalView vision={vision} setVision={setVision} />}
          </main>
        </div>

        <div className="bottom-nav">
          {NAV.map(([id]) => {
            const active = view === id
            const short = { calendar: 'Plan', today: 'Today', money: 'Money', avoiding: 'Avoid', intel: 'Back', vision: 'Vision', journal: 'Log' }[id]
            return (
              <button key={id} onClick={() => setView(id)}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? C.blue : 'transparent', boxShadow: active ? `0 0 7px ${C.blueGlow}` : 'none' }} />
                <span style={{ fontFamily: F, fontSize: 9, color: active ? C.blue : C.muted, fontWeight: active ? 600 : 400 }}>{short}</span>
                {id === 'journal' && journalDue && !active && <div style={{ position: 'absolute', top: 4, right: '22%', width: 6, height: 6, borderRadius: '50%', background: C.red }} />}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PROFILES + GATE
// ════════════════════════════════════════════════════════════════════════════════
const AVATAR_COLORS = ['#dca15f', '#93a777', '#cf7b6b', '#7fa8c9', '#b58fd9', '#5fb7a1', '#d98a4a']
const avatarColor = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length] }

function LoginGate({ profiles, setProfiles, onUnlock }) {
  const G = { bg: '#14110e', card: '#1c1815', card2: '#231e1a', border: 'rgba(224,168,99,0.18)', gold: '#dca15f', goldDim: 'rgba(224,168,99,0.12)', text: '#ece2d5', muted: '#9c8d7c', dim: '#5c5045', red: '#cf7b6b' }
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
  const input = { width: '100%', background: G.card2, border: `1px solid ${G.border}`, borderRadius: 9, color: G.text, fontSize: 16, padding: '12px 13px', outline: 'none', fontFamily: F, boxSizing: 'border-box', marginBottom: 10 }
  const goldBtn = { width: '100%', fontFamily: F, fontSize: 14, fontWeight: 600, padding: 12, borderRadius: 9, cursor: 'pointer', border: 'none', background: G.gold, color: '#1a140d', marginTop: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 60% at 50% 118%,' + G.goldDim + ' 0%,transparent 62%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', width: 380, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Ember size={52} color={G.gold} glow /></div>
          <div style={{ fontFamily: SER, fontSize: 30, fontWeight: 600, letterSpacing: '0.18em', color: G.text }}>FORGE</div>
          <div style={{ fontFamily: F, fontSize: 9, letterSpacing: '0.32em', color: G.dim, marginTop: 6, textTransform: 'uppercase' }}>made, not born</div>
        </div>
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, padding: '22px 20px', boxShadow: '0 10px 40px rgba(0,0,0,0.45)' }}>
          {mode === 'pick' ? (
            <div>
              {!sel ? (<>
                <div style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, color: G.text, marginBottom: 14 }}>Who&rsquo;s this?</div>
                {profiles.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 11, borderRadius: 10, cursor: 'pointer', border: `1px solid ${G.border}`, marginBottom: 8, background: G.card2 }} onClick={() => { setSelId(p.id); setPass(''); setErr('') }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(p.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SER, fontSize: 17, fontWeight: 600, color: '#1a140d' }}>{(p.name[0] || '?').toUpperCase()}</div>
                    <span style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 600, color: G.text }}>{p.name}</span>
                    <span onClick={e => { e.stopPropagation(); removeProfile(p) }} style={{ color: G.dim, fontSize: 13, cursor: 'pointer', padding: '2px 6px' }}>×</span>
                  </div>
                ))}
                <button onClick={() => { setMode('create'); setErr(''); setNm(''); setP1(''); setP2('') }} style={{ width: '100%', fontFamily: F, fontSize: 13, fontWeight: 600, padding: 11, borderRadius: 9, cursor: 'pointer', border: `1px dashed ${G.border}`, background: 'transparent', color: G.muted, marginTop: 4 }}>+ Add someone</button>
              </>) : (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor(sel.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SER, fontSize: 19, fontWeight: 600, color: '#1a140d' }}>{(sel.name[0] || '?').toUpperCase()}</div>
                  <div><div style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, color: G.text }}>{sel.name}</div><div onClick={() => { setSelId(''); setErr('') }} style={{ fontFamily: F, fontSize: 11, color: G.muted, cursor: 'pointer' }}>← not you?</div></div>
                </div>
                <input autoFocus type="password" value={pass} onChange={e => { setPass(e.target.value); setErr('') }} onKeyDown={e => { if (e.key === 'Enter') unlock() }} placeholder="Passcode" style={input} />
                {err && <div style={{ fontFamily: F, fontSize: 12, color: G.red, marginBottom: 8 }}>{err}</div>}
                <button onClick={unlock} style={goldBtn}>Unlock</button>
              </>)}
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: SER, fontSize: 17, fontWeight: 600, color: G.text, marginBottom: 4 }}>{profiles.length ? 'New profile' : 'Set up your profile'}</div>
              <div style={{ fontFamily: F, fontSize: 11.5, color: G.muted, marginBottom: 16, lineHeight: 1.5 }}>{profiles.length ? 'Separate space, separate passcode.' : 'This locks your space on this device. Your existing data moves into this first profile.'}</div>
              <input value={nm} onChange={e => { setNm(e.target.value); setErr('') }} placeholder="Name" style={input} />
              <input type="password" value={p1} onChange={e => { setP1(e.target.value); setErr('') }} placeholder="Passcode (4+ characters)" style={input} />
              <input type="password" value={p2} onChange={e => { setP2(e.target.value); setErr('') }} onKeyDown={e => { if (e.key === 'Enter') create() }} placeholder="Confirm passcode" style={input} />
              {err && <div style={{ fontFamily: F, fontSize: 12, color: G.red, marginBottom: 8 }}>{err}</div>}
              <button onClick={create} style={goldBtn}>Create &amp; enter</button>
              {profiles.length > 0 && <button onClick={() => { setMode('pick'); setErr('') }} style={{ width: '100%', fontFamily: F, fontSize: 12, padding: 10, borderRadius: 9, cursor: 'pointer', border: 'none', background: 'transparent', color: G.muted, marginTop: 6 }}>← back</button>}
            </div>
          )}
        </div>
        <div style={{ fontFamily: F, fontSize: 10.5, color: G.dim, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>A local lock for privacy — not bank-grade security. Forgot a passcode? There&rsquo;s no recovery; you&rsquo;d delete the profile and start fresh.</div>
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