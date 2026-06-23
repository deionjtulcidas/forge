import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ── ICON: forge flame ──────────────────────────────────────────────────────────
function Ember({ size = 40, color = 'var(--blue)', glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: glow ? `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 13px ${color})` : 'none', display: 'block' }}>
      <path d="M33 4c2 9-4 13-9 18-6 6-11 12-11 21 0 10 8 17 19 17s19-7 19-18c0-7-3-12-7-17-1 4-3 6-6 7 3-9-1-19-4-25z" fill={color} opacity="0.92"/>
      <path d="M32 30c1 5-3 7-5 11-1 3-1 5-1 7 0 5 3 8 7 8s8-4 8-9c0-4-2-7-4-10-1 2-2 3-4 4 1-4 0-8-1-11z" fill="var(--bg)" opacity="0.55"/>
    </svg>
  )
}

// ── BOOT LINES ────────────────────────────────────────────────────────────────
const BOOT_LINES = [
  { t:'sys',  txt:'Lighting the forge...' },
  { t:'sys',  txt:'You are not finished. That is the point.' },
  { t:'ok',   txt:'What you avoid today is still here tomorrow.' },
  { t:'ok',   txt:'So pick one hard thing. Start there.' },
  { t:'sys',  txt:'—' },
  { t:'hero', txt:'Back to work.' },
]

const DAYS_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS_SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const HOURS = Array.from({length:24},(_,i)=>i) // 0..23

const EVENT_COLORS = [
  { id:'blue',   bg:'rgba(56,125,255,0.85)',  border:'#387dff', text:'#fff' },
  { id:'green',  bg:'rgba(52,211,153,0.85)',  border:'#34d399', text:'#000' },
  { id:'amber',  bg:'rgba(245,158,11,0.85)',  border:'#f59e0b', text:'#000' },
  { id:'red',    bg:'rgba(248,113,113,0.85)', border:'#f87171', text:'#fff' },
  { id:'purple', bg:'rgba(167,139,250,0.85)', border:'#a78bfa', text:'#fff' },
  { id:'cyan',   bg:'rgba(34,211,238,0.85)',  border:'#22d3ee', text:'#000' },
]

// ── STORAGE ───────────────────────────────────────────────────────────────────
const todayKey   = () => new Date().toISOString().slice(0,10)
const loadEvents = () => { try { return JSON.parse(localStorage.getItem('hud_events')||'[]') } catch { return [] } }
const saveEvents = e => { try { localStorage.setItem('hud_events',JSON.stringify(e)) } catch {} }
const loadData   = () => { try { return JSON.parse(localStorage.getItem('hud_v4')||'{}') } catch { return {} } }
const saveData   = d => { try { localStorage.setItem('hud_v4',JSON.stringify(d)) } catch {} }
const loadVision = () => { try { return JSON.parse(localStorage.getItem('hud_vision')||'null') } catch { return null } }
const saveVision = v => { try { localStorage.setItem('hud_vision',JSON.stringify(v)) } catch {} }
const loadTheme  = () => { try { return localStorage.getItem('hud_theme')||'dark' } catch { return 'dark' } }
const saveTheme  = t => { try { localStorage.setItem('hud_theme',t) } catch {} }
const loadName   = () => { try { return localStorage.getItem('forge_name')||'' } catch { return '' } }
const saveName   = n => { try { localStorage.setItem('forge_name',n) } catch {} }
const loadAvoiding = () => { try { return JSON.parse(localStorage.getItem('forge_avoiding')||'[]') } catch { return [] } }
const saveAvoiding = a => { try { localStorage.setItem('forge_avoiding',JSON.stringify(a)) } catch {} }
const loadStudy  = () => { try { return JSON.parse(localStorage.getItem('forge_study')||'null') } catch { return null } }
const saveStudy  = s => { try { localStorage.setItem('forge_study',JSON.stringify(s)) } catch {} }
const DEFAULT_STUDY = { subjects:[], notes:[] }

// spaced-repetition recall: intervals in days, user-driven (remembered advances, forgot resets)
const RECALL_STEPS=[1,3,7,14,30,90,180]
const DAYMS=86400000
function recallDue(n){ if(n.recallDueAt==null) return true; return Date.now()>=n.recallDueAt }
function recallAfter(stage){ return Date.now()+RECALL_STEPS[Math.min(stage,RECALL_STEPS.length-1)]*DAYMS }
function daysAgo(ts){ if(!ts) return null; return Math.floor((Date.now()-ts)/DAYMS) }
function agoLabel(ts){ const d=daysAgo(ts); if(d==null) return 'never'; if(d<=0) return 'today'; if(d===1) return 'yesterday'; if(d<7) return d+'d ago'; if(d<30) return Math.floor(d/7)+'w ago'; return Math.floor(d/30)+'mo ago' }

// ── THEME ─────────────────────────────────────────────────────────────────────
// Colors are CSS variables now so the original components stay byte-for-byte the
// same — they still read C.blue etc, those just resolve per [data-theme].
const C = {
  bg:'var(--bg)', surface:'var(--surface)', surface2:'var(--surface2)', surface3:'var(--surface3)',
  border:'var(--border)', border2:'var(--border2)',
  blue:'var(--blue)', blueBright:'var(--blueBright)', blueDim:'var(--blueDim)', blueGlow:'var(--blueGlow)',
  text:'var(--text)', muted:'var(--muted)', dim:'var(--dim)',
  amber:'var(--amber)', amberGlow:'var(--amberGlow)',
  green:'var(--green)', greenGlow:'var(--greenGlow)', red:'var(--red)',
}

const THEME_TOKENS = `
  :root, .app-root[data-theme="dark"]{
    --bg:#14110e; --surface:#1c1815; --surface2:#231e1a; --surface3:#2b2520;
    --border:rgba(224,168,99,0.12); --border2:rgba(224,168,99,0.3);
    --blue:#dca15f; --blueBright:#f0bd80; --blueDim:rgba(224,168,99,0.1); --blueGlow:rgba(224,168,99,0.38);
    --text:#ece2d5; --muted:#9c8d7c; --dim:#5c5045;
    --amber:#d98a4a; --amberGlow:rgba(217,138,74,0.4);
    --green:#93a777; --greenGlow:rgba(147,167,119,0.35); --red:#cf7b6b;
    --vignette:rgba(15,11,8,0.92); --grid-line:rgba(224,168,99,0.05); --canvas-dot:rgba(224,168,99,0.12);
    --card-shadow:0 6px 22px rgba(0,0,0,0.4); --card-shadow-sel:0 10px 30px rgba(0,0,0,0.46); --item-border:rgba(236,226,213,0.08);
  }
  .app-root[data-theme="light"]{
    --bg:#f3ede3; --surface:#fbf7f0; --surface2:#f1e9dc; --surface3:#e7ddcd;
    --border:rgba(120,86,46,0.16); --border2:rgba(120,86,46,0.34);
    --blue:#b3792e; --blueBright:#c98e3f; --blueDim:rgba(179,121,46,0.1); --blueGlow:rgba(179,121,46,0.3);
    --text:#2b2118; --muted:#6f6155; --dim:#a99680;
    --amber:#b0682f; --amberGlow:rgba(176,104,47,0.32);
    --green:#5f7a48; --greenGlow:rgba(95,122,72,0.3); --red:#b85746;
    --vignette:rgba(243,237,227,0.55); --grid-line:rgba(120,86,46,0.07); --canvas-dot:rgba(120,86,46,0.14);
    --card-shadow:0 5px 18px rgba(43,33,24,0.1); --card-shadow-sel:0 9px 26px rgba(43,33,24,0.16); --item-border:rgba(43,33,24,0.12);
  }
`

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&display=swap');
  ${THEME_TOKENS}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body,#root{height:100%}
  body{background:var(--bg);color:var(--text);font-family:'Inter',-apple-system,system-ui,sans-serif;min-height:100vh;overflow-x:hidden}
  .app-root{background:var(--bg);min-height:100vh;transition:background 0.3s ease}
  input,textarea,button,select{font-family:'Inter',-apple-system,system-ui,sans-serif}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.dim};border-radius:2px}
  @keyframes scan{0%{top:-2px}100%{top:100vh}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
  @keyframes flicker{0%,88%,90%,94%,100%{opacity:1}89%,92%{opacity:0.15}93%{opacity:0.7}}
  @keyframes gridPulse{0%,100%{opacity:0.03}50%{opacity:0.07}}
  @keyframes glowPulse{0%,100%{opacity:0.4}50%{opacity:1}}
  @keyframes dotPulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.6);opacity:1}}
  @keyframes countUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @media (prefers-reduced-motion: reduce){*{animation-duration:0.001ms !important;animation-iteration-count:1 !important}}
  ::selection{background:var(--blueDim);color:var(--text)}
  /* ── responsive ── */
  .topbar-m,.bottom-nav{display:none}
  .topbar-m{position:sticky;top:0;z-index:40;align-items:center;gap:10px;padding:11px 16px;background:var(--surface);border-bottom:1px solid var(--border);backdrop-filter:blur(16px)}
  .bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--surface);border-top:1px solid var(--border);padding:6px 4px calc(6px + env(safe-area-inset-bottom));backdrop-filter:blur(16px)}
  .bottom-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;padding:7px 2px;cursor:pointer;position:relative}
  @media (max-width:760px){
    .only-desktop{display:none !important}
    .topbar-m{display:flex !important}
    .bottom-nav{display:flex !important}
    .main-pad{padding:16px 14px 96px !important}
    .modal-wrap{align-items:flex-end !important;padding:0 !important}
    .modal-card{width:100% !important;max-width:100% !important;border-radius:16px 16px 0 0 !important;max-height:90vh !important}
    input,textarea,select,button{font-size:16px}
  }
`

// ── BACKGROUND ────────────────────────────────────────────────────────────────
function Background() {
  return (
    <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',overflow:'hidden'}}>
      {/* a warm light low on the horizon — dawn coming up out of the dark */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 90% 60% at 50% 118%,var(--blueDim) 0%,transparent 62%)'}}/>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 50% at 50% -10%,var(--blueDim) 0%,transparent 60%)',opacity:0.5}}/>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 45%,transparent 30%,var(--vignette) 100%)'}}/>
      <div style={{position:'absolute',bottom:0,left:'12%',right:'12%',height:'1px',background:'linear-gradient(90deg,transparent,var(--blueGlow),transparent)',boxShadow:'0 0 50px var(--blueGlow)',animation:'glowPulse 8s ease-in-out infinite'}}/>
    </div>
  )
}

function Corners({size=12,color=C.blue,opacity=1}){
  const b=`1.5px solid ${color}`,s={position:'absolute',width:size,height:size,opacity}
  return(<><div style={{...s,top:0,left:0,borderTop:b,borderLeft:b}}/><div style={{...s,top:0,right:0,borderTop:b,borderRight:b}}/><div style={{...s,bottom:0,left:0,borderBottom:b,borderLeft:b}}/><div style={{...s,bottom:0,right:0,borderBottom:b,borderRight:b}}/></>)
}

function Panel({children,glow=false,amber=false,style={},onClick}){
  const bc=amber?'rgba(245,158,11,0.25)':glow?C.border2:C.border
  const shd=amber?'0 0 30px rgba(245,158,11,0.08)':glow?'0 0 30px var(--blueDim)':'none'
  return(
    <div onClick={onClick} style={{background:C.surface,border:`1px solid ${bc}`,borderRadius:4,position:'relative',boxShadow:shd,transition:'all 0.3s ease',cursor:onClick?'pointer':undefined,...style}}>
      <Corners color={amber?C.amber:glow?C.blue:C.dim} opacity={glow||amber?0.8:0.22}/>
      {children}
    </div>
  )
}

function LiveClock(){
  const [t,setT]=useState(new Date())
  useEffect(()=>{const i=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(i)},[])
  const p=n=>String(n).padStart(2,'0')
  const h=t.getHours(),ampm=h>=12?'PM':'AM',hh=h%12||12
  return(<span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,color:C.muted,letterSpacing:'0.1em'}}>{p(hh)}<span style={{animation:'blink 1s step-end infinite',opacity:0.4}}>:</span>{p(t.getMinutes())}<span style={{animation:'blink 1s step-end infinite',opacity:0.4}}>:</span>{p(t.getSeconds())} {ampm}</span>)
}

// ── BOOT SCREEN ───────────────────────────────────────────────────────────────
function BootScreen({onDone}){
  const [lines,setLines]=useState([])
  const [progress,setProgress]=useState(0)
  const [fading,setFading]=useState(false)
  const doneRef=useRef(false)
  useEffect(()=>{
    let idx=0
    const iv=setInterval(()=>{
      if(doneRef.current){clearInterval(iv);return}
      if(idx<BOOT_LINES.length){
        const line=BOOT_LINES[idx]
        if(line){setLines(prev=>[...prev,line]);setProgress(Math.round(((idx+1)/BOOT_LINES.length)*100))}
        idx++
      } else {
        clearInterval(iv)
        if(!doneRef.current){doneRef.current=true;setTimeout(()=>setFading(true),300);setTimeout(()=>onDone(),750)}
      }
    },100)
    return()=>{doneRef.current=true;clearInterval(iv)}
  },[])
  const lc=t=>t==='hero'?C.blue:t==='ok'?C.green:C.muted
  return(
    <div style={{position:'fixed',inset:0,zIndex:9999,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',opacity:fading?0:1,transition:'opacity 0.5s ease'}}>
      <Background/>
      <div style={{width:560,maxWidth:'92vw',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:14,animation:'glowPulse 5s ease-in-out infinite'}}><Ember size={64} color={C.blue} glow/></div>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:30,fontWeight:600,letterSpacing:'0.18em',color:C.text}}>FORGE</div>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,letterSpacing:'0.32em',color:C.dim,marginTop:6,textTransform:'uppercase'}}>made, not born</div>
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:10,padding:'20px 24px',minHeight:230,position:'relative',overflow:'hidden',boxShadow:'var(--card-shadow)'}}>
          <div style={{position:'absolute',top:0,left:'15%',right:'15%',height:'1px',background:`linear-gradient(90deg,transparent,${C.blue},transparent)`,animation:'glowPulse 3s ease-in-out infinite'}}/>
          {lines.map((line,i)=>(
            <div key={i} style={{fontFamily:line.t==='hero'?"'Fraunces',Georgia,serif":"'Inter',-apple-system,system-ui,sans-serif",fontSize:line.t==='hero'?17:13,lineHeight:'24px',color:lc(line.t),fontWeight:line.t==='hero'?600:400,animation:'slideIn 0.12s ease',marginTop:line.t==='hero'?6:0}}>
              <span style={{color:C.dim,marginRight:9,fontSize:10}}>{line.t==='ok'?'·':line.t==='hero'?'❯':' '}</span>{line.txt}
            </div>
          ))}
          <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:13,color:C.blue,animation:'blink 1s step-end infinite'}}>▌</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:12}}>
          <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.muted,minWidth:24}}>{progress}%</span>
          <div style={{flex:1,height:2,background:C.dim,borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',background:`linear-gradient(90deg,${C.blue},${C.blueBright})`,width:`${progress}%`,transition:'width 0.09s ease',boxShadow:`0 0 8px ${C.blueGlow}`}}/>
          </div>
          <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:progress===100?C.green:C.muted,minWidth:46,textAlign:'right',letterSpacing:'0.06em'}}>{progress===100?'ready':'opening'}</span>
        </div>
      </div>
    </div>
  )
}

// helper outside component to avoid hook rule violations
const getEvColor=id=>EVENT_COLORS.find(c=>c.id===id)||EVENT_COLORS[0]

// ── EVENT MODAL ───────────────────────────────────────────────────────────────
function EventModal({event,slot,onSave,onDelete,onClose}){
  const isNew=!event
  const [title,setTitle]=useState(event?.title||'')
  const [desc,setDesc]=useState(event?.desc||'')
  const [color,setColor]=useState(event?.color||'blue')
  const [startH,setStartH]=useState(event?.startH??slot?.hour??9)
  const [startM,setStartM]=useState(event?.startM??0)
  const [endH,setEndH]=useState(event?.endH??(slot?.hour??9)+1)
  const [endM,setEndM]=useState(event?.endM??0)
  const [dayOfWeek,setDayOfWeek]=useState(event?.dayOfWeek??slot?.dow??1)
  const [allDay,setAllDay]=useState(event?.allDay||false)
  const [repeat,setRepeat]=useState(event?.repeat||'none')

  const fmt=n=>String(n).padStart(2,'0')
  const save=()=>{
    if(!title.trim())return
    onSave({...event,id:event?.id||('e_'+Date.now()),title:title.trim(),desc:desc.trim(),color,startH,startM,endH,endM,dayOfWeek,allDay,repeat})
  }

  return(
    <div className="modal-wrap" style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(10,7,4,0.78)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-card" style={{width:420,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto',background:C.surface,border:`1px solid ${C.border2}`,borderRadius:10,position:'relative',boxShadow:'var(--card-shadow-sel)',animation:'modalIn 0.2s ease'}}>
        <Corners color={C.blue}/>
        <div style={{padding:'18px 20px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:11,color:C.blue,letterSpacing:'0.2em'}}>{isNew?'NEW BLOCK':'EDIT BLOCK'}</div>
        </div>
        <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Block title *" autoFocus
            style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'10px 12px',color:C.text,fontSize:14,fontWeight:500,outline:'none',transition:'border 0.15s'}}
            onFocus={e=>e.target.style.borderColor=C.border2} onBlur={e=>e.target.style.borderColor=C.border}/>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
            style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'10px 12px',color:C.text,fontSize:13,outline:'none',resize:'none',transition:'border 0.15s'}}
            onFocus={e=>e.target.style.borderColor=C.border2} onBlur={e=>e.target.style.borderColor=C.border}/>

          <div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:6}}>DAY</div>
            <div style={{display:'flex',gap:4}}>
              {DAYS_FULL.map((d,i)=>(
                <button key={i} onClick={()=>setDayOfWeek(i)}
                  style={{flex:1,padding:'5px 0',borderRadius:2,border:dayOfWeek===i?`1px solid ${C.blue}`:`1px solid ${C.border}`,background:dayOfWeek===i?C.blueDim:'transparent',color:dayOfWeek===i?C.blue:C.muted,fontSize:8,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",cursor:'pointer',transition:'all 0.12s'}}>
                  {DAYS_SHORT[i].slice(0,2)}
                </button>
              ))}
            </div>
          </div>

          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,color:C.muted}}>
            <input type="checkbox" checked={allDay} onChange={e=>setAllDay(e.target.checked)} style={{width:14,height:14,accentColor:C.blue}}/>
            All day
          </label>

          {!allDay&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:5}}>START</div>
                <div style={{display:'flex',gap:4}}>
                  <select value={startH} onChange={e=>setStartH(Number(e.target.value))} style={{flex:1,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'7px 6px',color:C.text,fontSize:12,outline:'none'}}>
                    {HOURS.map(h=><option key={h} value={h}>{h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`}</option>)}
                  </select>
                  <select value={startM} onChange={e=>setStartM(Number(e.target.value))} style={{width:54,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'7px 4px',color:C.text,fontSize:12,outline:'none'}}>
                    {[0,15,30,45].map(m=><option key={m} value={m}>{fmt(m)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:5}}>END</div>
                <div style={{display:'flex',gap:4}}>
                  <select value={endH} onChange={e=>setEndH(Number(e.target.value))} style={{flex:1,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'7px 6px',color:C.text,fontSize:12,outline:'none'}}>
                    {HOURS.map(h=><option key={h} value={h}>{h===0?'12 AM':h<12?`${h} AM`:h===12?'12 PM':`${h-12} PM`}</option>)}
                  </select>
                  <select value={endM} onChange={e=>setEndM(Number(e.target.value))} style={{width:54,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'7px 4px',color:C.text,fontSize:12,outline:'none'}}>
                    {[0,15,30,45].map(m=><option key={m} value={m}>{fmt(m)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:5}}>REPEAT</div>
            <select value={repeat} onChange={e=>setRepeat(e.target.value)} style={{width:'100%',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'8px 10px',color:C.text,fontSize:12,outline:'none'}}>
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week (same day)</option>
              <option value="weekdays">Every weekday (Mon–Fri)</option>
            </select>
          </div>

          <div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:6}}>COLOR</div>
            <div style={{display:'flex',gap:8}}>
              {EVENT_COLORS.map(ec=>(
                <button key={ec.id} onClick={()=>setColor(ec.id)}
                  style={{width:24,height:24,borderRadius:'50%',background:ec.bg,border:color===ec.id?`2px solid #fff`:`2px solid transparent`,cursor:'pointer',transition:'all 0.12s',transform:color===ec.id?'scale(1.2)':'scale(1)'}}/>
              ))}
            </div>
          </div>
        </div>

        <div style={{padding:'14px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          {!isNew?(
            <button onClick={()=>onDelete(event.id)} style={{background:'none',border:`1px solid rgba(248,113,113,0.3)`,borderRadius:3,color:C.red,fontSize:12,padding:'7px 14px',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(248,113,113,0.1)'}} onMouseLeave={e=>{e.currentTarget.style.background='none'}}>Delete</button>
          ):<div/>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:3,color:C.muted,fontSize:12,padding:'7px 16px',cursor:'pointer'}}>Cancel</button>
            <button onClick={save} style={{background:C.blueDim,border:`1px solid ${C.blue}`,borderRadius:3,color:C.blue,fontWeight:600,padding:'7px 20px',cursor:'pointer',transition:'all 0.15s',fontFamily:"'Fraunces',Georgia,serif",letterSpacing:'0.08em',fontSize:10}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.blue;e.currentTarget.style.color='#fff'}} onMouseLeave={e=>{e.currentTarget.style.background=C.blueDim;e.currentTarget.style.color=C.blue}}>SAVE</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── WEEKLY CALENDAR ───────────────────────────────────────────────────────────
function WeeklyCalendar({weekOffset,setWeekOffset,events,onEventsChange,isMobile,theme}){
  const [modal,setModal]=useState(null)
  const [selDay,setSelDay]=useState(new Date().getDay())
  const [leadMin,setLeadMin]=useState(loadLead)
  const dragRef=useRef(null)      // move via native DnD
  const resizeRef=useRef(null)    // {id,startY,origEndAbs} live resize
  const [,force]=useState(0)
  const [currentTime,setCurrentTime]=useState(new Date())
  const gridRef=useRef()
  const HOUR_H=60

  useEffect(()=>{const i=setInterval(()=>setCurrentTime(new Date()),30000);return()=>clearInterval(i)},[])

  const commit=next=>{ saveEvents(next); onEventsChange&&onEventsChange(next) }

  // Build week correctly — start on Sunday, no double subtraction.
  const getWeekDates=()=>{
    const today=new Date()
    const sunday=new Date(today)
    sunday.setDate(today.getDate()-today.getDay()+weekOffset*7)
    sunday.setHours(0,0,0,0)
    return Array.from({length:7},(_,i)=>{const d=new Date(sunday);d.setDate(sunday.getDate()+i);return d})
  }
  const weekDates=getWeekDates()
  const todayStr=todayKey()

  const shouldShow=(ev,dateStr)=>{
    const d=new Date(dateStr+'T12:00:00')
    const dow=d.getDay()
    if(ev.repeat==='daily') return true
    if(ev.repeat==='weekly') return ev.dayOfWeek===dow
    if(ev.repeat==='weekdays') return dow>=1&&dow<=5
    return ev.dayOfWeek===dow
  }

  const saveEv=ev=>{
    const next=events.find(e=>e.id===ev.id)?events.map(e=>e.id===ev.id?ev:e):[...events,ev]
    commit(next); setModal(null)
  }
  const deleteEv=id=>{ commit(events.filter(e=>e.id!==id)); setModal(null) }

  const fmt12=h=>{if(h===0)return'12 AM';if(h<12)return`${h} AM`;if(h===12)return'12 PM';return`${h-12} PM`}

  const onDragStart=(e,ev)=>{ dragRef.current={evId:ev.id}; e.dataTransfer.effectAllowed='move' }
  const onDrop=(e,dow,hour)=>{
    e.preventDefault()
    if(!dragRef.current)return
    const ev=events.find(x=>x.id===dragRef.current.evId)
    if(!ev){dragRef.current=null;return}
    const dur=(ev.endH+ev.endM/60)-(ev.startH+ev.startM/60)
    const newEndH=Math.floor(hour+dur),newEndM=Math.round(((hour+dur)-newEndH)*60)
    commit(events.map(x=>x.id===dragRef.current.evId?{...x,dayOfWeek:dow,startH:hour,startM:0,endH:newEndH,endM:newEndM}:x))
    dragRef.current=null
  }

  // ── drag-to-resize (bottom edge) ────────────────────────────────────────────
  const startResize=(e,ev)=>{
    e.stopPropagation(); e.preventDefault()
    resizeRef.current={id:ev.id,startY:e.clientY,startEnd:ev.endH+ev.endM/60,startAbs:ev.startH+ev.startM/60}
  }
  useEffect(()=>{
    const move=e=>{
      const r=resizeRef.current; if(!r)return
      const deltaH=(e.clientY-r.startY)/HOUR_H
      let newEnd=Math.round((r.startEnd+deltaH)*4)/4          // snap 15 min
      newEnd=Math.min(24,Math.max(r.startAbs+0.25,newEnd))
      const endH=Math.floor(newEnd),endM=Math.round((newEnd-endH)*60)
      const cur=loadEvents().map(x=>x.id===r.id?{...x,endH:endH===24?23:endH,endM:endH===24?59:endM}:x)
      saveEvents(cur); onEventsChange&&onEventsChange(cur); force(n=>n+1)
    }
    const up=()=>{ resizeRef.current=null }
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up)
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
  },[onEventsChange])

  const nowMinutes=currentTime.getHours()*60+currentTime.getMinutes()
  const nowPx=nowMinutes*(HOUR_H/60)
  const allDayEvents=events.filter(ev=>ev.allDay)

  const exportICS=()=>downloadText('forge-schedule.ics',buildICS(events,leadMin),'text/calendar')
  const t12=(h,m)=>{const hh=h%12||12;return hh+':'+String(m).padStart(2,'0')+(h>=12?'pm':'am')}
  const exportUI=(
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <select value={leadMin} onChange={e=>{const v=Number(e.target.value);setLeadMin(v);saveLead(v)}} title="How early the alarm fires"
        style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,fontSize:11,padding:'8px',outline:'none'}}>
        <option value={0}>at start</option>
        <option value={5}>5 min before</option>
        <option value={10}>10 min before</option>
        <option value={15}>15 min before</option>
        <option value={30}>30 min before</option>
      </select>
      <button onClick={exportICS} title="Download .ics — add it to Apple/Google Calendar and your phone will alarm you"
        style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,fontWeight:600,padding:'9px 14px',borderRadius:6,cursor:'pointer',border:`1px solid ${C.amber}`,background:'transparent',color:C.amber,transition:'all 0.15s',whiteSpace:'nowrap'}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.amber;e.currentTarget.style.color=theme==='light'?'#fff':'#1a140d'}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.amber}}>
        ⤓ Sync to phone
      </button>
    </div>
  )

  // ── mobile: one day at a time ──────────────────────────────────────────────
  if(isMobile){
    const d=weekDates[selDay]
    const ds=d.toISOString().slice(0,10)
    const dayEvs=events.filter(ev=>shouldShow(ev,ds)).sort((a,b)=>(a.allDay?-1:1)-(b.allDay?-1:1)||((a.startH||0)+(a.startM||0)/60)-((b.startH||0)+(b.startM||0)/60))
    return(
      <div style={{animation:'fadeUp 0.3s ease'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:22,fontWeight:600}}>{d.toLocaleDateString('en-US',{month:'long'})}</div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setWeekOffset(o=>o-1)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,width:38,height:38,fontSize:17,cursor:'pointer'}}>‹</button>
            <button onClick={()=>{setWeekOffset(0);setSelDay(new Date().getDay())}} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:11,padding:'0 12px',cursor:'pointer'}}>today</button>
            <button onClick={()=>setWeekOffset(o=>o+1)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,width:38,height:38,fontSize:17,cursor:'pointer'}}>›</button>
          </div>
        </div>

        <div style={{display:'flex',gap:5,marginBottom:14}}>
          {weekDates.map((wd,i)=>{
            const sel=i===selDay, isT=wd.toISOString().slice(0,10)===todayStr
            return(
              <button key={i} onClick={()=>setSelDay(i)} style={{flex:1,padding:'8px 0',borderRadius:10,cursor:'pointer',border:`1px solid ${sel?C.blue:C.border}`,background:sel?C.blueDim:'transparent',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:sel?C.blue:C.muted,letterSpacing:'0.04em'}}>{DAYS_SHORT[wd.getDay()].slice(0,1)}</span>
                <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:600,color:sel?C.blue:isT?C.amber:C.text}}>{wd.getDate()}</span>
              </button>
            )
          })}
        </div>

        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <button onClick={()=>setModal({type:'new',slot:{dow:d.getDay(),hour:9}})} style={{flex:1,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:13,fontWeight:600,padding:'11px',borderRadius:8,cursor:'pointer',border:`1px solid ${C.blue}`,background:C.blueDim,color:C.blue}}>+ Add a block</button>
        </div>
        <div style={{marginBottom:16}}>{exportUI}</div>

        {dayEvs.length===0?(
          <Panel style={{padding:'30px 18px',textAlign:'center'}}>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:13,color:C.muted}}>Nothing planned for {DAYS_FULL[d.getDay()]}.</div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,color:C.dim,marginTop:5}}>A blank day is allowed too.</div>
          </Panel>
        ):dayEvs.map(ev=>{
          const ec=getEvColor(ev.color)
          return(
            <div key={ev.id} onClick={()=>setModal({type:'edit',event:ev})}
              style={{display:'flex',gap:12,alignItems:'stretch',background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8,cursor:'pointer',boxShadow:'var(--card-shadow)'}}>
              <div style={{width:4,borderRadius:3,background:ec.border,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:600,color:C.text}}>{ev.title}</div>
                {ev.desc&&<div style={{fontSize:12,color:C.muted,marginTop:2}}>{ev.desc}</div>}
              </div>
              <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,color:C.muted,textAlign:'right',whiteSpace:'nowrap'}}>
                {ev.allDay?'all day':<>{t12(ev.startH,ev.startM)}<br/><span style={{color:C.dim}}>{t12(ev.endH,ev.endM)}</span></>}
              </div>
            </div>
          )
        })}

        {modal&&(<EventModal event={modal.type==='edit'?modal.event:null} slot={modal.slot} onSave={saveEv} onDelete={deleteEv} onClose={()=>setModal(null)}/>)}
      </div>
    )
  }

  return(
    <div style={{animation:'fadeUp 0.3s ease',display:'flex',flexDirection:'column',height:'calc(100vh - 60px)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexShrink:0,flexWrap:'wrap',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:4}}>
            <button onClick={()=>setWeekOffset(o=>o-1)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:3,color:C.muted,width:28,height:28,cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.border2}} onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}>‹</button>
            <button onClick={()=>setWeekOffset(0)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:3,color:C.muted,fontSize:9,padding:'0 10px',cursor:'pointer',fontFamily:"'Fraunces',Georgia,serif",letterSpacing:'0.1em',transition:'all 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.color=C.blue;e.currentTarget.style.borderColor=C.border2}} onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}>TODAY</button>
            <button onClick={()=>setWeekOffset(o=>o+1)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:3,color:C.muted,width:28,height:28,cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s'}} onMouseEnter={e=>{e.currentTarget.style.color=C.text;e.currentTarget.style.borderColor=C.border2}} onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border}}>›</button>
          </div>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:16,fontWeight:700,color:C.text,letterSpacing:'0.04em'}}>
            {weekDates[0].toLocaleDateString('en-US',{month:'long',year:'numeric'})}
          </div>
          <LiveClock/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {exportUI}
          <button onClick={()=>setModal({type:'new',slot:{dow:new Date().getDay(),hour:9}})}
            style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,fontWeight:600,letterSpacing:'0.02em',padding:'9px 16px',borderRadius:6,cursor:'pointer',border:`1px solid ${C.blue}`,background:C.blueDim,color:C.blue,transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.blue;e.currentTarget.style.color=theme==='light'?'#fff':'#1a140d'}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.blueDim;e.currentTarget.style.color=C.blue}}>
            + New block
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'52px repeat(7,1fr)',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{borderRight:`1px solid ${C.border}`}}/>
        {weekDates.map((d,i)=>{
          const ds=d.toISOString().slice(0,10)
          const isToday=ds===todayStr
          const dayAllDay=allDayEvents.filter(ev=>shouldShow(ev,ds))
          return(
            <div key={i} style={{padding:'8px 0 0',borderRight:`1px solid ${C.border}`,textAlign:'center'}}>
              <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.muted,letterSpacing:'0.1em',marginBottom:3}}>{DAYS_SHORT[d.getDay()]}</div>
              <div style={{width:30,height:30,borderRadius:'50%',background:isToday?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 4px',boxShadow:isToday?`0 0 14px ${C.blueGlow}`:'none'}}>
                <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:12,fontWeight:700,color:isToday?'#fff':C.text}}>{d.getDate()}</span>
              </div>
              {dayAllDay.map(ev=>{
                const ec=getEvColor(ev.color)
                return(
                  <div key={ev.id} onClick={()=>setModal({type:'edit',event:ev})}
                    style={{fontSize:10,background:ec.bg,color:ec.text,borderRadius:2,padding:'2px 6px',margin:'0 2px 2px',cursor:'pointer',textAlign:'left',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',fontWeight:500}}>
                    {ev.title}
                  </div>
                )
              })}
              <div style={{height:6}}/>
            </div>
          )
        })}
      </div>

      <div style={{flex:1,overflow:'auto',position:'relative'}} ref={gridRef}>
        <div style={{display:'grid',gridTemplateColumns:'52px repeat(7,1fr)',position:'relative',minHeight:HOUR_H*24}}>
          <div style={{position:'relative',borderRight:`1px solid ${C.border}`}}>
            {HOURS.map(h=>(
              <div key={h} style={{position:'absolute',top:h*HOUR_H,right:6,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim,letterSpacing:'0.05em',transform:'translateY(-6px)'}}>{h===0?'':fmt12(h)}</div>
            ))}
          </div>

          {weekDates.map((d,di)=>{
            const ds=d.toISOString().slice(0,10)
            const dow=d.getDay()
            const isToday=ds===todayStr
            const dayEvs=events.filter(ev=>!ev.allDay&&shouldShow(ev,ds))
            return(
              <div key={di} style={{position:'relative',borderRight:`1px solid ${C.border}`,background:isToday?'var(--blueDim)':'transparent'}}>
                {HOURS.map(h=>(
                  <div key={h}
                    style={{position:'absolute',top:h*HOUR_H,left:0,right:0,height:HOUR_H,borderTop:`1px solid ${C.border}`,cursor:'pointer'}}
                    onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}}
                    onDrop={e=>onDrop(e,dow,h)}
                    onClick={()=>setModal({type:'new',slot:{dow,hour:h}})}>
                    <div style={{position:'absolute',top:'50%',left:0,right:0,height:'1px',background:`${C.border}`,opacity:0.4}}/>
                  </div>
                ))}

                {dayEvs.map(ev=>{
                  const ec=getEvColor(ev.color)
                  const top=(ev.startH+ev.startM/60)*HOUR_H
                  const height=Math.max(((ev.endH+ev.endM/60)-(ev.startH+ev.startM/60))*HOUR_H,20)
                  const fmt=n=>String(n).padStart(2,'0')
                  const sh=ev.startH%12||12,sm=ev.startM,ampm=ev.startH>=12?'pm':'am'
                  return(
                    <div key={ev.id}
                      draggable
                      onDragStart={e=>onDragStart(e,ev)}
                      onClick={e=>{e.stopPropagation();setModal({type:'edit',event:ev})}}
                      style={{position:'absolute',top:top+1,left:2,right:2,height:height-2,background:ec.bg,borderLeft:`3px solid ${ec.border}`,borderRadius:3,padding:'3px 6px',cursor:'grab',zIndex:10,overflow:'hidden',boxShadow:`0 2px 8px rgba(0,0,0,0.3)`,transition:'box-shadow 0.15s',userSelect:'none'}}>
                      <div style={{fontSize:11,fontWeight:600,color:ec.text,lineHeight:1.3,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{ev.title}</div>
                      {height>28&&<div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:ec.text,opacity:0.8,marginTop:1}}>{sh}:{fmt(sm)}{ampm}</div>}
                      {height>44&&ev.desc&&<div style={{fontSize:10,color:ec.text,opacity:0.75,marginTop:2,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{ev.desc}</div>}
                      <div onMouseDown={e=>startResize(e,ev)} title="Drag to resize"
                        style={{position:'absolute',left:0,right:0,bottom:0,height:8,cursor:'ns-resize',display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:1}}>
                        <div style={{width:22,height:2,borderRadius:2,background:ec.text,opacity:0.55}}/>
                      </div>
                    </div>
                  )
                })}

                {isToday&&(
                  <div style={{position:'absolute',left:0,right:0,top:nowPx,zIndex:20,pointerEvents:'none'}}>
                    <div style={{height:2,background:C.red,boxShadow:`0 0 6px rgba(248,113,113,0.6)`,position:'relative'}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:C.red,position:'absolute',left:-4,top:-3,boxShadow:`0 0 8px rgba(248,113,113,0.8)`}}/>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {modal&&(
        <EventModal event={modal.type==='edit'?modal.event:null} slot={modal.slot}
          onSave={saveEv} onDelete={deleteEv} onClose={()=>setModal(null)}/>
      )}
    </div>
  )
}

// ── TODAY: schedule row (extracted so hooks are legal) ──────────────────────────
function TodayRow({ev,isDone,onToggle}){
  const [hover,setHover]=useState(false)
  const [flash,setFlash]=useState(false)
  const ec=getEvColor(ev.color)
  const fmt12=(h,m)=>{const hh=h%12||12,ampm=h>=12?'PM':'AM';return`${hh}:${String(m).padStart(2,'0')} ${ampm}`}
  const click=()=>{setFlash(true);setTimeout(()=>setFlash(false),200);onToggle()}
  return(
    <div onClick={click} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderRadius:3,marginBottom:4,cursor:'pointer',userSelect:'none',
        border:isDone?`1px solid ${C.border2}`:hover?`1px solid ${C.border2}`:`1px solid ${C.border}`,
        background:flash?'var(--blueDim)':isDone?'var(--blueDim)':hover?C.surface2:'transparent',
        transform:flash?'scale(0.989)':hover?'translateX(3px)':'translateX(0)',
        transition:'all 0.18s ease',position:'relative',overflow:'hidden',
        boxShadow:isDone?`inset 3px 0 0 ${C.blue}`:hover?`inset 3px 0 0 var(--blueGlow)`:'none'}}>
      <div style={{width:3,height:'100%',position:'absolute',left:0,top:0,background:ec.bg,opacity:0.7}}/>
      <div style={{width:18,height:18,borderRadius:2,flexShrink:0,border:isDone?'none':`1px solid ${C.dim}`,background:isDone?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s',boxShadow:isDone?`0 0 12px ${C.blueGlow}`:'none',marginLeft:6}}>
        {isDone&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:500,color:isDone?C.muted:C.text,textDecoration:isDone?'line-through':'none',textDecorationColor:C.dim}}>{ev.title}</div>
        {ev.desc&&<div style={{fontSize:11,color:isDone?C.dim:C.muted,marginTop:1}}>{ev.desc}</div>}
      </div>
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim}}>{fmt12(ev.startH,ev.startM)}</div>
    </div>
  )
}

// ── TODAY: personal task row ────────────────────────────────────────────────────
function PersonalRow({task,onToggle,onDelete,onEdit}){
  const [hover,setHover]=useState(false)
  const [editing,setEditing]=useState(false)
  const [val,setVal]=useState(task.text)
  const done=task.done
  const commit=()=>{ const v=val.trim(); if(v)onEdit(v); else setVal(task.text); setEditing(false) }
  return(
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:3,marginBottom:4,
        border:`1px solid ${hover||done?C.border2:C.border}`,background:done?'var(--blueDim)':hover?C.surface2:'transparent',transition:'all 0.15s',position:'relative'}}>
      <div onClick={()=>onToggle()} style={{width:18,height:18,borderRadius:2,flexShrink:0,cursor:'pointer',border:done?'none':`1px solid ${C.dim}`,background:done?C.amber:'transparent',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:done?`0 0 12px ${C.amberGlow}`:'none'}}>
        {done&&<span style={{color:'#000',fontSize:11,fontWeight:700}}>✓</span>}
      </div>
      {editing?(
        <input value={val} autoFocus onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(task.text);setEditing(false)}}}
          style={{flex:1,background:C.surface3,border:`1px solid ${C.border2}`,borderRadius:3,padding:'5px 8px',color:C.text,fontSize:14,outline:'none'}}/>
      ):(
        <div onDoubleClick={()=>{setVal(task.text);setEditing(true)}} style={{flex:1,fontSize:14,color:done?C.muted:C.text,textDecoration:done?'line-through':'none',textDecorationColor:C.dim,cursor:'text'}}>{task.text}</div>
      )}
      {hover&&!editing&&(
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>{setVal(task.text);setEditing(true)}} title="Edit" style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:12}}>✎</button>
          <button onClick={()=>onDelete()} title="Delete" style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:14}} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>×</button>
        </div>
      )}
    </div>
  )
}

// ── TODAY VIEW ──────────────────────────────────────────────────────────────────
function TodayView({data,setData,events,study,setStudy,setView}){
  const today=new Date()
  const todayStr=todayKey()
  const dow=today.getDay()
  const dd=data[todayStr]||{done:{},notes:'',personal:[]}
  const [newTask,setNewTask]=useState('')
  const recallDueList=((study&&study.notes)||[]).filter(n=>!n.inbox&&recallDue(n))

  const todayEvs=events.filter(ev=>!ev.allDay&&(ev.repeat==='daily'||(ev.repeat==='weekly'&&ev.dayOfWeek===dow)||(ev.repeat==='weekdays'&&dow>=1&&dow<=5)||(ev.repeat==='none'&&ev.dayOfWeek===dow)))
    .sort((a,b)=>(a.startH+a.startM/60)-(b.startH+b.startM/60))

  const done=todayEvs.filter(ev=>dd.done?.[ev.id]).length
  const total=todayEvs.length
  const pct=total?Math.round((done/total)*100):0
  const ok=pct===100&&total>0

  const update=patch=>{ const next={...data,[todayStr]:{...dd,...patch}}; setData(next); saveData(next) }
  const toggle=id=>update({done:{...dd.done,[id]:!dd.done?.[id]}})

  const personal=dd.personal||[]
  const pDone=personal.filter(t=>t.done).length
  const addTask=()=>{ const v=newTask.trim(); if(!v)return; update({personal:[...personal,{id:'p_'+Date.now(),text:v,done:false}]}); setNewTask('') }
  const togTask=id=>update({personal:personal.map(t=>t.id===id?{...t,done:!t.done}:t)})
  const delTask=id=>update({personal:personal.filter(t=>t.id!==id)})
  const editTask=(id,text)=>update({personal:personal.map(t=>t.id===id?{...t,text}:t)})

  return(
    <div style={{animation:'fadeUp 0.3s ease',maxWidth:760}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
        <Ember size={24} color={C.blue} glow/>
        <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:18,fontWeight:700,letterSpacing:'0.05em'}}>
          {today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
        </div>
        <LiveClock/>
      </div>

      <DailyQuote style={{margin:'16px 0 6px'}}/>

      {recallDueList.length>0&&(
        <div style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:10,padding:'14px 16px',margin:'14px 0',boxShadow:'var(--card-shadow)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
            <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:600,color:C.text}}>🧠 {recallDueList.length} thing{recallDueList.length!==1?'s':''} to recall today</span>
            <button onClick={()=>setView&&setView('study')} style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,fontWeight:600,padding:'6px 12px',borderRadius:7,cursor:'pointer',border:`1px solid ${C.blue}`,background:C.blueDim,color:C.blue}}>Open Study →</button>
          </div>
          {recallDueList.slice(0,4).map(n=>(
            <div key={n.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${C.border}`}}>
              <span style={{flex:1,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12.5,color:C.muted}}>Can you still explain <span style={{color:C.text}}>{n.title}</span>?</span>
              <button onClick={()=>setStudy&&setStudy(s=>({...s,notes:s.notes.map(x=>x.id===n.id?{...x,recallStage:Math.min((x.recallStage||0)+1,RECALL_STEPS.length-1),recallDueAt:recallAfter(Math.min((x.recallStage||0)+1,RECALL_STEPS.length-1)),lastReviewed:Date.now()}:x)}))} style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,fontWeight:600,padding:'5px 10px',borderRadius:6,cursor:'pointer',border:`1px solid ${C.green}`,background:'transparent',color:C.green}}>✓ got it</button>
            </div>
          ))}
        </div>
      )}

      {/* ── SCHEDULE (locked) ── */}
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,margin:'14px 0 12px',letterSpacing:'0.1em',display:'flex',alignItems:'center',gap:8}}>
        <span style={{color:C.blue}}>The plan</span><span>— what today is meant to be</span>
      </div>

      {total>0&&(
        <div style={{background:C.surface,border:`1px solid ${ok?C.border2:C.border}`,borderRadius:4,padding:'14px 18px',marginBottom:16,position:'relative',boxShadow:ok?`0 0 24px var(--blueDim)`:'none'}}>
          <Corners color={ok?C.blue:C.dim} opacity={ok?0.8:0.2}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:8,color:C.muted,letterSpacing:'0.2em'}}>TODAY SO FAR</span>
            <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,fontWeight:700,color:ok?C.green:C.blue}}>{done}/{total} · {pct}% {ok?'✓ COMPLETE':'IN PROGRESS'}</span>
          </div>
          <div style={{height:5,background:C.surface3,borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:ok?`linear-gradient(90deg,${C.green},#6ee7b7)`:`linear-gradient(90deg,${C.blue},${C.blueBright})`,borderRadius:3,transition:'width 0.6s ease',boxShadow:pct>0?ok?`0 0 12px ${C.greenGlow}`:`0 0 12px ${C.blueGlow}`:'none'}}/>
          </div>
        </div>
      )}

      {todayEvs.length===0?(
        <Panel style={{padding:'34px 24px',textAlign:'center',marginBottom:8}}>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim,letterSpacing:'0.1em'}}>NOTHING PLANNED TODAY</div>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.dim,marginTop:5}}>ADD SOMETHING IN CALENDAR FOR {DAYS_FULL[dow].toUpperCase()}</div>
        </Panel>
      ):(
        todayEvs.map(ev=><TodayRow key={ev.id} ev={ev} isDone={!!dd.done?.[ev.id]} onToggle={()=>toggle(ev.id)}/>)
      )}

      {/* ── MY TODAY (personal, editable) ── */}
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,margin:'26px 0 12px',letterSpacing:'0.1em',display:'flex',alignItems:'center',gap:8}}>
        <span style={{color:C.amber}}>My own list</span><span>— things I actually want to get done</span>
        {personal.length>0&&<span style={{marginLeft:'auto',color:C.dim}}>{pDone}/{personal.length}</span>}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:10}}>
        <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addTask()}}
          placeholder="What do you need to get done today?"
          style={{flex:1,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'10px 12px',color:C.text,fontSize:14,outline:'none',transition:'border 0.15s'}}
          onFocus={e=>e.target.style.borderColor=C.border2} onBlur={e=>e.target.style.borderColor=C.border}/>
        <button onClick={addTask} style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,letterSpacing:'0.1em',padding:'0 16px',borderRadius:3,cursor:'pointer',border:`1px solid ${C.amber}`,background:'rgba(245,158,11,0.1)',color:C.amber,transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.background=C.amber;e.currentTarget.style.color='#000'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(245,158,11,0.1)';e.currentTarget.style.color=C.amber}}>ADD</button>
      </div>

      {personal.length===0?(
        <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.dim,letterSpacing:'0.1em',padding:'4px 2px 8px'}}>NOTHING ADDED YET — DOUBLE-CLICK ANY TASK TO EDIT IT.</div>
      ):(
        personal.map(t=><PersonalRow key={t.id} task={t} onToggle={()=>togTask(t.id)} onDelete={()=>delTask(t.id)} onEdit={text=>editTask(t.id,text)}/>)
      )}

      {/* ── A note to myself ── */}
      <div style={{marginTop:24}}>
        <div style={{display:'flex',alignItems:'center',gap:8,margin:'0 0 8px'}}>
          <div style={{width:3,height:14,background:`linear-gradient(180deg,${C.blue},transparent)`,borderRadius:2}}/>
          <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:8,letterSpacing:'0.2em',color:C.muted}}>A note to myself</span>
        </div>
        <Panel style={{overflow:'hidden'}}>
          <textarea value={dd.notes||''} onChange={e=>update({notes:e.target.value})}
            placeholder="Log a win. Or just be honest about the day. Either counts."
            style={{width:'100%',background:'transparent',border:'none',padding:'12px 16px',color:C.text,fontSize:14,lineHeight:1.7,resize:'none',minHeight:80,outline:'none'}}/>
        </Panel>
      </div>

      <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
        <button onClick={()=>update({done:{}})}
          style={{background:'none',border:'none',fontSize:9,color:C.dim,cursor:'pointer',fontFamily:"'Inter',-apple-system,system-ui,sans-serif",letterSpacing:'0.1em',transition:'color 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=C.muted} onMouseLeave={e=>e.currentTarget.style.color=C.dim}>↺ reset today's checks</button>
      </div>
    </div>
  )
}

// ── INTEL REPORT ──────────────────────────────────────────────────────────────
function IntelView({data}){
  const todayK=todayKey()
  const cells=[]
  const start=new Date();start.setDate(start.getDate()-83)
  for(let p=0;p<start.getDay();p++) cells.push(null)
  let completeDays=0,totalTracked=0
  for(let i=0;i<84;i++){
    const d=new Date(start);d.setDate(start.getDate()+i)
    const k=d.toISOString().slice(0,10)
    const dd=data[k];let type='empty',label=''
    if(dd&&Object.keys(dd.done||{}).length>0){
      totalTracked++
      const vals=Object.values(dd.done)
      const dn=vals.filter(Boolean).length,tot=vals.length
      const pct=tot?dn/tot:0
      if(pct>=1){type='full';completeDays++;label='✓'}else if(pct>0){type='partial';label=`${Math.round(pct*100)}`}
    }
    cells.push({k,type,label,isToday:k===todayK})
  }
  const rate=totalTracked?Math.round((completeDays/totalTracked)*100):0
  return(
    <div style={{animation:'fadeUp 0.3s ease',maxWidth:560}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}><Ember size={24} color={C.blue} glow/><div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:18,fontWeight:700,letterSpacing:'0.05em'}}>Looking Back</div></div>
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,marginBottom:20,letterSpacing:'0.1em'}}>THE LAST 12 WEEKS — DID I SHOW UP?</div>
      <Panel style={{padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:4}}>
          {DAYS_SHORT.map(d=><div key={d} style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:7,color:C.dim,textAlign:'center',paddingBottom:3,letterSpacing:'0.06em'}}>{d}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
          {cells.map((c,i)=>(
            <div key={i} style={{aspectRatio:'1',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontWeight:700,
              background:!c?'transparent':c.type==='full'?C.blue:c.type==='partial'?C.blueDim:C.surface2,
              border:!c?'none':c.isToday?`1px solid ${C.amber}`:c.type==='full'?`1px solid ${C.blue}`:c.type==='partial'?`1px solid ${C.border2}`:`1px solid ${C.border}`,
              color:c?.type==='full'?'#fff':c?.type==='partial'?C.blue:C.dim,
              boxShadow:c?.type==='full'?`0 0 6px ${C.blueGlow}`:c?.isToday?`0 0 4px rgba(245,158,11,0.4)`:'none'}}>{c?.label}</div>
          ))}
        </div>
      </Panel>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
        {[{val:completeDays,label:'Clean days',glow:completeDays>0},{val:totalTracked,label:'Days shown up'},{val:`${rate}%`,label:'Follow-through',glow:rate>=80}].map(({val,label,glow})=>(
          <Panel key={label} glow={glow} style={{padding:'14px 16px'}}>
            <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:26,fontWeight:700,color:glow?C.blue:C.text,lineHeight:1,textShadow:glow?`0 0 20px ${C.blue}`:'none',animation:'countUp 0.5s ease'}}>{val}</div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.muted,marginTop:7,textTransform:'uppercase',letterSpacing:'0.12em'}}>{label}</div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// VISION BOARD — freeform canvas + goal tracking + extras
// ════════════════════════════════════════════════════════════════════════════════
const CAT_COLORS=['#dca15f','#34d399','#f59e0b','#f87171','#a78bfa','#22d3ee','#ec4899','#84cc16']
const DEFAULT_VISION={
  items:[],
  categories:[
    {id:'career',name:'Career',color:'#dca15f'},
    {id:'fitness',name:'Fitness',color:'#34d399'},
    {id:'relationships',name:'Relationships',color:'#ec4899'},
    {id:'travel',name:'Travel',color:'#22d3ee'},
    {id:'finance',name:'Finance',color:'#f59e0b'},
  ],
  focus:['','',''],
  wheel:{Career:5,Health:5,Money:5,Family:5,Relationships:5,Learning:5},
  journal:[],
  parking:[],
}
const TEXT_KINDS=[
  {id:'goal',label:'Goal',color:'#dca15f'},
  {id:'quote',label:'Quote',color:'#a78bfa'},
  {id:'affirmation',label:'Affirmation',color:'#34d399'},
  {id:'deadline',label:'Deadline',color:'#f87171'},
]
const uid=p=>p+'_'+Date.now()+'_'+Math.round(Math.random()*1e4)

// ── canvas item editor modal ────────────────────────────────────────────────────
function ItemEditor({item,categories,onSave,onDelete,onClose}){
  const [d,setD]=useState({...item})
  const set=(k,v)=>setD(p=>({...p,[k]:v}))
  const isGoal=d.kind==='goal', isText=d.kind==='text', isImage=d.kind==='image'
  const pct=isGoal?Math.min(100,Math.round(((Number(d.current)||0)/(Number(d.target)||1))*100)):0
  const fld={background:C.surface2,border:`1px solid ${C.border}`,borderRadius:3,padding:'8px 10px',color:C.text,fontSize:13,outline:'none',width:'100%'}
  const lbl={fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.1em',marginBottom:5,display:'block'}
  return(
    <div className="modal-wrap" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(10,7,4,0.78)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-card" style={{width:440,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto',background:C.surface,border:`1px solid ${C.border2}`,borderRadius:10,position:'relative',boxShadow:'var(--card-shadow-sel)',animation:'modalIn 0.2s ease'}}>
        <Corners color={C.blue}/>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`,fontFamily:"'Fraunces',Georgia,serif",fontSize:11,color:C.blue,letterSpacing:'0.2em'}}>EDIT {d.kind.toUpperCase()}</div>
        <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
          {isText&&(<>
            <div>
              <span style={lbl}>TYPE</span>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {TEXT_KINDS.map(t=>(
                  <button key={t.id} onClick={()=>set('textKind',t.id)} style={{flex:1,minWidth:70,padding:'6px 0',borderRadius:3,fontSize:10,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",cursor:'pointer',border:`1px solid ${d.textKind===t.id?t.color:C.border}`,background:d.textKind===t.id?t.color+'22':'transparent',color:d.textKind===t.id?t.color:C.muted}}>{t.label}</button>
                ))}
              </div>
            </div>
            <div><span style={lbl}>TEXT</span><textarea value={d.text||''} onChange={e=>set('text',e.target.value)} rows={3} style={{...fld,resize:'vertical'}} placeholder="Become a Data Engineer by 2028"/></div>
          </>)}
          {isImage&&(<>
            <div><span style={lbl}>IMAGE URL</span><input value={d.src||''} onChange={e=>set('src',e.target.value)} style={fld} placeholder="https://..."/></div>
            {d.src&&<img src={d.src} alt="" style={{width:'100%',maxHeight:140,objectFit:'cover',borderRadius:4,border:`1px solid ${C.border}`}}/>}
          </>)}
          {isGoal&&(<>
            <div><span style={lbl}>GOAL</span><input value={d.title||''} onChange={e=>set('title',e.target.value)} style={fld} placeholder="Save $10,000"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <div><span style={lbl}>CURRENT</span><input type="number" value={d.current??''} onChange={e=>set('current',e.target.value)} style={fld} placeholder="1200"/></div>
              <div><span style={lbl}>TARGET</span><input type="number" value={d.target??''} onChange={e=>set('target',e.target.value)} style={fld} placeholder="10000"/></div>
              <div><span style={lbl}>UNIT</span><input value={d.unit||''} onChange={e=>set('unit',e.target.value)} style={fld} placeholder="$ / lbs"/></div>
            </div>
            <div style={{height:6,background:C.surface3,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${C.blue},${C.blueBright})`,borderRadius:3}}/></div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,textAlign:'right',marginTop:-6}}>{pct}% complete</div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:C.muted,cursor:'pointer'}}>
              <input type="checkbox" checked={!!d.done} onChange={e=>set('done',e.target.checked)} style={{width:14,height:14,accentColor:C.green}}/>
              Mark achieved (moves to Achievement Wall)
            </label>
            <div><span style={lbl}>LINKED HABITS (one per line)</span><textarea value={(d.habits||[]).join('\n')} onChange={e=>set('habits',e.target.value.split('\n').filter(Boolean))} rows={2} style={{...fld,resize:'vertical'}} placeholder={"30 min/day\nComplete lesson"}/></div>
          </>)}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>
              <span style={lbl}>CATEGORY</span>
              <select value={d.category||''} onChange={e=>set('category',e.target.value)} style={{...fld,padding:'8px'}}>
                <option value="">— none —</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><span style={lbl}>TARGET DATE</span><input type="date" value={d.targetDate||''} onChange={e=>set('targetDate',e.target.value)} style={{...fld,padding:'7px 10px'}}/></div>
          </div>
          <div><span style={lbl}>WHY THIS MATTERS (note)</span><textarea value={d.note||''} onChange={e=>set('note',e.target.value)} rows={2} style={{...fld,resize:'vertical'}} placeholder="Symbolizes financial freedom, not the car itself."/></div>
        </div>
        <div style={{padding:'14px 20px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between'}}>
          <button onClick={()=>onDelete(d.id)} style={{background:'none',border:`1px solid rgba(248,113,113,0.3)`,borderRadius:3,color:C.red,fontSize:12,padding:'7px 14px',cursor:'pointer'}}>Delete</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:3,color:C.muted,fontSize:12,padding:'7px 16px',cursor:'pointer'}}>Cancel</button>
            <button onClick={()=>onSave(d)} style={{background:C.blueDim,border:`1px solid ${C.blue}`,borderRadius:3,color:C.blue,fontFamily:"'Fraunces',Georgia,serif",fontSize:10,letterSpacing:'0.08em',fontWeight:600,padding:'7px 20px',cursor:'pointer'}}>SAVE</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── single canvas item with move / resize / rotate ──────────────────────────────
function CanvasItem({item,cat,selected,onSelect,onChange,onEdit,onToggleDone}){
  const ref=useRef(null)
  const drag=useRef(null)
  const accent=cat?cat.color:'#dca15f'

  const onDown=(e,mode)=>{
    if(e.button!==0)return
    e.stopPropagation()
    onSelect()
    const rect=ref.current.parentElement.getBoundingClientRect()
    drag.current={mode,sx:e.clientX,sy:e.clientY,ox:item.x,oy:item.y,ow:item.w,oh:item.h,orot:item.rot||0,
      cx:rect.left+item.x+item.w/2, cy:rect.top+item.y+item.h/2}
  }
  useEffect(()=>{
    const move=e=>{
      const g=drag.current; if(!g)return
      if(g.mode==='move') onChange({x:Math.max(0,g.ox+(e.clientX-g.sx)),y:Math.max(0,g.oy+(e.clientY-g.sy))})
      else if(g.mode==='resize') onChange({w:Math.max(70,g.ow+(e.clientX-g.sx)),h:Math.max(50,g.oh+(e.clientY-g.sy))})
      else if(g.mode==='rotate'){ const a=Math.atan2(e.clientY-g.cy,e.clientX-g.cx)*180/Math.PI; onChange({rot:Math.round(a+90)}) }
    }
    const up=()=>{drag.current=null}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
  },[onChange])

  const pct=item.kind==='goal'?Math.min(100,Math.round(((Number(item.current)||0)/(Number(item.target)||1))*100)):0
  const tk=item.kind==='text'?(TEXT_KINDS.find(t=>t.id===item.textKind)||TEXT_KINDS[0]):null
  const handle=(pos,mode,cur,inner)=>(
    <div onMouseDown={e=>onDown(e,mode)} style={{position:'absolute',...pos,width:16,height:16,borderRadius:'50%',background:C.surface,border:`2px solid ${accent}`,cursor:cur,zIndex:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:accent}}>{inner}</div>
  )

  return(
    <div ref={ref}
      style={{position:'absolute',left:0,top:0,width:item.w,height:item.h,transform:`translate(${item.x}px,${item.y}px) rotate(${item.rot||0}deg)`,
        zIndex:item.z||1,cursor:'move',userSelect:'none',transition:drag.current?'none':'box-shadow 0.15s'}}
      onMouseDown={e=>onDown(e,'move')} onDoubleClick={e=>{e.stopPropagation();onEdit()}}>
      <div style={{width:'100%',height:'100%',borderRadius:6,overflow:'hidden',position:'relative',
        border:`1.5px solid ${selected?accent:'var(--item-border)'}`,boxShadow:selected?`0 0 0 1px ${accent}, var(--card-shadow-sel)`:'var(--card-shadow)',
        background:item.kind==='image'?'#000':C.surface}}>

        {item.kind==='image'&&(item.src
          ? <img src={item.src} alt="" draggable={false} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:C.dim,fontSize:11,fontFamily:"'Inter',-apple-system,system-ui,sans-serif"}}>NO IMAGE</div>)}

        {item.kind==='text'&&(
          <div style={{width:'100%',height:'100%',padding:'12px 14px',display:'flex',flexDirection:'column',justifyContent:'center',gap:6,borderLeft:`3px solid ${tk.color}`}}>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,letterSpacing:'0.15em',color:tk.color}}>{tk.label.toUpperCase()}</div>
            <div style={{fontSize:16,fontWeight:600,color:C.text,lineHeight:1.3,fontFamily:item.textKind==='quote'?'Inter':'Inter',fontStyle:item.textKind==='quote'?'italic':'normal'}}>{item.text||'Double-click to edit'}</div>
          </div>
        )}

        {item.kind==='goal'&&(
          <div style={{width:'100%',height:'100%',padding:'12px 14px',display:'flex',flexDirection:'column',gap:6,borderLeft:`3px solid ${accent}`}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,letterSpacing:'0.15em',color:accent}}>GOAL</span>
              {item.done&&<span style={{fontSize:8,color:C.green,fontFamily:"'Inter',-apple-system,system-ui,sans-serif"}}>✓ ACHIEVED</span>}
            </div>
            <div style={{fontSize:15,fontWeight:600,color:C.text,lineHeight:1.25}}>{item.title||'Untitled goal'}</div>
            <div style={{marginTop:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:C.muted,marginBottom:4,fontFamily:"'Inter',-apple-system,system-ui,sans-serif"}}>
                <span>{item.unit||''}{item.current||0} / {item.unit||''}{item.target||0}</span><span style={{color:accent}}>{pct}%</span>
              </div>
              <div style={{height:5,background:C.surface3,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:item.done?C.green:`linear-gradient(90deg,${accent},${accent})`,borderRadius:3}}/></div>
            </div>
          </div>
        )}

        {item.targetDate&&(
          <div style={{position:'absolute',bottom:4,right:6,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:item.kind==='image'?'#fff':C.muted,background:item.kind==='image'?'rgba(0,0,0,0.5)':'transparent',padding:item.kind==='image'?'1px 5px':0,borderRadius:3}}>
            ⌚ {new Date(item.targetDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}
          </div>
        )}
        {item.note&&item.kind==='image'&&(
          <div style={{position:'absolute',left:0,right:0,bottom:0,padding:'14px 8px 6px',background:'linear-gradient(transparent,rgba(0,0,0,0.8))',color:'#dfe6f2',fontSize:10,lineHeight:1.3}}>{item.note}</div>
        )}
      </div>

      {selected&&(<>
        {handle({right:-8,bottom:-8},'resize','nwse-resize','⤡')}
        {handle({left:'50%',top:-30,marginLeft:-8},'rotate','grab','↻')}
        <div style={{position:'absolute',left:'50%',top:-14,width:2,height:14,background:accent,marginLeft:-1}}/>
      </>)}
    </div>
  )
}

// ── the canvas tab ──────────────────────────────────────────────────────────────
function CanvasTab({vision,setV,theme}){
  const items=vision.items
  const [selected,setSelected]=useState(null)
  const [editing,setEditing]=useState(null)
  const [filter,setFilter]=useState('all')
  const [dropping,setDropping]=useState(false)
  const fileRef=useRef()
  const wrapRef=useRef()

  const maxZ=()=>items.reduce((m,i)=>Math.max(m,i.z||1),1)
  const update=(id,patch)=>setV({...vision,items:items.map(i=>i.id===id?{...i,...patch}:i)})
  const add=it=>{ const z=maxZ()+1; setV({...vision,items:[...items,{x:60+Math.random()*120,y:60+Math.random()*100,w:220,h:160,rot:0,z,category:filter!=='all'?filter:'',...it}]}); }
  const del=id=>{ setV({...vision,items:items.filter(i=>i.id!==id)}); setEditing(null); setSelected(null) }
  const select=id=>{ setSelected(id); update(id,{z:maxZ()+1}) }

  const addImageFiles=files=>Array.from(files).forEach(f=>{ if(!f.type.startsWith('image/'))return; const r=new FileReader(); r.onload=e=>add({id:uid('img'),kind:'image',src:e.target.result,w:240,h:180}); r.readAsDataURL(f) })
  const addImageURL=()=>{ const u=ask('Paste image URL:'); if(u)add({id:uid('img'),kind:'image',src:u.trim(),w:240,h:180}) }
  const addText=()=>add({id:uid('txt'),kind:'text',text:'',textKind:'goal',w:230,h:120})
  const addGoal=()=>add({id:uid('goal'),kind:'goal',title:'',current:0,target:100,unit:'',habits:[],w:240,h:140})

  const visible=items.filter(i=>filter==='all'?true:i.category===filter).filter(i=>!(i.kind==='goal'&&i.done))
  const catOf=id=>vision.categories.find(c=>c.id===id)

  const btn={fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:10,letterSpacing:'0.06em',padding:'8px 12px',borderRadius:3,cursor:'pointer',border:`1px solid ${C.border2}`,background:C.surface2,color:C.text,transition:'all 0.12s'}

  return(
    <div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10,alignItems:'center'}}>
        <button style={btn} onClick={()=>fileRef.current.click()}>🖼️ Upload</button>
        <button style={btn} onClick={addImageURL}>🔗 Image URL</button>
        <button style={btn} onClick={addText}>✍️ Text card</button>
        <button style={btn} onClick={addGoal}>🎯 Goal card</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>addImageFiles(e.target.files)}/>
        <div style={{flex:1}}/>
        <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.dim,letterSpacing:'0.1em'}}>DBL-CLICK EDIT · DRAG MOVE · ↻ ROTATE · ⤡ RESIZE</span>
      </div>

      {/* category filter chips */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        {[{id:'all',name:'All',color:C.muted},...vision.categories].map(c=>(
          <button key={c.id} onClick={()=>setFilter(c.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:20,fontSize:11,cursor:'pointer',border:`1px solid ${filter===c.id?c.color:C.border}`,background:filter===c.id?c.color+'22':'transparent',color:filter===c.id?c.color:C.muted}}>
            {c.id!=='all'&&<span style={{width:8,height:8,borderRadius:'50%',background:c.color}}/>}{c.name}
          </button>
        ))}
      </div>

      <div ref={wrapRef}
        onMouseDown={()=>setSelected(null)}
        onDragOver={e=>{e.preventDefault();setDropping(true)}}
        onDragLeave={()=>setDropping(false)}
        onDrop={e=>{e.preventDefault();setDropping(false); if(e.dataTransfer.files.length)addImageFiles(e.dataTransfer.files); else { const u=e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain'); if(u&&/^https?:/.test(u))add({id:uid('img'),kind:'image',src:u,w:240,h:180}) }}}
        style={{position:'relative',height:'62vh',minHeight:440,overflow:'auto',borderRadius:6,border:`1px solid ${dropping?C.blue:C.border}`,
          background:`var(--surface)`,backgroundImage:`radial-gradient(var(--canvas-dot) 1px, transparent 1px)`,backgroundSize:'22px 22px',boxShadow:dropping?`inset 0 0 40px ${C.blueGlow}`:'none'}}>
        <div style={{position:'relative',width:1600,height:1100}}>
          {visible.map(it=>(
            <CanvasItem key={it.id} item={it} cat={catOf(it.category)} selected={selected===it.id}
              onSelect={()=>select(it.id)} onChange={patch=>update(it.id,patch)} onEdit={()=>setEditing(it)}/>
          ))}
          {items.length===0&&(
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,pointerEvents:'none'}}>
              <div style={{opacity:0.15}}><Ember size={48} color={C.blue}/></div>
              <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:10,color:C.dim,letterSpacing:'0.12em'}}>EMPTY CANVAS — ADD AN IMAGE, GOAL, OR TEXT CARD ABOVE</div>
              <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.dim}}>OR DRAG &amp; DROP IMAGES ANYWHERE HERE</div>
            </div>
          )}
        </div>
      </div>

      {editing&&<ItemEditor item={editing} categories={vision.categories} onSave={d=>{update(d.id,d);setEditing(null)}} onDelete={del} onClose={()=>setEditing(null)}/>}
    </div>
  )
}

// ── focus tab ────────────────────────────────────────────────────────────────────
function FocusTab({vision,setV}){
  const focus=vision.focus&&vision.focus.length===3?vision.focus:['','','']
  const set=(i,v)=>{const f=[...focus];f[i]=v;setV({...vision,focus:f})}
  return(
    <div style={{maxWidth:560}}>
      <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Pin your three priorities. The things that, if done, make today a win.</p>
      {focus.map((f,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:30,fontWeight:800,color:C.blue,width:40,textShadow:`0 0 16px ${C.blueGlow}`}}>{i+1}</div>
          <input value={f} onChange={e=>set(i,e.target.value)} placeholder={['Spanish','Gym','Power BI'][i]}
            style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:'14px 16px',color:C.text,fontSize:16,fontWeight:500,outline:'none',transition:'border 0.15s'}}
            onFocus={e=>e.target.style.borderColor=C.border2} onBlur={e=>e.target.style.borderColor=C.border}/>
        </div>
      ))}
    </div>
  )
}

// ── timeline tab ─────────────────────────────────────────────────────────────────
function TimelineTab({vision}){
  const dated=vision.items.filter(i=>i.targetDate).map(i=>({...i,year:new Date(i.targetDate+'T00:00:00').getFullYear()}))
  const years=[...new Set(dated.map(i=>i.year))].sort((a,b)=>a-b)
  const label=i=>i.title||i.text||(i.kind==='image'?'Image goal':'Goal')
  return(
    <div style={{maxWidth:620}}>
      <p style={{color:C.muted,fontSize:13,marginBottom:20}}>Your goals laid out by target year. Set a target date on any card to place it here.</p>
      {years.length===0?(
        <Panel style={{padding:'30px',textAlign:'center'}}><div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim,letterSpacing:'0.1em'}}>NO DATED GOALS YET</div></Panel>
      ):years.map(y=>(
        <div key={y} style={{display:'flex',gap:16,marginBottom:8}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:22,fontWeight:800,color:C.blue,minWidth:64,paddingTop:10}}>{y}</div>
          <div style={{flex:1,borderLeft:`2px solid ${C.border2}`,paddingLeft:16,paddingBottom:14}}>
            {dated.filter(i=>i.year===y).sort((a,b)=>a.targetDate.localeCompare(b.targetDate)).map(i=>{
              const cat=vision.categories.find(c=>c.id===i.category)
              return(
                <div key={i.id} style={{position:'relative',marginBottom:8,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:'10px 14px'}}>
                  <div style={{position:'absolute',left:-23,top:16,width:9,height:9,borderRadius:'50%',background:cat?cat.color:C.blue,boxShadow:`0 0 8px ${cat?cat.color:C.blue}`}}/>
                  <div style={{fontSize:14,fontWeight:500,color:i.done?C.muted:C.text,textDecoration:i.done?'line-through':'none'}}>{label(i)}</div>
                  <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,marginTop:2}}>{new Date(i.targetDate+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric'})}{cat?`  ·  ${cat.name}`:''}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── life wheel tab ───────────────────────────────────────────────────────────────
function WheelTab({vision,setV}){
  const keys=Object.keys(vision.wheel||DEFAULT_VISION.wheel)
  const wheel=vision.wheel||DEFAULT_VISION.wheel
  const set=(k,v)=>setV({...vision,wheel:{...wheel,[k]:v}})
  const R=120,cx=150,cy=150,n=keys.length
  const pt=(i,val)=>{const a=(Math.PI*2*i)/n-Math.PI/2;const r=(val/10)*R;return[cx+r*Math.cos(a),cy+r*Math.sin(a)]}
  const poly=keys.map((k,i)=>pt(i,wheel[k]).join(',')).join(' ')
  return(
    <div style={{display:'flex',gap:30,flexWrap:'wrap',alignItems:'center'}}>
      <svg width="300" height="300" viewBox="0 0 300 300">
        {[2,4,6,8,10].map(ring=>(
          <polygon key={ring} points={keys.map((k,i)=>pt(i,ring).join(',')).join(' ')} fill="none" stroke="var(--border)" strokeWidth="1"/>
        ))}
        {keys.map((k,i)=>{const[x,y]=pt(i,10);return<line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1"/>})}
        <polygon points={poly} fill="var(--blueDim)" stroke="var(--blue)" strokeWidth="2"/>
        {keys.map((k,i)=>{const[x,y]=pt(i,wheel[k]);return<circle key={i} cx={x} cy={y} r="4" fill="var(--blue)"/>})}
        {keys.map((k,i)=>{const[x,y]=pt(i,11.6);return<text key={i} x={x} y={y} fill="var(--muted)" fontSize="10" fontFamily="Inter" textAnchor="middle" dominantBaseline="middle">{k}</text>})}
      </svg>
      <div style={{flex:1,minWidth:240}}>
        <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Rate each area 1–10. See where life is out of balance.</p>
        {keys.map(k=>(
          <div key={k} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,color:C.text}}>{k}</span><span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12,color:C.blue}}>{wheel[k]}</span></div>
            <input type="range" min="1" max="10" value={wheel[k]} onChange={e=>set(k,Number(e.target.value))} style={{width:'100%',accentColor:'var(--blue)'}}/>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── journal tab ──────────────────────────────────────────────────────────────────
function JournalTab({vision,setV}){
  const [txt,setTxt]=useState('')
  const entries=vision.journal||[]
  const add=()=>{ const v=txt.trim(); if(!v)return; setV({...vision,journal:[{id:uid('j'),date:todayKey(),text:v},...entries]}); setTxt('') }
  const del=id=>setV({...vision,journal:entries.filter(e=>e.id!==id)})
  return(
    <div style={{maxWidth:620}}>
      <p style={{color:C.muted,fontSize:13,marginBottom:12}}>Log progress and wins. "June 21, 2026: Passed AWS exam."</p>
      <div style={{display:'flex',gap:8,marginBottom:18}}>
        <textarea value={txt} onChange={e=>setTxt(e.target.value)} rows={2} placeholder="What happened today?"
          style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:'10px 12px',color:C.text,fontSize:14,outline:'none',resize:'vertical'}}/>
        <button onClick={add} style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,letterSpacing:'0.1em',padding:'0 18px',borderRadius:3,cursor:'pointer',border:`1px solid ${C.blue}`,background:C.blueDim,color:C.blue}}>LOG</button>
      </div>
      {entries.map(e=>(
        <div key={e.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:'12px 16px',marginBottom:8,position:'relative'}}>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.blue,letterSpacing:'0.1em',marginBottom:5}}>{new Date(e.date+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</div>
          <div style={{fontSize:14,color:C.text,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{e.text}</div>
          <button onClick={()=>del(e.id)} style={{position:'absolute',top:8,right:10,background:'none',border:'none',color:C.dim,cursor:'pointer',fontSize:14}}>×</button>
        </div>
      ))}
    </div>
  )
}

// ── achievement wall ─────────────────────────────────────────────────────────────
function AchievementsTab({vision}){
  const done=vision.items.filter(i=>i.kind==='goal'&&i.done)
  return(
    <div>
      <p style={{color:C.muted,fontSize:13,marginBottom:18}}>Goals you've completed. Mark a goal card "achieved" in its editor and it lands here. 🏆</p>
      {done.length===0?(
        <Panel style={{padding:'30px',textAlign:'center'}}><div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim,letterSpacing:'0.1em'}}>NO ACHIEVEMENTS YET — GO GET ONE</div></Panel>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
          {done.map(i=>(
            <Panel key={i.id} glow style={{padding:'16px'}}>
              <div style={{fontSize:18,marginBottom:6}}>🏆</div>
              <div style={{fontSize:15,fontWeight:600,color:C.text}}>{i.title}</div>
              {i.targetDate&&<div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,marginTop:4}}>{new Date(i.targetDate+'T00:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>}
              {i.note&&<div style={{fontSize:12,color:C.muted,marginTop:8,lineHeight:1.4}}>{i.note}</div>}
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}

// ── dream parking lot ────────────────────────────────────────────────────────────
function ParkingTab({vision,setV}){
  const [txt,setTxt]=useState('')
  const lot=vision.parking||[]
  const add=()=>{const v=txt.trim();if(!v)return;setV({...vision,parking:[...lot,{id:uid('d'),text:v}]});setTxt('')}
  const del=id=>setV({...vision,parking:lot.filter(d=>d.id!==id)})
  const promote=d=>{ // turn a dream into a real goal card on the canvas
    const z=vision.items.reduce((m,i)=>Math.max(m,i.z||1),1)+1
    setV({...vision,parking:lot.filter(x=>x.id!==d.id),items:[...vision.items,{id:uid('goal'),kind:'goal',title:d.text,current:0,target:100,unit:'',habits:[],x:80,y:80,w:240,h:140,rot:0,z,category:''}]})
  }
  return(
    <div style={{maxWidth:600}}>
      <p style={{color:C.muted,fontSize:13,marginBottom:14}}>Ideas you're considering but haven't committed to. Park them here — promote to a real goal when ready. ☁️</p>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <input value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add()}} placeholder="A maybe-someday dream..."
          style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:'10px 12px',color:C.text,fontSize:14,outline:'none'}}/>
        <button onClick={add} style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,letterSpacing:'0.1em',padding:'0 18px',borderRadius:3,cursor:'pointer',border:`1px solid ${C.border2}`,background:C.surface2,color:C.text}}>PARK</button>
      </div>
      {lot.map(d=>(
        <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,background:C.surface,border:`1px dashed ${C.border2}`,borderRadius:4,padding:'10px 14px',marginBottom:8}}>
          <span style={{flex:1,fontSize:14,color:C.text}}>{d.text}</span>
          <button onClick={()=>promote(d)} title="Commit as a goal" style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.green,background:'none',border:`1px solid ${C.green}`,borderRadius:3,padding:'4px 8px',cursor:'pointer'}}>COMMIT →</button>
          <button onClick={()=>del(d.id)} style={{background:'none',border:'none',color:C.dim,cursor:'pointer',fontSize:15}}>×</button>
        </div>
      ))}
    </div>
  )
}

// ── future self summary ──────────────────────────────────────────────────────────
function FutureSelfTab({vision}){
  const goals=vision.items.filter(i=>i.kind==='goal')
  const achieved=goals.filter(i=>i.done).length
  const cats=vision.categories.filter(c=>vision.items.some(i=>i.category===c.id))
  const soon=vision.items.filter(i=>i.targetDate).sort((a,b)=>a.targetDate.localeCompare(b.targetDate))[0]
  const aff=vision.items.filter(i=>i.kind==='text'&&i.textKind==='affirmation').map(i=>i.text)
  const lead=cats.length?cats.map(c=>c.name).join(', ').replace(/, ([^,]*)$/,' and $1'):'a life of your design'
  return(
    <div style={{maxWidth:640}}>
      <div style={{background:`linear-gradient(160deg,var(--surface),var(--surface2))`,border:`1px solid ${C.border2}`,borderRadius:8,padding:'32px 30px',position:'relative',overflow:'hidden'}}>
        <Corners size={16} color={C.blue}/>
        <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,letterSpacing:'0.3em',color:C.muted,marginBottom:14}}>THIS IS WHO YOU ARE BECOMING</div>
        <div style={{fontSize:22,fontWeight:600,color:C.text,lineHeight:1.5}}>
          You're building toward {lead}. You've set <span style={{color:C.blue}}>{goals.length} goal{goals.length===1?'':'s'}</span>
          {achieved>0&&<> and already achieved <span style={{color:C.green}}>{achieved}</span></>}.
          {soon&&<> Your next horizon is <span style={{color:C.amber}}>{soon.title||soon.text}</span> by {new Date(soon.targetDate+'T00:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'})}.</>}
        </div>
        {aff.length>0&&(
          <div style={{marginTop:20,paddingTop:18,borderTop:`1px solid ${C.border}`}}>
            {aff.map((a,i)=><div key={i} style={{fontSize:15,fontStyle:'italic',color:C.muted,marginBottom:6}}>“{a}”</div>)}
          </div>
        )}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
        {[{v:vision.items.length,l:'Board items'},{v:goals.length,l:'Goals set'},{v:achieved,l:'Achieved'}].map(s=>(
          <Panel key={s.l} style={{padding:'14px 16px'}}>
            <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:24,fontWeight:700,color:C.blue}}>{s.v}</div>
            <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.muted,marginTop:6,letterSpacing:'0.1em',textTransform:'uppercase'}}>{s.l}</div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

// ── motivation fullscreen mode ───────────────────────────────────────────────────
function MotivationMode({vision,onClose}){
  const slides=useMemo(()=>{
    const imgs=vision.items.filter(i=>i.kind==='image'&&i.src).map(i=>({type:'image',src:i.src,note:i.note}))
    const quotes=vision.items.filter(i=>i.kind==='text').map(i=>({type:'text',text:i.text,kind:i.textKind}))
    const goals=vision.items.filter(i=>i.kind==='goal').map(i=>({type:'goal',title:i.title}))
    const mix=[]; const max=Math.max(imgs.length,quotes.length,goals.length)
    for(let i=0;i<max;i++){ if(imgs[i])mix.push(imgs[i]); if(quotes[i])mix.push(quotes[i]); if(goals[i])mix.push(goals[i]) }
    return mix.length?mix:[{type:'text',text:'Add items to your board to fill this mode.',kind:'affirmation'}]
  },[vision])
  const [idx,setIdx]=useState(0)
  useEffect(()=>{const t=setInterval(()=>setIdx(i=>(i+1)%slides.length),4000);return()=>clearInterval(t)},[slides.length])
  useEffect(()=>{const k=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[onClose])
  const s=slides[idx]
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:5000,background:'#000',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden'}}>
      {s.type==='image'&&<img key={idx} src={s.src} alt="" style={{maxWidth:'92%',maxHeight:'80%',objectFit:'contain',borderRadius:8,animation:'fadeIn 0.8s ease',boxShadow:'0 0 80px rgba(220,161,95,0.3)'}}/>}
      {s.type==='text'&&<div key={idx} style={{maxWidth:'80%',textAlign:'center',animation:'fadeIn 0.8s ease'}}><div style={{fontSize:'clamp(28px,5vw,56px)',fontWeight:600,color:'#fff',lineHeight:1.3,fontStyle:s.kind==='quote'?'italic':'normal'}}>{s.text}</div></div>}
      {s.type==='goal'&&<div key={idx} style={{textAlign:'center',animation:'fadeIn 0.8s ease'}}><div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",color:'#dca15f',letterSpacing:'0.3em',marginBottom:16}}>GOAL</div><div style={{fontSize:'clamp(28px,5vw,52px)',fontWeight:700,color:'#fff'}}>{s.title}</div></div>}
      {s.note&&<div style={{position:'absolute',bottom:60,left:0,right:0,textAlign:'center',color:'#9fb0c6',fontSize:16,padding:'0 40px'}}>{s.note}</div>}
      <div style={{position:'absolute',top:24,right:30,color:'#5a6b86',fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11}}>ESC / CLICK TO EXIT</div>
      <div style={{position:'absolute',bottom:24,left:0,right:0,display:'flex',justifyContent:'center',gap:6}}>
        {slides.map((_,i)=><div key={i} style={{width:i===idx?20:6,height:6,borderRadius:3,background:i===idx?'#dca15f':'#3a3128',transition:'all 0.3s'}}/>)}
      </div>
    </div>
  )
}

// ── category manager ─────────────────────────────────────────────────────────────
function CategoryBar({vision,setV}){
  const [adding,setAdding]=useState(false)
  const [name,setName]=useState('')
  const add=()=>{const v=name.trim();if(!v)return;const color=CAT_COLORS[vision.categories.length%CAT_COLORS.length];setV({...vision,categories:[...vision.categories,{id:uid('c'),name:v,color}]});setName('');setAdding(false)}
  const del=id=>setV({...vision,categories:vision.categories.filter(c=>c.id!==id),items:vision.items.map(i=>i.category===id?{...i,category:''}:i)})
  return(
    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
      <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.dim,letterSpacing:'0.1em',marginRight:4}}>SECTIONS:</span>
      {vision.categories.map(c=>(
        <span key={c.id} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 8px 3px 10px',borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.text}}>
          <span style={{width:8,height:8,borderRadius:'50%',background:c.color}}/>{c.name}
          <button onClick={()=>del(c.id)} style={{background:'none',border:'none',color:C.dim,cursor:'pointer',fontSize:13,padding:0,lineHeight:1}}>×</button>
        </span>
      ))}
      {adding?(
        <input value={name} autoFocus onChange={e=>setName(e.target.value)} onBlur={add} onKeyDown={e=>{if(e.key==='Enter')add();if(e.key==='Escape')setAdding(false)}}
          placeholder="Section name" style={{background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:20,padding:'3px 10px',color:C.text,fontSize:11,outline:'none',width:120}}/>
      ):(
        <button onClick={()=>setAdding(true)} style={{padding:'3px 10px',borderRadius:20,fontSize:11,border:`1px dashed ${C.border2}`,background:'none',color:C.muted,cursor:'pointer'}}>+ section</button>
      )}
    </div>
  )
}

// ── vision board shell ───────────────────────────────────────────────────────────
const VIS_TABS=[
  {id:'canvas',label:'Canvas'},{id:'focus',label:'Daily Focus'},{id:'timeline',label:'Timeline'},
  {id:'wheel',label:'Life Wheel'},{id:'achievements',label:'Achievements'},{id:'parking',label:'Dream Lot'},
  {id:'future',label:'Future Self'},
]
function VisionBoard({vision,setVision,theme}){
  const [tab,setTab]=useState('canvas')
  const [motivate,setMotivate]=useState(false)
  const setV=v=>{ setVision(v); saveVision(v) }
  return(
    <div style={{animation:'fadeUp 0.3s ease'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
        <Ember size={24} color={C.blue} glow/>
        <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:18,fontWeight:700,letterSpacing:'0.05em'}}>Vision Board</div>
        <div style={{flex:1}}/>
        <button onClick={()=>setMotivate(true)} style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,letterSpacing:'0.1em',padding:'8px 16px',borderRadius:3,cursor:'pointer',border:`1px solid ${C.amber}`,background:'rgba(245,158,11,0.1)',color:C.amber,transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.background=C.amber;e.currentTarget.style.color='#000'}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(245,158,11,0.1)';e.currentTarget.style.color=C.amber}}>▶ MOTIVATION MODE</button>
      </div>
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,marginBottom:18,letterSpacing:'0.1em'}}>THE LIFE YOU'RE BUILDING. LOOK AT IT OFTEN.</div>

      {/* sub-tabs */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:16,borderBottom:`1px solid ${C.border}`,paddingBottom:10}}>
        {VIS_TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:8,letterSpacing:'0.08em',padding:'7px 12px',borderRadius:3,cursor:'pointer',
            border:`1px solid ${tab===t.id?C.border2:'transparent'}`,background:tab===t.id?C.blueDim:'transparent',color:tab===t.id?C.blue:C.muted,transition:'all 0.12s'}}>{t.label.toUpperCase()}</button>
        ))}
      </div>

      {tab==='canvas'&&<><CategoryBar vision={vision} setV={setV}/><CanvasTab vision={vision} setV={setV} theme={theme}/></>}
      {tab==='focus'&&<FocusTab vision={vision} setV={setV}/>}
      {tab==='timeline'&&<TimelineTab vision={vision}/>}
      {tab==='wheel'&&<WheelTab vision={vision} setV={setV}/>}
      {tab==='achievements'&&<AchievementsTab vision={vision}/>}
      {tab==='parking'&&<ParkingTab vision={vision} setV={setV}/>}
      {tab==='future'&&<FutureSelfTab vision={vision}/>}

      {motivate&&<MotivationMode vision={vision} onClose={()=>setMotivate(false)}/>}
    </div>
  )
}

// ── NAV ITEM ──────────────────────────────────────────────────────────────────
function NavItem({code,label,active,onClick,badge=false}){
  const [hover,setHover]=useState(false)
  return(
    <button onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:3,cursor:'pointer',fontSize:13,fontWeight:500,width:'100%',textAlign:'left',
        border:active?`1px solid ${C.border2}`:'1px solid transparent',
        background:active?C.blueDim:hover?'rgba(127,127,127,0.06)':'transparent',
        color:active?C.blue:hover?C.text:C.muted,transition:'all 0.14s ease',position:'relative'}}>
      {active&&<div style={{position:'absolute',left:0,top:'20%',bottom:'20%',width:2,background:C.blue,borderRadius:'0 2px 2px 0',boxShadow:`0 0 8px ${C.blueGlow}`}}/>}
      <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:7,letterSpacing:'0.1em',width:22,color:active?C.blue:C.muted,flexShrink:0}}>{code}</span>
      <span style={{flex:1}}>{label}</span>
      {badge&&!active&&<div title="Reflection due" style={{width:7,height:7,borderRadius:'50%',background:C.red,boxShadow:`0 0 8px ${C.red}`,animation:'dotPulse 1.6s ease-in-out infinite'}}/>}
      {active&&<div style={{width:4,height:4,borderRadius:'50%',background:C.blue,boxShadow:`0 0 6px ${C.blueGlow}`,animation:'dotPulse 2.2s ease-in-out infinite'}}/>}
    </button>
  )
}

// ── THEME TOGGLE ──────────────────────────────────────────────────────────────
function ThemeToggle({theme,setTheme}){
  const dark=theme==='dark'
  return(
    <button onClick={()=>setTheme(dark?'light':'dark')} title="Toggle theme"
      style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:3,cursor:'pointer',width:'100%',
        border:`1px solid ${C.border}`,background:'transparent',color:C.muted,transition:'all 0.14s',fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,letterSpacing:'0.1em'}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.border2;e.currentTarget.style.color=C.text}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted}}>
      <span style={{fontSize:13}}>{dark?'🌙':'☀️'}</span>
      <span>{dark?'DARK MODE':'LIGHT MODE'}</span>
      <span style={{marginLeft:'auto',width:28,height:14,borderRadius:8,background:dark?C.dim:C.blue,position:'relative',transition:'background 0.2s'}}>
        <span style={{position:'absolute',top:1,left:dark?1:15,width:12,height:12,borderRadius:'50%',background:'#fff',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.4)'}}/>
      </span>
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// STUDY — built around memory & retrieval, not consumption
// ════════════════════════════════════════════════════════════════════════════════
const SUBJECT_COLORS=['#dca15f','#93a777','#cf7b6b','#d98a4a','#7fa8c9','#b58fd9','#5fb7a1','#d98fb0']
const TYPE_ICON={note:'✎',quick:'⚡',link:'🔗',image:'🖼',pdf:'📄',voice:'🎙'}
const CONF={high:{label:'Solid',color:'var(--green)'},med:{label:'Shaky',color:'var(--amber)'},low:{label:'Weak',color:'var(--red)'}}
const ask=msg=>{ try{ return window.prompt(msg) }catch{ return null } }
const confirmSafe=msg=>{ try{ return window.confirm(msg) }catch{ return true } }

function Stars({value=0,onChange,size=18}){
  return <span style={{display:'inline-flex',gap:2}}>{[1,2,3,4,5].map(i=>(
    <span key={i} onClick={e=>{e.stopPropagation();onChange&&onChange(i===value?0:i)}}
      style={{cursor:onChange?'pointer':'default',color:i<=value?'var(--amber)':'var(--dim)',fontSize:size,lineHeight:1,transition:'color 0.1s'}}>★</span>
  ))}</span>
}

function StudyView({study,setStudy,scheduleBlock,addToToday,isMobile}){
  const F="'Inter',-apple-system,system-ui,sans-serif", SER="'Fraunces',Georgia,serif"
  const subjects=study.subjects||[], notes=study.notes||[]
  const [tab,setTab]=useState('inbox')
  const [openId,setOpenId]=useState(null)
  const [q,setQ]=useState('')
  const [tagFilter,setTagFilter]=useState(null)
  const [flash,setFlash]=useState(null)
  const [test,setTest]=useState(null)
  const [capText,setCapText]=useState('')
  const [recording,setRecording]=useState(false)
  const fileImg=useRef(), filePdf=useRef(), recRef=useRef(null)
  const ping=m=>{ setFlash(m); setTimeout(()=>setFlash(null),1700) }

  const setNotes=up=>setStudy(s=>({...s,notes:up(s.notes||[])}))
  const patchNote=(id,patch)=>setNotes(ns=>ns.map(n=>n.id===id?{...n,...patch}:n))
  const editNote=(id,patch)=>patchNote(id,{...patch,updated:Date.now()})
  const addNote=(partial={})=>{ const n={id:uid('n'),subjectId:null,topic:'',title:'',body:'',type:'note',url:'',dataUrl:'',tags:[],favorite:false,bookmarked:false,highlights:[],understanding:0,confidence:null,cards:[],connections:[],created:Date.now(),updated:Date.now(),lastReviewed:null,lastTested:null,lastViewed:null,recallStage:0,recallDueAt:null,inbox:true,...partial}; setStudy(s=>({...s,notes:[n,...(s.notes||[])]})); return n.id }
  const removeNote=id=>setStudy(s=>({...s,notes:s.notes.filter(n=>n.id!==id).map(n=>({...n,connections:(n.connections||[]).filter(c=>c!==id)}))}))
  const addSubject=name=>{ const nm=(name||'').trim(); if(!nm)return null; const id=uid('sub'); setStudy(s=>({...s,subjects:[...(s.subjects||[]),{id,name:nm,color:SUBJECT_COLORS[(s.subjects||[]).length%SUBJECT_COLORS.length]}]})); return id }
  const open=id=>{ setOpenId(id); patchNote(id,{lastViewed:Date.now()}) }
  const toggleConn=(aId,bId)=>setNotes(ns=>ns.map(n=>{
    if(n.id===aId){ const has=(n.connections||[]).includes(bId); return {...n,connections:has?n.connections.filter(c=>c!==bId):[...(n.connections||[]),bId]} }
    if(n.id===bId){ const has=(n.connections||[]).includes(aId); return {...n,connections:has?n.connections.filter(c=>c!==aId):[...(n.connections||[]),aId]} }
    return n }))
  const doRecall=(id,ok)=>setNotes(ns=>ns.map(n=>{ if(n.id!==id)return n; const stage=ok?Math.min((n.recallStage||0)+1,RECALL_STEPS.length-1):0; return {...n,recallStage:stage,recallDueAt:recallAfter(stage),lastReviewed:Date.now()} }))

  const readFile=(file,type)=>{ if(!file)return; const r=new FileReader(); r.onload=()=>{ addNote({type,dataUrl:r.result,title:file.name}); ping('Added to inbox') }; r.readAsDataURL(file) }
  const onPaste=e=>{ const items=(e.clipboardData&&e.clipboardData.items)||[]; for(const it of items){ if(it.type&&it.type.indexOf('image')===0){ const f=it.getAsFile(); if(f){ readFile(f,'image'); e.preventDefault(); return } } } }
  const startRec=async()=>{ try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const mr=new MediaRecorder(stream); const chunks=[]; mr.ondataavailable=ev=>chunks.push(ev.data); mr.onstop=()=>{ const blob=new Blob(chunks,{type:'audio/webm'}); const r=new FileReader(); r.onload=()=>{addNote({type:'voice',dataUrl:r.result,title:'Voice note · '+new Date().toLocaleDateString()}); ping('Voice note saved')}; r.readAsDataURL(blob); stream.getTracks().forEach(t=>t.stop()) }; mr.start(); recRef.current=mr; setRecording(true) }catch(err){ ping('Mic not available here') } }
  const stopRec=()=>{ try{ recRef.current&&recRef.current.stop() }catch{} setRecording(false) }

  const captureNote=()=>{ const t=capText.trim(); const id=addNote({type:'note',title:t||'Untitled note'}); setCapText(''); open(id) }
  const captureQuick=()=>{ const t=capText.trim(); if(!t)return; addNote({type:'quick',title:t.slice(0,70),body:t}); setCapText(''); ping('Captured to inbox') }
  const captureLink=()=>{ let t=capText.trim(); if(!t)return; const url=/^https?:\/\//.test(t)?t:'https://'+t; addNote({type:'link',title:t.replace(/^https?:\/\//,'').slice(0,70),url}); setCapText(''); ping('Link saved') }

  const inbox=notes.filter(n=>n.inbox)
  const filed=notes.filter(n=>!n.inbox)
  const allTags=[...new Set(notes.flatMap(n=>n.tags||[]))]
  const ql=q.trim().toLowerCase()
  const matches=n=>(!ql||((n.title||'')+' '+(n.body||'')+' '+(n.tags||[]).join(' ')+' '+(n.topic||'')).toLowerCase().includes(ql))&&(!tagFilter||(n.tags||[]).includes(tagFilter))
  const dueNotes=filed.filter(recallDue)
  const recent=[...filed].filter(n=>n.lastViewed).sort((a,b)=>b.lastViewed-a.lastViewed).slice(0,10)
  const favs=filed.filter(n=>n.favorite)
  const marks=filed.filter(n=>n.bookmarked)
  const weak=filed.filter(n=>n.confidence==='low'||(n.understanding>0&&n.understanding<=2))
  const stale=filed.filter(n=>!n.lastReviewed||daysAgo(n.lastReviewed)>=14)
  const topicsCount=new Set(filed.map(n=>(n.subjectId||'')+'|'+(n.topic||'')).filter(k=>k!=='|')).size
  const cardsCount=filed.reduce((a,n)=>a+(n.cards||[]).length,0)
  const connCount=Math.round(filed.reduce((a,n)=>a+(n.connections||[]).length,0)/2)
  const subj=id=>subjects.find(s=>s.id===id)
  const subjName=id=>{ const s=subj(id); return s?s.name:'Unfiled' }
  const subjColor=id=>{ const s=subj(id); return s?s.color:C.muted }

  const fld={width:'100%',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:13,padding:'9px 11px',outline:'none',fontFamily:F,resize:'vertical',boxSizing:'border-box'}
  const lbl={fontFamily:F,fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:C.dim,marginBottom:6,display:'block'}
  const obtn=c=>({fontFamily:F,fontSize:12,fontWeight:600,padding:'8px 13px',borderRadius:7,cursor:'pointer',border:`1px solid ${c}`,background:'transparent',color:c,whiteSpace:'nowrap'})
  const card={background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:'var(--card-shadow)'}

  // ── small note row used in lists ──
  const NoteRow=({n,extra})=>(
    <div onClick={()=>open(n.id)} style={{display:'flex',alignItems:'center',gap:11,padding:'11px 14px',marginBottom:7,cursor:'pointer',...card}}>
      <span style={{fontSize:15,width:20,textAlign:'center',flexShrink:0}}>{TYPE_ICON[n.type]||'✎'}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:F,fontSize:13.5,fontWeight:600,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{n.title||'Untitled'}{n.favorite&&<span style={{color:C.amber,marginLeft:6}}>★</span>}</div>
        <div style={{fontFamily:F,fontSize:10.5,color:C.dim,marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
          {!n.inbox&&<span style={{color:subjColor(n.subjectId)}}>{subjName(n.subjectId)}{n.topic?' › '+n.topic:''}</span>}
          {extra}
        </div>
      </div>
      {n.confidence&&<span style={{width:7,height:7,borderRadius:'50%',background:CONF[n.confidence].color,flexShrink:0}} title={CONF[n.confidence].label}/>}
    </div>
  )

  const STAB=[['inbox','Inbox',inbox.length],['library','Library',filed.length],['review','Review',dueNotes.length],['test','Test',cardsCount],['graph','Graph',connCount],['dash','Dashboard',null]]

  return(
    <div style={{maxWidth:920,margin:'0 auto',animation:'fadeUp 0.3s ease',paddingBottom:20}} onPaste={onPaste}>
      {flash&&<div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',zIndex:3000,background:C.surface3,border:`1px solid ${C.border2}`,borderRadius:20,padding:'9px 18px',fontFamily:F,fontSize:12,color:C.text,boxShadow:'var(--card-shadow-sel)'}}>{flash}</div>}

      <div style={{marginBottom:16}}>
        <h1 style={{fontFamily:SER,fontSize:'clamp(24px,4vw,32px)',fontWeight:600,color:C.text,lineHeight:1.1}}>Study</h1>
        <p style={{fontFamily:F,fontSize:13,color:C.muted,marginTop:6}}>Not "how much did I read." The real question: <span style={{color:C.text}}>what can I still explain?</span></p>
      </div>

      {/* sub-tabs */}
      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:6,marginBottom:18,borderBottom:`1px solid ${C.border}`}}>
        {STAB.map(([id,label,count])=>(
          <button key={id} onClick={()=>setTab(id)} style={{fontFamily:F,fontSize:12,fontWeight:tab===id?600:500,padding:'8px 13px',borderRadius:8,cursor:'pointer',border:'none',background:tab===id?C.blueDim:'transparent',color:tab===id?C.blue:C.muted,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
            {label}{count!=null&&count>0&&<span style={{fontSize:10,background:tab===id?C.blue:C.surface3,color:tab===id?'#15120e':C.muted,borderRadius:10,padding:'1px 6px',fontWeight:600}}>{count}</span>}
            {id==='review'&&dueNotes.length>0&&<span style={{width:6,height:6,borderRadius:'50%',background:C.red,boxShadow:`0 0 6px ${C.red}`}}/>}
          </button>
        ))}
      </div>

      {/* ── INBOX / CAPTURE ── */}
      {tab==='inbox'&&<div>
        <div style={{...card,padding:'16px 18px',marginBottom:18}}>
          <span style={lbl}>Capture anything — sort it later</span>
          <textarea value={capText} onChange={e=>setCapText(e.target.value)} placeholder="Type a note, paste a link, or paste a screenshot (Ctrl/Cmd+V)…" rows={2} style={{...fld,marginBottom:10}}/>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            <button onClick={captureNote} style={obtn(C.blue)}>✎ New note</button>
            <button onClick={captureQuick} style={obtn(C.muted)}>⚡ Quick note</button>
            <button onClick={captureLink} style={obtn(C.muted)}>🔗 Save link</button>
            <button onClick={()=>fileImg.current&&fileImg.current.click()} style={obtn(C.muted)}>🖼 Image</button>
            <button onClick={()=>filePdf.current&&filePdf.current.click()} style={obtn(C.muted)}>📄 PDF</button>
            <button onClick={recording?stopRec:startRec} style={obtn(recording?C.red:C.muted)}>{recording?'■ Stop':'🎙 Voice'}</button>
          </div>
          <input ref={fileImg} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{readFile(e.target.files[0],'image');e.target.value=''}}/>
          <input ref={filePdf} type="file" accept="application/pdf" style={{display:'none'}} onChange={e=>{readFile(e.target.files[0],'pdf');e.target.value=''}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'0 2px 10px'}}>
          <span style={{fontFamily:SER,fontSize:15,fontWeight:600}}>Inbox <span style={{color:C.muted,fontSize:12}}>{inbox.length}</span></span>
          <span style={{fontFamily:F,fontSize:11,color:C.dim}}>Open an item to file it into a subject</span>
        </div>
        {inbox.length===0?(
          <div style={{...card,padding:'28px',textAlign:'center'}}>
            <div style={{fontFamily:F,fontSize:13,color:C.muted}}>Inbox is empty.</div>
            <div style={{fontFamily:F,fontSize:11,color:C.dim,marginTop:5}}>Capture first, organize later. That's the whole point — never lose a thought again.</div>
          </div>
        ):inbox.map(n=><NoteRow key={n.id} n={n} extra={<span>· captured {agoLabel(n.created)}</span>}/>)}
      </div>}

      {/* ── LIBRARY / ORGANIZE ── */}
      {tab==='library'&&<div>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search everything…" style={{...fld,flex:1,minWidth:180}}/>
          <button onClick={()=>{ const nm=ask('New subject name'); if(nm)addSubject(nm) }} style={obtn(C.blue)}>+ Subject</button>
        </div>
        {allTags.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
          {allTags.map(t=><button key={t} onClick={()=>setTagFilter(tagFilter===t?null:t)} style={{fontFamily:F,fontSize:11,padding:'4px 10px',borderRadius:20,cursor:'pointer',border:`1px solid ${tagFilter===t?C.blue:C.border}`,background:tagFilter===t?C.blueDim:'transparent',color:tagFilter===t?C.blue:C.muted}}>#{t}</button>)}
        </div>}
        {subjects.length===0&&filed.length===0?(
          <div style={{...card,padding:'28px',textAlign:'center'}}>
            <div style={{fontFamily:F,fontSize:13,color:C.muted}}>No subjects yet.</div>
            <div style={{fontFamily:F,fontSize:11,color:C.dim,marginTop:5}}>Make a subject (e.g. your certification), then file inbox items into it.</div>
          </div>
        ):subjects.map(s=>{
          const sn=filed.filter(n=>n.subjectId===s.id&&matches(n))
          if(ql&&sn.length===0)return null
          const topics=[...new Set(sn.map(n=>n.topic||'General'))]
          return(
            <div key={s.id} style={{marginBottom:18}}>
              <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}}>
                <span style={{width:10,height:10,borderRadius:3,background:s.color}}/>
                <span style={{fontFamily:SER,fontSize:17,fontWeight:600,color:C.text}}>{s.name}</span>
                <span style={{fontFamily:F,fontSize:11,color:C.muted}}>{sn.length} note{sn.length!==1?'s':''}</span>
              </div>
              {sn.length===0?<div style={{fontFamily:F,fontSize:11,color:C.dim,paddingLeft:19,marginBottom:6}}>empty</div>:topics.map(tp=>(
                <div key={tp} style={{paddingLeft:8,borderLeft:`2px solid ${s.color}`,marginLeft:4,marginBottom:8}}>
                  <div style={{fontFamily:F,fontSize:10,letterSpacing:'0.08em',textTransform:'uppercase',color:C.dim,margin:'4px 0 6px 8px'}}>{tp}</div>
                  {sn.filter(n=>(n.topic||'General')===tp).map(n=><div key={n.id} style={{paddingLeft:8}}><NoteRow n={n} extra={<span>{(n.cards||[]).length>0&&<span>· {(n.cards||[]).length} card{(n.cards||[]).length!==1?'s':''}</span>}</span>}/></div>)}
                </div>
              ))}
            </div>
          )
        })}
        {/* unfiled-but-not-inbox safety */}
        {filed.filter(n=>!subjects.find(s=>s.id===n.subjectId)&&matches(n)).map(n=><NoteRow key={n.id} n={n}/>)}
      </div>}

      {/* ── REVIEW / RECALL ── */}
      {tab==='review'&&<div>
        <div style={{...card,padding:'18px',marginBottom:18,borderColor:dueNotes.length?C.border2:C.border}}>
          <div style={{fontFamily:SER,fontSize:18,fontWeight:600,marginBottom:4}}>Recall queue</div>
          <div style={{fontFamily:F,fontSize:12,color:C.muted,marginBottom:dueNotes.length?14:0}}>Remembering is the goal, not reading. These are due to be re-explained from memory.</div>
          {dueNotes.length===0?<div style={{fontFamily:F,fontSize:12,color:C.green}}>✓ Nothing due right now. Come back later.</div>:dueNotes.map(n=>(
            <div key={n.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderTop:`1px solid ${C.border}`,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:140,cursor:'pointer'}} onClick={()=>open(n.id)}>
                <div style={{fontFamily:F,fontSize:13.5,fontWeight:600,color:C.text}}>{n.title}</div>
                <div style={{fontFamily:F,fontSize:10.5,color:C.dim}}>Can you still explain this? · last recall {agoLabel(n.lastReviewed)}</div>
              </div>
              <button onClick={()=>{doRecall(n.id,false);ping('Reset — see it again soon')}} style={obtn(C.red)}>Forgot</button>
              <button onClick={()=>{doRecall(n.id,true);ping('Locked in 🔒')}} style={obtn(C.green)}>Still got it</button>
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:14}}>
          <div><div style={{fontFamily:SER,fontSize:14,fontWeight:600,marginBottom:8}}>★ Favorites <span style={{color:C.muted,fontSize:11}}>{favs.length}</span></div>{favs.length===0?<div style={{fontFamily:F,fontSize:11,color:C.dim}}>none yet</div>:favs.map(n=><NoteRow key={n.id} n={n}/>)}</div>
          <div><div style={{fontFamily:SER,fontSize:14,fontWeight:600,marginBottom:8}}>⚑ Bookmarks <span style={{color:C.muted,fontSize:11}}>{marks.length}</span></div>{marks.length===0?<div style={{fontFamily:F,fontSize:11,color:C.dim}}>none yet</div>:marks.map(n=><NoteRow key={n.id} n={n}/>)}</div>
          <div><div style={{fontFamily:SER,fontSize:14,fontWeight:600,marginBottom:8}}>⟲ Recently viewed</div>{recent.length===0?<div style={{fontFamily:F,fontSize:11,color:C.dim}}>none yet</div>:recent.map(n=><NoteRow key={n.id} n={n} extra={<span>· {agoLabel(n.lastViewed)}</span>}/>)}</div>
          <div><div style={{fontFamily:SER,fontSize:14,fontWeight:600,marginBottom:8,color:C.red}}>⚠ Weak areas <span style={{color:C.muted,fontSize:11}}>{weak.length}</span></div>{weak.length===0?<div style={{fontFamily:F,fontSize:11,color:C.dim}}>none marked</div>:weak.map(n=><NoteRow key={n.id} n={n} extra={<span>· you marked this {n.confidence?CONF[n.confidence].label.toLowerCase():'low'}</span>}/>)}</div>
        </div>
      </div>}

      {/* ── TEST ── */}
      {tab==='test'&&<div>
        {!test?(
          <div style={{...card,padding:'18px',marginBottom:16}}>
            <div style={{fontFamily:SER,fontSize:18,fontWeight:600,marginBottom:4}}>Self-test</div>
            <div style={{fontFamily:F,fontSize:12,color:C.muted,marginBottom:14}}>Question shows, answer hides. Pulling it from memory is what makes it stick. Pick a deck:</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>startTest(filed)} style={obtn(C.blue)}>Everything ({cardsCount})</button>
              {subjects.map(s=>{ const c=filed.filter(n=>n.subjectId===s.id).reduce((a,n)=>a+(n.cards||[]).length,0); if(!c)return null; return <button key={s.id} onClick={()=>startTest(filed.filter(n=>n.subjectId===s.id))} style={obtn(s.color)}>{s.name} ({c})</button> })}
              <button onClick={()=>startTest(weak)} style={obtn(C.red)}>Weak areas only</button>
            </div>
            {cardsCount===0&&<div style={{fontFamily:F,fontSize:11,color:C.dim,marginTop:12}}>No Q&amp;A cards yet. Open a note and add some under "Test yourself."</div>}
          </div>
        ):<TestRunner test={test} setTest={setTest} doRecall={doRecall} patchNote={patchNote} subjName={subjName} F={F} SER={SER} obtn={obtn} card={card}/>}
      </div>}

      {/* ── GRAPH ── */}
      {tab==='graph'&&<KnowledgeGraph notes={filed} subjColor={subjColor} subjects={subjects} open={open} F={F} SER={SER} card={card}/>}

      {/* ── DASHBOARD ── */}
      {tab==='dash'&&<div>
        <div style={{fontFamily:F,fontSize:13,color:C.muted,marginBottom:16}}>No fake "87% ready." Just the facts about what you've actually built and what needs attention.</div>
        <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?'130px':'150px'},1fr))`,gap:12,marginBottom:20}}>
          {[['Notes',filed.length,C.blue],['In inbox',inbox.length,C.amber],['Subjects',subjects.length,C.blue],['Topics',topicsCount,C.blue],['Q&A cards',cardsCount,C.blue],['Connections',connCount,C.green],['Due for recall',dueNotes.length,dueNotes.length?C.red:C.green],['Marked weak',weak.length,weak.length?C.red:C.muted],['Not reviewed 2wk+',stale.length,stale.length?C.amber:C.green],['Favorites',favs.length,C.amber]].map(([l,v,c])=>(
            <div key={l} style={{...card,padding:'16px'}}>
              <div style={{fontFamily:SER,fontSize:30,fontWeight:600,color:c,lineHeight:1}}>{v}</div>
              <div style={{fontFamily:F,fontSize:10.5,color:C.muted,marginTop:6,letterSpacing:'0.04em'}}>{l}</div>
            </div>
          ))}
        </div>
        {subjects.length>0&&<div>
          <div style={{fontFamily:SER,fontSize:15,fontWeight:600,marginBottom:10}}>By subject</div>
          {subjects.map(s=>{ const sn=filed.filter(n=>n.subjectId===s.id); const avg=sn.length?(sn.reduce((a,n)=>a+(n.understanding||0),0)/sn.length):0; return(
            <div key={s.id} style={{...card,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <span style={{width:9,height:9,borderRadius:3,background:s.color}}/>
              <span style={{fontFamily:F,fontSize:13,fontWeight:600,flex:1,minWidth:120}}>{s.name}</span>
              <span style={{fontFamily:F,fontSize:11,color:C.muted}}>{sn.length} notes</span>
              <span style={{fontFamily:F,fontSize:11,color:C.dim}}>understanding</span>
              <Stars value={Math.round(avg)} size={13}/>
            </div>
          )})}
        </div>}
      </div>}

      {openId&&<NoteDetail note={notes.find(n=>n.id===openId)} subjects={subjects} notes={notes} addSubject={addSubject}
        editNote={editNote} patchNote={patchNote} removeNote={removeNote} toggleConn={toggleConn} doRecall={doRecall} open={open}
        onClose={()=>setOpenId(null)} scheduleBlock={scheduleBlock} addToToday={addToToday} ping={ping}
        F={F} SER={SER} fld={fld} lbl={lbl} obtn={obtn} subjName={subjName} subjColor={subjColor}/>}
    </div>
  )

  function startTest(scopeNotes){
    const queue=[]
    scopeNotes.forEach(n=>(n.cards||[]).forEach(c=>queue.push({noteId:n.id,title:n.title,card:c})))
    for(let i=queue.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [queue[i],queue[j]]=[queue[j],queue[i]] }
    if(queue.length===0){ ping('No cards in that deck yet'); return }
    setTest({queue,i:0,revealed:false,right:0,wrong:0})
  }
}

// ── test runner ──
function TestRunner({test,setTest,doRecall,patchNote,subjName,F,SER,obtn,card}){
  const cur=test.queue[test.i]
  const done=test.i>=test.queue.length
  if(done) return(
    <div style={{...card,padding:'26px',textAlign:'center'}}>
      <div style={{fontFamily:SER,fontSize:22,fontWeight:600,marginBottom:6}}>Deck complete</div>
      <div style={{fontFamily:F,fontSize:13,color:'var(--muted)',marginBottom:4}}>You recalled {test.right} of {test.right+test.wrong}.</div>
      <div style={{fontFamily:F,fontSize:12,color:'var(--dim)',marginBottom:18}}>The ones you missed are scheduled to come back sooner.</div>
      <button onClick={()=>setTest(null)} style={obtn('var(--blue)')}>Done</button>
    </div>
  )
  const mark=ok=>{ doRecall(cur.noteId,ok); patchNote(cur.noteId,{lastTested:Date.now()}); setTest(t=>({...t,i:t.i+1,revealed:false,right:t.right+(ok?1:0),wrong:t.wrong+(ok?0:1)})) }
  return(
    <div style={{...card,padding:'22px',minHeight:280,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',justifyContent:'space-between',fontFamily:F,fontSize:11,color:'var(--dim)',marginBottom:18}}>
        <span>{cur.title}</span><span>{test.i+1} / {test.queue.length}</span>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',textAlign:'center',gap:18}}>
        <div style={{fontFamily:SER,fontSize:'clamp(18px,3vw,24px)',fontWeight:600,color:'var(--text)',lineHeight:1.3}}>{cur.card.q}</div>
        {test.revealed?(
          <div style={{fontFamily:F,fontSize:15,color:'var(--blue)',lineHeight:1.5,borderTop:`1px solid var(--border)`,paddingTop:18,whiteSpace:'pre-wrap'}}>{cur.card.a}</div>
        ):(
          <button onClick={()=>setTest(t=>({...t,revealed:true}))} style={{...obtn('var(--muted)'),alignSelf:'center',padding:'10px 22px'}}>Reveal answer</button>
        )}
      </div>
      {test.revealed&&<div style={{display:'flex',gap:10,justifyContent:'center',marginTop:18}}>
        <button onClick={()=>mark(false)} style={obtn('var(--red)')}>✗ Missed it</button>
        <button onClick={()=>mark(true)} style={obtn('var(--green)')}>✓ Got it</button>
      </div>}
    </div>
  )
}

// ── knowledge graph ──
function KnowledgeGraph({notes,subjColor,subjects,open,F,SER,card}){
  const linked=notes
  const W=700,H=Math.max(420,Math.min(640,140+linked.length*16)),cx=W/2,cy=H/2,R=Math.min(cx,cy)-70
  const pos={}
  linked.forEach((n,i)=>{ const a=(i/Math.max(1,linked.length))*Math.PI*2-Math.PI/2; pos[n.id]={x:cx+R*Math.cos(a),y:cy+R*Math.sin(a)} })
  const edges=[]
  linked.forEach(n=>(n.connections||[]).forEach(c=>{ if(pos[c]&&n.id<c)edges.push([n.id,c]) }))
  return(
    <div>
      <div style={{fontFamily:F,fontSize:13,color:'var(--muted)',marginBottom:12}}>Every note that's wired to another. Isolated ideas are easy to forget — connected ones hold. Tap a node to open it.</div>
      {linked.length===0?(
        <div style={{...card,padding:'28px',textAlign:'center',fontFamily:F,fontSize:13,color:'var(--muted)'}}>No notes yet. Once you connect a few inside a note, the map grows here.</div>
      ):(
        <div style={{...card,padding:12,overflowX:'auto'}}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{minWidth:520,display:'block'}}>
            {edges.map(([a,b],i)=><line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} stroke="var(--border2)" strokeWidth="1.5"/>)}
            {linked.map(n=>{ const p=pos[n.id], deg=(n.connections||[]).length, r=8+Math.min(deg*2.5,14); return(
              <g key={n.id} style={{cursor:'pointer'}} onClick={()=>open(n.id)}>
                <circle cx={p.x} cy={p.y} r={r} fill={subjColor(n.subjectId)} opacity={deg?0.95:0.45} stroke="var(--bg)" strokeWidth="2"/>
                <text x={p.x} y={p.y-r-5} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="Inter,sans-serif">{(n.title||'').slice(0,16)}</text>
              </g>
            )})}
          </svg>
        </div>
      )}
      {subjects.length>0&&<div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:12}}>
        {subjects.map(s=><span key={s.id} style={{display:'flex',alignItems:'center',gap:6,fontFamily:F,fontSize:11,color:'var(--muted)'}}><span style={{width:9,height:9,borderRadius:'50%',background:s.color}}/>{s.name}</span>)}
      </div>}
    </div>
  )
}

// ── note detail (the heart: organize, connect, review, test, track, history) ──
function NoteDetail({note,subjects,notes,addSubject,editNote,patchNote,removeNote,toggleConn,doRecall,open,onClose,scheduleBlock,addToToday,ping,F,SER,fld,lbl,obtn,subjName,subjColor}){
  const [connQ,setConnQ]=useState('')
  const [cardQ,setCardQ]=useState(''),[cardA,setCardA]=useState('')
  const [tagIn,setTagIn]=useState('')
  if(!note) return null
  const due=recallDue(note)
  const connected=(note.connections||[]).map(id=>notes.find(n=>n.id===id)).filter(Boolean)
  const candidates=notes.filter(n=>n.id!==note.id&&!(note.connections||[]).includes(n.id)&&connQ.trim()&&(n.title||'').toLowerCase().includes(connQ.toLowerCase())).slice(0,6)
  const addCard=()=>{ if(!cardQ.trim())return; editNote(note.id,{cards:[...(note.cards||[]),{id:uid('c'),q:cardQ.trim(),a:cardA.trim()}]}); setCardQ('');setCardA('') }
  const addTag=()=>{ const t=tagIn.trim().replace(/^#/,''); if(!t)return; if(!(note.tags||[]).includes(t))editNote(note.id,{tags:[...(note.tags||[]),t]}); setTagIn('') }
  const addHighlight=()=>{ const sel=(window.getSelection&&window.getSelection().toString().trim())||''; if(!sel){ping('Select text in the note first');return} editNote(note.id,{highlights:[...(note.highlights||[]),sel]}); ping('Highlighted') }
  const sec={marginBottom:18}
  const histLine=(k,v)=>(<div style={{display:'flex',justifyContent:'space-between',fontFamily:F,fontSize:11.5,color:'var(--muted)',padding:'4px 0'}}><span style={{color:'var(--dim)'}}>{k}</span><span>{v}</span></div>)

  return(
    <div className="modal-wrap" style={{position:'fixed',inset:0,zIndex:2500,background:'rgba(10,7,4,0.8)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal-card" style={{width:640,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto',background:'var(--surface)',border:`1px solid var(--border2)`,borderRadius:12,boxShadow:'var(--card-shadow-sel)',animation:'modalIn 0.2s ease'}}>
        <div style={{padding:'18px 20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:16}}>{TYPE_ICON[note.type]||'✎'}</span>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <span onClick={()=>patchNote(note.id,{favorite:!note.favorite})} title="Favorite" style={{cursor:'pointer',color:note.favorite?'var(--amber)':'var(--dim)',fontSize:17}}>★</span>
              <span onClick={()=>patchNote(note.id,{bookmarked:!note.bookmarked})} title="Bookmark" style={{cursor:'pointer',color:note.bookmarked?'var(--blue)':'var(--dim)',fontSize:15}}>⚑</span>
              <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',fontSize:20,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
          </div>

          {/* recall prompt */}
          {due&&(note.cards||[]).length>=0&&<div style={{background:'var(--blueDim)',border:`1px solid var(--border2)`,borderRadius:10,padding:'12px 14px',marginBottom:16}}>
            <div style={{fontFamily:SER,fontSize:14,fontWeight:600,color:'var(--text)'}}>Can you still explain this?</div>
            <div style={{fontFamily:F,fontSize:11,color:'var(--muted)',margin:'3px 0 10px'}}>Last recall {agoLabel(note.lastReviewed)}. Try it from memory before reading.</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{doRecall(note.id,false);ping('Reset')}} style={obtn('var(--red)')}>Forgot</button>
              <button onClick={()=>{doRecall(note.id,true);ping('Locked in 🔒')}} style={obtn('var(--green)')}>Still got it</button>
            </div>
          </div>}

          <input value={note.title} onChange={e=>editNote(note.id,{title:e.target.value})} placeholder="Title" style={{...fld,fontFamily:SER,fontSize:19,fontWeight:600,border:'none',background:'transparent',padding:'2px 0',marginBottom:8}}/>

          {/* organize: subject + topic */}
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <select value={note.subjectId||''} onChange={e=>{ const v=e.target.value; if(v==='__new'){ const nm=ask('New subject'); if(nm){ const id=addSubject(nm); editNote(note.id,{subjectId:id,inbox:false}) } } else editNote(note.id,{subjectId:v||null,inbox:v?false:note.inbox}) }} style={{...fld,flex:1,minWidth:140}}>
              <option value="">— subject —</option>
              {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__new">+ new subject…</option>
            </select>
            <input value={note.topic} onChange={e=>editNote(note.id,{topic:e.target.value})} placeholder="topic (e.g. SQL Joins)" style={{...fld,flex:1,minWidth:140}}/>
          </div>
          {note.inbox&&<div style={{fontFamily:F,fontSize:11,color:'var(--amber)',marginBottom:14,marginTop:-8}}>↑ pick a subject to file this out of your inbox</div>}

          {/* media */}
          {note.type==='image'&&note.dataUrl&&<img src={note.dataUrl} alt="" style={{maxWidth:'100%',borderRadius:8,marginBottom:14}}/>}
          {note.type==='pdf'&&note.dataUrl&&<div style={{marginBottom:14}}><iframe src={note.dataUrl} style={{width:'100%',height:320,border:`1px solid var(--border)`,borderRadius:8}} title="pdf"/></div>}
          {note.type==='voice'&&note.dataUrl&&<audio src={note.dataUrl} controls style={{width:'100%',marginBottom:14}}/>}
          {note.type==='link'&&note.url&&<a href={note.url} target="_blank" rel="noreferrer" style={{display:'inline-block',fontFamily:F,fontSize:12,color:'var(--blue)',marginBottom:14,wordBreak:'break-all'}}>{note.url} ↗</a>}

          {/* body */}
          <div style={sec}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={lbl}>Note</span>
              <button onClick={addHighlight} style={{background:'none',border:'none',color:'var(--amber)',fontSize:11,cursor:'pointer',marginBottom:6}}>★ highlight selection</button>
            </div>
            <textarea value={note.body} onChange={e=>editNote(note.id,{body:e.target.value})} placeholder="Write it in your own words — that's where understanding starts." rows={5} style={fld}/>
            {(note.highlights||[]).length>0&&<div style={{marginTop:10}}>
              {note.highlights.map((h,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'flex-start',background:'var(--amberGlow)',borderLeft:`3px solid var(--amber)`,borderRadius:'0 6px 6px 0',padding:'7px 10px',marginBottom:5}}>
                <span style={{flex:1,fontFamily:F,fontSize:12.5,color:'var(--text)'}}>{h}</span>
                <span onClick={()=>editNote(note.id,{highlights:note.highlights.filter((_,j)=>j!==i)})} style={{cursor:'pointer',color:'var(--dim)',fontSize:13}}>×</span>
              </div>)}
            </div>}
          </div>

          {/* tags */}
          <div style={sec}>
            <span style={lbl}>Tags</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {(note.tags||[]).map(t=><span key={t} style={{fontFamily:F,fontSize:11,background:'var(--surface2)',border:`1px solid var(--border)`,borderRadius:20,padding:'3px 9px',color:'var(--muted)'}}>#{t} <span onClick={()=>editNote(note.id,{tags:note.tags.filter(x=>x!==t)})} style={{cursor:'pointer',color:'var(--dim)'}}>×</span></span>)}
              <input value={tagIn} onChange={e=>setTagIn(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addTag()}} placeholder="+ tag" style={{...fld,width:90,padding:'5px 9px',fontSize:11}}/>
            </div>
          </div>

          {/* track understanding + confidence */}
          <div style={{display:'flex',gap:20,flexWrap:'wrap',marginBottom:18}}>
            <div><span style={lbl}>How well do I get this?</span><Stars value={note.understanding||0} onChange={v=>patchNote(note.id,{understanding:v})}/></div>
            <div><span style={lbl}>Confidence (I decide)</span>
              <div style={{display:'flex',gap:6}}>{['high','med','low'].map(c=><button key={c} onClick={()=>patchNote(note.id,{confidence:note.confidence===c?null:c})} style={{fontFamily:F,fontSize:11,fontWeight:600,padding:'6px 11px',borderRadius:7,cursor:'pointer',border:`1px solid ${note.confidence===c?CONF[c].color:'var(--border)'}`,background:note.confidence===c?'var(--surface2)':'transparent',color:note.confidence===c?CONF[c].color:'var(--muted)'}}>{CONF[c].label}</button>)}</div>
            </div>
          </div>

          {/* test yourself: cards */}
          <div style={sec}>
            <span style={lbl}>Test yourself — Q&amp;A cards</span>
            {(note.cards||[]).map(c=><div key={c.id} style={{background:'var(--surface2)',border:`1px solid var(--border)`,borderRadius:8,padding:'9px 11px',marginBottom:6}}>
              <div style={{fontFamily:F,fontSize:12.5,fontWeight:600,color:'var(--text)'}}>Q: {c.q}</div>
              <div style={{fontFamily:F,fontSize:12.5,color:'var(--muted)',marginTop:2}}>A: {c.a}</div>
              <button onClick={()=>editNote(note.id,{cards:note.cards.filter(x=>x.id!==c.id)})} style={{background:'none',border:'none',color:'var(--dim)',fontSize:10,cursor:'pointer',marginTop:3}}>remove</button>
            </div>)}
            <input value={cardQ} onChange={e=>setCardQ(e.target.value)} placeholder="Question" style={{...fld,marginBottom:6}}/>
            <div style={{display:'flex',gap:6}}>
              <input value={cardA} onChange={e=>setCardA(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCard()}} placeholder="Answer" style={{...fld,flex:1}}/>
              <button onClick={addCard} style={obtn('var(--blue)')}>Add</button>
            </div>
          </div>

          {/* connect */}
          <div style={sec}>
            <span style={lbl}>Connected notes</span>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              {connected.length===0&&<span style={{fontFamily:F,fontSize:11,color:'var(--dim)'}}>nothing linked yet</span>}
              {connected.map(c=><span key={c.id} onClick={()=>open(c.id)} style={{fontFamily:F,fontSize:11.5,background:'var(--surface2)',border:`1px solid ${subjColor(c.subjectId)}`,borderRadius:20,padding:'4px 10px',color:'var(--text)',cursor:'pointer'}}>{c.title} <span onClick={e=>{e.stopPropagation();toggleConn(note.id,c.id)}} style={{color:'var(--dim)'}}>×</span></span>)}
            </div>
            <input value={connQ} onChange={e=>setConnQ(e.target.value)} placeholder="Link another note — search its title…" style={fld}/>
            {candidates.map(c=><div key={c.id} onClick={()=>{toggleConn(note.id,c.id);setConnQ('')}} style={{fontFamily:F,fontSize:12.5,padding:'7px 10px',cursor:'pointer',color:'var(--muted)',borderBottom:`1px solid var(--border)`}}>+ {c.title}</div>)}
          </div>

          {/* connect to the rest of FORGE */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:18}}>
            <button onClick={()=>{addToToday('Review: '+note.title);ping('Added to Today →')}} style={obtn('var(--muted)')}>+ Review in Today</button>
            <button onClick={()=>{scheduleBlock({title:'Review: '+note.title,color:'blue'});ping('Scheduled →')}} style={obtn('var(--blue)')}>◷ Schedule review</button>
          </div>

          {/* history */}
          <div style={{borderTop:`1px solid var(--border)`,paddingTop:12,marginBottom:14}}>
            <span style={lbl}>History</span>
            {histLine('Created',agoLabel(note.created))}
            {histLine('Last updated',agoLabel(note.updated))}
            {histLine('Last recalled',agoLabel(note.lastReviewed))}
            {histLine('Last tested',agoLabel(note.lastTested))}
            {histLine('Next recall due', note.recallDueAt?(recallDue(note)?'now':agoLabel(note.recallDueAt).replace(' ago',' from now').replace('today','soon')):'after first recall')}
          </div>

          <button onClick={()=>{ if(confirmSafe('Delete this note?')){removeNote(note.id);onClose()} }} style={{background:'none',border:'none',color:'var(--dim)',fontSize:11,cursor:'pointer'}}>delete note</button>
        </div>
      </div>
    </div>
  )
}

// ── AVOIDING ──────────────────────────────────────────────────────────────────
function AvoidingView({avoiding,setAvoiding,scheduleBlock,addToToday}){
  const [text,setText]=useState('')
  const [showFaced,setShowFaced]=useState(false)
  const [flash,setFlash]=useState(null)
  const ping=msg=>{ setFlash(msg); setTimeout(()=>setFlash(null),1800) }
  const active=avoiding.filter(a=>!a.done)
  const faced=avoiding.filter(a=>a.done).sort((a,b)=>(b.facedAt||0)-(a.facedAt||0))
  const add=()=>{ const t=text.trim(); if(!t)return; setAvoiding([{id:uid('av'),text:t,why:'',step:'',created:Date.now(),done:false},...avoiding]); setText('') }
  const patch=(id,p)=>setAvoiding(avoiding.map(a=>a.id===id?{...a,...p}:a))
  const face=id=>setAvoiding(avoiding.map(a=>a.id===id?{...a,done:true,facedAt:Date.now()}:a))
  const unface=id=>setAvoiding(avoiding.map(a=>a.id===id?{...a,done:false,facedAt:null}:a))
  const del=id=>setAvoiding(avoiding.filter(a=>a.id!==id))
  const daysSince=ts=>Math.floor((Date.now()-(ts||Date.now()))/86400000)
  const ageChip=d=>{ const c=d>=14?C.red:d>=4?C.amber:C.muted; const txt=d<=0?'today':d===1?'1 day':d+' days'; return <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:10,color:c,whiteSpace:'nowrap',border:`1px solid ${c}`,borderRadius:20,padding:'2px 9px',opacity:0.9}}>sitting {txt}</span> }
  const lbl={fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',color:C.dim,marginBottom:5,display:'block'}
  const field={width:'100%',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:13,padding:'9px 11px',outline:'none',fontFamily:"'Inter',-apple-system,system-ui,sans-serif",resize:'vertical'}

  return(
    <div style={{maxWidth:760,margin:'0 auto',animation:'fadeUp 0.3s ease'}}>
      {flash&&<div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',zIndex:2000,background:C.surface3,border:`1px solid ${C.border2}`,borderRadius:20,padding:'9px 18px',fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12,color:C.text,boxShadow:'var(--card-shadow-sel)',animation:'fadeUp 0.2s ease'}}>{flash}</div>}
      <div style={{marginBottom:20}}>
        <h1 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:'clamp(24px,4vw,32px)',fontWeight:600,color:C.text,lineHeight:1.1}}>What am I avoiding?</h1>
        <p style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:13,color:C.muted,marginTop:8,maxWidth:560,lineHeight:1.5}}>The thing you keep sliding past is usually the thing. Name it here — not to feel bad, but so it stops running you from the shadows. Naming it is half the battle.</p>
      </div>

      <Panel style={{padding:'16px 18px',marginBottom:18}}>
        <span style={lbl}>Name something you&rsquo;re dodging</span>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add()}}
            placeholder="the call I haven't made, the email, the gym, the hard conversation..."
            style={{...field,flex:1,minWidth:200}}/>
          <button onClick={add} style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:13,fontWeight:600,padding:'9px 18px',borderRadius:7,cursor:'pointer',border:`1px solid ${C.blue}`,background:C.blueDim,color:C.blue,whiteSpace:'nowrap'}}>Name it</button>
        </div>
      </Panel>

      <div style={{display:'flex',alignItems:'baseline',gap:8,margin:'0 2px 12px'}}>
        <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:600,color:C.text}}>On the table</span>
        <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12,color:C.muted}}>{active.length}</span>
      </div>

      {active.length===0?(
        <Panel style={{padding:'30px 20px',textAlign:'center'}}>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:14,color:C.muted}}>Nothing named right now.</div>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12,color:C.dim,marginTop:6,lineHeight:1.5}}>That&rsquo;s either real freedom or quiet denial. You know which. When something starts nagging, put it up here before it grows.</div>
        </Panel>
      ):active.map(a=>{
        const d=daysSince(a.created)
        return(
          <Panel key={a.id} style={{padding:'16px 18px',marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14}}>
              <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:17,fontWeight:600,color:C.text,lineHeight:1.25}}>{a.text}</div>
              {ageChip(d)}
            </div>
            <div style={{marginBottom:12}}>
              <span style={lbl}>Why am I really dodging it?</span>
              <textarea value={a.why} onChange={e=>patch(a.id,{why:e.target.value})} rows={2}
                placeholder="fear, boredom, don't know how to start, shame, it's boring..." style={field}/>
            </div>
            <div style={{marginBottom:14}}>
              <span style={lbl}>The smallest possible first step</span>
              <input value={a.step} onChange={e=>patch(a.id,{step:e.target.value})}
                placeholder="open the doc. send one line. put on shoes. 5 minutes." style={field}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>del(a.id)} style={{background:'none',border:'none',color:C.dim,fontSize:11,cursor:'pointer',padding:'4px 0'}}>remove</button>
              <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                <button onClick={()=>{ addToToday((a.step&&a.step.trim())?a.step.trim():a.text); ping('Added to Today →') }}
                  style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11.5,fontWeight:600,padding:'7px 12px',borderRadius:7,cursor:'pointer',border:`1px solid ${C.border2}`,background:'transparent',color:C.muted}}>+ Do today</button>
                <button onClick={()=>{ scheduleBlock({title:'Face: '+a.text,desc:a.step||a.why||'',color:'amber'}); ping('Scheduled on Calendar →') }}
                  style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11.5,fontWeight:600,padding:'7px 12px',borderRadius:7,cursor:'pointer',border:`1px solid ${C.amber}`,background:'transparent',color:C.amber}}>◷ Schedule it</button>
                <button onClick={()=>face(a.id)} style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11.5,fontWeight:600,padding:'7px 14px',borderRadius:7,cursor:'pointer',border:`1px solid ${C.green}`,background:'transparent',color:C.green,transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=C.green;e.currentTarget.style.color='#15120e'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.green}}>✓ I faced it</button>
              </div>
            </div>
          </Panel>
        )
      })}

      {faced.length>0&&(
        <div style={{marginTop:22}}>
          <button onClick={()=>setShowFaced(s=>!s)} style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:8,padding:'4px 2px'}}>
            <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:600,color:C.green}}>Faced</span>
            <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12,color:C.muted}}>{faced.length}</span>
            <span style={{color:C.dim,fontSize:11}}>{showFaced?'▲':'▼'}</span>
          </button>
          <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,color:C.dim,margin:'2px 2px 10px'}}>Every one of these is a thing you stopped running from.</div>
          {showFaced&&faced.map(a=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',marginBottom:7}}>
              <span style={{color:C.green,fontSize:13}}>✓</span>
              <span style={{flex:1,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:13,color:C.muted,textDecoration:'line-through',textDecorationColor:C.dim}}>{a.text}</span>
              <button onClick={()=>unface(a.id)} title="Back on the table" style={{background:'none',border:'none',color:C.dim,fontSize:11,cursor:'pointer'}}>undo</button>
              <button onClick={()=>del(a.id)} title="Delete" style={{background:'none',border:'none',color:C.dim,fontSize:13,cursor:'pointer'}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
function useIsMobile(){
  const [m,setM]=useState(typeof window!=='undefined'&&window.innerWidth<=760)
  useEffect(()=>{ const f=()=>setM(window.innerWidth<=760); window.addEventListener('resize',f); return()=>window.removeEventListener('resize',f) },[])
  return m
}
const NAV=[['calendar','Calendar','01'],['today','Today','02'],['study','Study','03'],['avoiding','Avoiding','04'],['intel','Looking Back','05'],['vision','Vision','06'],['journal','Journal','07']]

export default function App(){
  const [booting,setBooting]=useState(true)
  const [ready,setReady]=useState(false)
  const [view,setView]=useState('calendar')
  const [data,setData]=useState(loadData)
  const [events,setEvents]=useState(loadEvents)
  const [weekOffset,setWeekOffset]=useState(0)
  const [theme,setThemeState]=useState(loadTheme)
  const [vision,setVision]=useState(()=>{ const v=loadVision(); return v?{...DEFAULT_VISION,...v}:DEFAULT_VISION })
  const [name,setNameState]=useState(loadName)
  const [editingName,setEditingName]=useState(false)
  const [avoiding,setAvoiding]=useState(loadAvoiding)
  useEffect(()=>{ saveAvoiding(avoiding) },[avoiding])
  const [study,setStudy]=useState(()=>{ const s=loadStudy(); return s?{...DEFAULT_STUDY,...s}:DEFAULT_STUDY })
  useEffect(()=>{ saveStudy(study) },[study])
  const setName=n=>{ setNameState(n); saveName(n) }

  const setTheme=t=>{ setThemeState(t); saveTheme(t) }

  // ── cross-feature wiring: everything connects ──
  const scheduleBlock=({title,desc='',dow,startH=9,color='amber'})=>{
    const d=(typeof dow==='number')?dow:((new Date().getDay()+1)%7)
    setEvents(prev=>{ const next=[...prev,{id:'e_'+Date.now()+'_'+Math.round(Math.random()*999),title,desc,color,startH,startM:0,endH:Math.min(startH+1,23),endM:0,dayOfWeek:d,allDay:false,repeat:'none'}]; saveEvents(next); return next })
  }
  const addToToday=text=>{
    setData(prev=>{ const k=todayKey(); const dd=prev[k]||{done:{},notes:'',personal:[]}; const next={...prev,[k]:{...dd,personal:[...(dd.personal||[]),{id:'p_'+Date.now()+'_'+Math.round(Math.random()*999),text,done:false}]}}; saveData(next); return next })
  }

  const streak=useMemo(()=>computeStreak(data,events),[data,events])
  const studyDue=useMemo(()=>(study.notes||[]).filter(n=>!n.inbox&&recallDue(n)).length,[study])

  // Mandatory nightly journal: after 9 PM, a ≥150-word entry for today is required.
  const journalDue=(()=>{ const n=new Date(); const done=(vision.journal||[]).some(e=>e.date===todayKey()&&wordCount(e.text)>=150); return n.getHours()>=21&&!done })()
  const isMobile=useIsMobile()

  return(
    <>
      <style>{CSS}</style>
      {booting&&<BootScreen onDone={()=>{setBooting(false);setReady(true)}}/>}
      <div className="app-root" data-theme={theme}>
        <Background/>

        {/* ── mobile top bar ── */}
        <div className="topbar-m">
          <Ember size={24} color={C.blue} glow/>
          <span style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:17,fontWeight:600,letterSpacing:'0.14em',color:C.text}}>FORGE</span>
          {name&&<span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,color:C.dim}}>· {name}</span>}
          <div style={{flex:1}}/>
          <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:12,color:streak>0?C.amber:C.dim,fontWeight:600}}>🔥 {streak}</span>
          <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Theme"
            style={{background:'none',border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,fontSize:15,width:36,height:36,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{theme==='dark'?'☀️':'🌙'}</button>
        </div>

        <div style={{display:'flex',minHeight:'100vh',position:'relative',zIndex:1,opacity:ready?1:0,transition:'opacity 0.5s ease'}}>
          {/* ── sidebar (desktop) ── */}
          <nav className="only-desktop" style={{width:220,flexShrink:0,background:'var(--surface)',borderRight:`1px solid ${C.border}`,padding:'24px 12px',display:'flex',flexDirection:'column',gap:2,position:'sticky',top:0,height:'100vh',zIndex:10,backdropFilter:'blur(16px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:26,paddingLeft:8}}>
              <div style={{animation:'glowPulse 7s ease-in-out infinite'}}><Ember size={30} color={C.blue} glow/></div>
              <div style={{minWidth:0}}>
                <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:20,fontWeight:600,color:C.text,lineHeight:1,letterSpacing:'0.14em'}}>FORGE</div>
                {editingName?(
                  <input autoFocus value={name} onChange={e=>setName(e.target.value)} onBlur={()=>setEditingName(false)}
                    onKeyDown={e=>{if(e.key==='Enter')setEditingName(false)}} placeholder="your name"
                    style={{marginTop:4,width:'100%',background:'transparent',border:'none',borderBottom:`1px solid ${C.border2}`,color:C.muted,fontSize:10,fontFamily:"'Inter',-apple-system,system-ui,sans-serif",outline:'none',padding:'1px 0'}}/>
                ):(
                  <div onClick={()=>setEditingName(true)} title="Click to set your name"
                    style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,letterSpacing:'0.08em',marginTop:4,cursor:'pointer'}}>
                    {name?`${name} · made, not born`:'set your name ✎'}
                  </div>
                )}
              </div>
            </div>
            {NAV.map(([id,label,code])=>(
              <NavItem key={id} code={code} label={label} active={view===id} onClick={()=>setView(id)} badge={(id==='journal'&&journalDue)||(id==='study'&&studyDue>0)}/>
            ))}

            <div style={{marginTop:16}}><ThemeToggle theme={theme} setTheme={setTheme}/></div>

            <div style={{marginTop:'auto',paddingTop:12}}>
              <div style={{background:C.surface,border:`1px solid ${streak>0?C.border2:C.border}`,borderRadius:8,padding:'16px 12px',textAlign:'center',position:'relative',boxShadow:streak>0?'var(--card-shadow)':'none'}}>
                <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:42,fontWeight:600,color:C.amber,lineHeight:1,textShadow:streak>0?`0 0 22px ${C.amberGlow}`:'none'}}>{streak}</div>
                <div style={{fontSize:18,margin:'4px 0 2px'}}>🔥</div>
                <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:C.muted,letterSpacing:'0.14em',textTransform:'uppercase'}}>days showing up</div>
                <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,marginTop:8,color:streak>0?C.amber:C.dim}}>{streak>0?"don't break the chain":'today can be day one'}</div>
              </div>
            </div>
          </nav>

          {/* ── main ── */}
          <main className="main-pad" style={{flex:1,minWidth:0,padding:'28px 40px',overflowX:'hidden'}}>
            {view==='calendar' &&<WeeklyCalendar weekOffset={weekOffset} setWeekOffset={setWeekOffset} events={events} onEventsChange={setEvents} isMobile={isMobile} theme={theme}/>}
            {view==='today'    &&<TodayView data={data} setData={setData} events={events} study={study} setStudy={setStudy} setView={setView}/>}
            {view==='study'    &&<StudyView study={study} setStudy={setStudy} scheduleBlock={scheduleBlock} addToToday={addToToday} isMobile={isMobile}/>}
            {view==='avoiding' &&<AvoidingView avoiding={avoiding} setAvoiding={setAvoiding} scheduleBlock={scheduleBlock} addToToday={addToToday}/>}
            {view==='intel'    &&<IntelView data={data}/>}
            {view==='vision'   &&<VisionBoard vision={vision} setVision={setVision} theme={theme}/>}
            {view==='journal'  &&<JournalView vision={vision} setVision={setVision}/>}
          </main>
        </div>

        {/* ── bottom nav (mobile) ── */}
        <div className="bottom-nav">
          {NAV.map(([id,label])=>{
            const active=view===id
            const short={calendar:'Plan',today:'Today',study:'Study',avoiding:'Avoid',intel:'Back',vision:'Vision',journal:'Log'}[id]||label
            return(
              <button key={id} onClick={()=>setView(id)}>
                <div style={{width:5,height:5,borderRadius:'50%',background:active?C.blue:'transparent',boxShadow:active?`0 0 7px ${C.blueGlow}`:'none',transition:'all 0.15s'}}/>
                <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:active?C.blue:C.muted,fontWeight:active?600:400,letterSpacing:'0.01em',whiteSpace:'nowrap'}}>{short}</span>
                {((id==='journal'&&journalDue)||(id==='study'&&studyDue>0))&&!active&&<div style={{position:'absolute',top:4,right:'22%',width:6,height:6,borderRadius:'50%',background:C.red,boxShadow:`0 0 6px ${C.red}`,animation:'dotPulse 1.6s ease-in-out infinite'}}/>}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function computeStreak(data,events){
  const today=new Date()
  let streak=0
  for(let i=0;i<365;i++){
    const d=new Date(today);d.setDate(today.getDate()-i)
    const k=d.toISOString().slice(0,10)
    const dow=d.getDay()
    const dd=data[k]
    const dayEvs=events.filter(ev=>!ev.allDay&&(ev.repeat==='daily'||(ev.repeat==='weekly'&&ev.dayOfWeek===dow)||(ev.repeat==='weekdays'&&dow>=1&&dow<=5)||(ev.repeat==='none'&&ev.dayOfWeek===dow)))
    if(dayEvs.length===0){if(i===0)continue;break}
    if(!dd||!dayEvs.every(ev=>dd.done?.[ev.id])){if(i===0)continue;break}
    streak++
  }
  return streak
}

// ════════════════════════════════════════════════════════════════════════════════
// DAILY STOIC DISPATCH + JOURNAL (with mandatory nightly reflection)
// ════════════════════════════════════════════════════════════════════════════════
// Quotes below are from the original Stoics (Marcus Aurelius, Seneca, Epictetus,
// Zeno) in long-established public-domain phrasings — not from any copyrighted
// edition. One is selected per calendar day so it changes daily.
const STOIC_QUOTES=[
  {q:"You have power over your mind, not outside events. Realize this, and you will find strength.",a:"Marcus Aurelius"},
  {q:"We suffer more often in imagination than in reality.",a:"Seneca"},
  {q:"Men are disturbed not by things, but by the views which they take of things.",a:"Epictetus"},
  {q:"Waste no more time arguing about what a good man should be. Be one.",a:"Marcus Aurelius"},
  {q:"It is not that we have a short time to live, but that we waste much of it.",a:"Seneca"},
  {q:"No man is free who is not master of himself.",a:"Epictetus"},
  {q:"The happiness of your life depends upon the quality of your thoughts.",a:"Marcus Aurelius"},
  {q:"Difficulties strengthen the mind, as labor does the body.",a:"Seneca"},
  {q:"Wealth consists not in having great possessions, but in having few wants.",a:"Epictetus"},
  {q:"Confine yourself to the present.",a:"Marcus Aurelius"},
  {q:"While we are postponing, life speeds by.",a:"Seneca"},
  {q:"The best revenge is not to be like your enemy.",a:"Marcus Aurelius"},
  {q:"First say to yourself what you would be, and then do what you have to do.",a:"Epictetus"},
  {q:"As long as you live, keep learning how to live.",a:"Seneca"},
  {q:"If it is not right, do not do it; if it is not true, do not say it.",a:"Marcus Aurelius"},
  {q:"Make the best use of what is in your power, and take the rest as it happens.",a:"Epictetus"},
  {q:"Very little is needed to make a happy life; it is all within yourself, in your way of thinking.",a:"Marcus Aurelius"},
  {q:"Begin at once to live, and count each separate day as a separate life.",a:"Seneca"},
  {q:"He is a wise man who does not grieve for what he has not, but rejoices for what he has.",a:"Epictetus"},
  {q:"Dwell on the beauty of life. Watch the stars, and see yourself running with them.",a:"Marcus Aurelius"},
  {q:"A gem cannot be polished without friction, nor a man perfected without trials.",a:"Seneca"},
  {q:"How much trouble he avoids who does not look to see what his neighbor says or does.",a:"Marcus Aurelius"},
  {q:"If a man knows not to which port he sails, no wind is favorable.",a:"Seneca"},
  {q:"Only the educated are free.",a:"Epictetus"},
  {q:"The soul becomes dyed with the color of its thoughts.",a:"Marcus Aurelius"},
  {q:"Sometimes even to live is an act of courage.",a:"Seneca"},
  {q:"Loss is nothing else but change, and change is Nature's delight.",a:"Marcus Aurelius"},
  {q:"It is impossible to begin to learn that which one thinks one already knows.",a:"Epictetus"},
  {q:"Accept the things to which fate binds you, and love the people with whom fate brings you together.",a:"Marcus Aurelius"},
  {q:"True happiness is to enjoy the present, without anxious dependence upon the future.",a:"Seneca"},
  {q:"We have two ears and one mouth, so we should listen more than we say.",a:"Zeno of Citium"},
  {q:"Look well into thyself; there is a source of strength which will always spring up if thou wilt always look.",a:"Marcus Aurelius"},
  {q:"When you arise in the morning, think of what a privilege it is to be alive, to think, to enjoy, to love.",a:"Marcus Aurelius"},
  {q:"He who is brave is free.",a:"Seneca"},
]
const wordCount=s=>((s||'').trim().match(/\S+/g)||[]).length
const dayOfYear=(d=new Date())=>{const s=new Date(d.getFullYear(),0,0);return Math.floor((d-s)/86400000)}
const dailyQuote=()=>STOIC_QUOTES[dayOfYear()%STOIC_QUOTES.length]

function DailyQuote({style={}}){
  const {q,a}=dailyQuote()
  return(
    <div style={{position:'relative',background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.amber}`,borderRadius:4,padding:'14px 18px 14px 20px',boxShadow:'var(--card-shadow)',...style}}>
      <Corners color={C.amber} opacity={0.35}/>
      <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:7,letterSpacing:'0.2em',color:C.amber,marginBottom:8}}>FROM THE STOICS · {new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase()}</div>
      <div style={{fontSize:15,lineHeight:1.55,color:C.text,fontStyle:'italic'}}>&ldquo;{q}&rdquo;</div>
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:10,color:C.muted,letterSpacing:'0.08em',marginTop:9}}>— {a.toUpperCase()}</div>
    </div>
  )
}

// ── JOURNAL VIEW (top-level; mandatory ≥150 words after 9 PM) ────────────────────
function JournalView({vision,setVision}){
  const entries=vision.journal||[]
  const setV=v=>{ setVision(v); saveVision(v) }
  const [txt,setTxt]=useState('')
  const MIN=150
  const now=new Date()
  const after9=now.getHours()>=21
  const todayDone=entries.some(e=>e.date===todayKey()&&wordCount(e.text)>=MIN)
  const gated=after9&&!todayDone
  const wc=wordCount(txt)
  const meets=wc>=MIN
  const canSave=gated?meets:wc>0

  const add=()=>{
    const v=txt.trim(); if(!v)return
    if(gated&&!meets)return
    setV({...vision,journal:[{id:uid('j'),date:todayKey(),text:v,words:wc},...entries]}); setTxt('')
  }
  const del=id=>setV({...vision,journal:entries.filter(e=>e.id!==id)})

  const counterColor=meets?C.green:(gated?C.red:C.muted)
  const progress=Math.min(100,Math.round((wc/MIN)*100))

  return(
    <div style={{animation:'fadeUp 0.3s ease',maxWidth:700}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
        <Ember size={24} color={C.blue} glow/>
        <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:18,fontWeight:700,letterSpacing:'0.05em'}}>Journal</div>
        <LiveClock/>
        {todayDone&&<span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.green,letterSpacing:'0.1em',border:`1px solid ${C.green}`,borderRadius:3,padding:'2px 8px'}}>✓ TODAY LOGGED</span>}
      </div>
      <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.muted,marginBottom:16,letterSpacing:'0.1em'}}>END THE DAY HONEST. EVEN WHEN IT WAS A BAD ONE.</div>

      <DailyQuote style={{marginBottom:16}}/>

      {gated&&(
        <div style={{background:'rgba(248,113,113,0.08)',border:`1px solid ${C.red}`,borderRadius:4,padding:'12px 16px',marginBottom:12,position:'relative'}}>
          <div style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,color:C.red,letterSpacing:'0.16em',marginBottom:5}}>⚠ NIGHTLY REFLECTION REQUIRED</div>
          <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>It is after 9 PM. Before you close out the day, write at least {MIN} words about how it actually went — wins, failures, what you will do differently. No entry is logged until you hit {MIN}.</div>
        </div>
      )}

      <div style={{background:C.surface,border:`1px solid ${gated?(meets?C.green:C.border2):C.border}`,borderRadius:6,position:'relative',overflow:'hidden',marginBottom:gated&&!todayDone?20:24,boxShadow:'var(--card-shadow)'}}>
        <Corners color={gated?(meets?C.green:C.red):C.dim} opacity={gated?0.6:0.25}/>
        <textarea value={txt} onChange={e=>setTxt(e.target.value)} rows={gated?12:6}
          placeholder={gated?"Today I...":"What happened today? What did you learn?"}
          style={{width:'100%',background:'transparent',border:'none',padding:'14px 16px',color:C.text,fontSize:14,lineHeight:1.7,resize:'vertical',minHeight:gated?220:120,outline:'none',display:'block'}}/>
        <div style={{height:3,background:C.surface3,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${progress}%`,background:meets?C.green:gated?C.red:C.blue,transition:'width 0.3s ease,background 0.3s ease'}}/>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderTop:`1px solid ${C.border}`}}>
          <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:11,color:counterColor,letterSpacing:'0.06em'}}>
            {wc} / {MIN} words {meets?'✓':gated?`· ${MIN-wc} to go`:''}
          </span>
          <button onClick={add} disabled={!canSave}
            style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:9,letterSpacing:'0.1em',padding:'8px 18px',borderRadius:3,cursor:canSave?'pointer':'not-allowed',
              border:`1px solid ${canSave?(gated?C.green:C.blue):C.border}`,background:canSave?(gated?'rgba(52,211,153,0.12)':C.blueDim):'transparent',color:canSave?(gated?C.green:C.blue):C.dim,transition:'all 0.15s',opacity:canSave?1:0.6}}>
            {gated?'LOCK IN TODAY\u2019S ENTRY':'ADD ENTRY'}
          </button>
        </div>
      </div>

      {gated&&!todayDone?(
        <div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim,letterSpacing:'0.1em',padding:'2px'}}>↓ PAST ENTRIES UNLOCK ONCE TONIGHT&rsquo;S REFLECTION IS LOGGED.</div>
      ):(
        entries.length===0?(
          <Panel style={{padding:'30px',textAlign:'center'}}><div style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.dim,letterSpacing:'0.1em'}}>NO ENTRIES YET</div></Panel>
        ):(
          entries.map(e=>(
            <div key={e.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:'12px 16px',marginBottom:8,position:'relative',boxShadow:'var(--card-shadow)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:9,color:C.blue,letterSpacing:'0.1em'}}>{new Date(e.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'}).toUpperCase()}</span>
                <span style={{fontFamily:"'Inter',-apple-system,system-ui,sans-serif",fontSize:8,color:(e.words||wordCount(e.text))>=MIN?C.green:C.dim}}>{e.words||wordCount(e.text)} words</span>
              </div>
              <div style={{fontSize:14,color:C.text,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{e.text}</div>
              <button onClick={()=>del(e.id)} title="Delete" style={{position:'absolute',top:10,right:12,background:'none',border:'none',color:C.dim,cursor:'pointer',fontSize:15}} onMouseEnter={ev=>ev.currentTarget.style.color=C.red} onMouseLeave={ev=>ev.currentTarget.style.color=C.dim}>×</button>
            </div>
          ))
        )
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// CALENDAR EXPORT (.ics) — so your phone's own calendar alarms you
// ════════════════════════════════════════════════════════════════════════════════
const loadLead=()=>{ try{ const v=Number(localStorage.getItem('hud_alert_lead')); return Number.isFinite(v)?v:10 }catch{ return 10 } }
const saveLead=v=>{ try{ localStorage.setItem('hud_alert_lead',String(v)) }catch{} }

function downloadText(name,text,mime){
  try{
    const blob=new Blob([text],{type:(mime||'text/plain')+';charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click()
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove() },200)
  }catch(e){ try{ alert('Could not export here. Open the app in your own browser and try again.\n('+e.message+')') }catch{} }
}

const ICS_DOW=['SU','MO','TU','WE','TH','FR','SA']
const _p2=n=>String(n).padStart(2,'0')
const icsLocal=d=>`${d.getFullYear()}${_p2(d.getMonth()+1)}${_p2(d.getDate())}T${_p2(d.getHours())}${_p2(d.getMinutes())}00`
const icsDay=d=>`${d.getFullYear()}${_p2(d.getMonth()+1)}${_p2(d.getDate())}`
const icsStamp=()=>new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')
const icsEsc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')
function icsFold(line){ if(line.length<=73)return line; let out='',s=line; while(s.length>73){ out+=s.slice(0,73)+'\r\n '; s=s.slice(73) } return out+s }
function nextDow(dow){ const t=new Date(); const diff=((dow??1)-t.getDay()+7)%7; const d=new Date(t); d.setDate(t.getDate()+diff); d.setHours(0,0,0,0); return d }
function icsStartDate(ev){
  if(ev.repeat==='daily'){ const d=new Date(); d.setHours(0,0,0,0); return d }
  if(ev.repeat==='weekdays'){ const t=new Date(); const d=new Date(t); d.setHours(0,0,0,0); const wd=t.getDay(); if(wd===0)d.setDate(d.getDate()+1); else if(wd===6)d.setDate(d.getDate()+2); return d }
  return nextDow(ev.dayOfWeek)
}
function icsRRule(ev){
  if(ev.repeat==='daily') return 'FREQ=DAILY'
  if(ev.repeat==='weekdays') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
  return 'FREQ=WEEKLY;BYDAY='+ICS_DOW[ev.dayOfWeek??1]
}
function buildICS(events,leadMin){
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FORGE//Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:FORGE — Schedule']
  const stamp=icsStamp()
  ;(events||[]).forEach(ev=>{
    const base=icsStartDate(ev)
    L.push('BEGIN:VEVENT')
    L.push('UID:'+(ev.id||('e_'+Math.random().toString(36).slice(2)))+'@forge-planner')
    L.push('DTSTAMP:'+stamp)
    L.push(icsFold('SUMMARY:'+icsEsc(ev.title||'Block')))
    if(ev.desc) L.push(icsFold('DESCRIPTION:'+icsEsc(ev.desc)))
    if(ev.allDay){
      const end=new Date(base); end.setDate(base.getDate()+1)
      L.push('DTSTART;VALUE=DATE:'+icsDay(base))
      L.push('DTEND;VALUE=DATE:'+icsDay(end))
      L.push('RRULE:'+icsRRule(ev))
      L.push('BEGIN:VALARM','ACTION:DISPLAY',icsFold('DESCRIPTION:'+icsEsc(ev.title||'Block')),'TRIGGER;RELATED=START:PT9H','END:VALARM')
    } else {
      const s=new Date(base); s.setHours(ev.startH||0,ev.startM||0,0,0)
      let e=new Date(base); e.setHours(ev.endH??((ev.startH||0)+1),ev.endM||0,0,0)
      if(e<=s) e=new Date(s.getTime()+30*60000)
      L.push('DTSTART:'+icsLocal(s))
      L.push('DTEND:'+icsLocal(e))
      L.push('RRULE:'+icsRRule(ev))
      const trig=(leadMin>0)?('-PT'+leadMin+'M'):'PT0S'
      L.push('BEGIN:VALARM','ACTION:DISPLAY',icsFold('DESCRIPTION:'+icsEsc(ev.title||'Block')),'TRIGGER:'+trig,'END:VALARM')
    }
    L.push('END:VEVENT')
  })
  L.push('END:VCALENDAR')
  return L.join('\r\n')+'\r\n'
}