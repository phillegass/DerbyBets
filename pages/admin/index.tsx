import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

const HORSES: Record<number, {number:number; name:string; color:string; odds:string}> = {
  1:  {number:1,  name:"Renegade",       color:"#1a5cb5", odds:"4-1"  },
  2:  {number:2,  name:"Albus",           color:"#2e7d32", odds:"30-1" },
  3:  {number:3,  name:"Intrepido",       color:"#6a1b9a", odds:"50-1" },
  4:  {number:4,  name:"Litmus Test",     color:"#c62828", odds:"30-1" },
  6:  {number:6,  name:"Commandment",     color:"#1565c0", odds:"6-1"  },
  7:  {number:7,  name:"Danon Bourbon",   color:"#bdbdbd", odds:"20-1" },
  8:  {number:8,  name:"So Happy",        color:"#f9a825", odds:"15-1" },
  10: {number:10, name:"Wonder Dean",     color:"#b71c1c", odds:"30-1" },
  11: {number:11, name:"Incredibolt",     color:"#388e3c", odds:"20-1" },
  12: {number:12, name:"Chief Wallabee",  color:"#1b5e20", odds:"8-1"  },
  14: {number:14, name:"Potente",         color:"#e65100", odds:"20-1" },
  15: {number:15, name:"Emerging Market", color:"#880e4f", odds:"15-1" },
  16: {number:16, name:"Pavlovian",       color:"#757575", odds:"30-1" },
  17: {number:17, name:"Six Speed",       color:"#212121", odds:"50-1" },
  18: {number:18, name:"Further Ado",     color:"#33691e", odds:"6-1"  },
  19: {number:19, name:"Golden Tempo",    color:"#0d47a1", odds:"30-1" },
  21: {number:21, name:"Great White",     color:"#9e9e9e", odds:"50-1" },
  22: {number:22, name:"Ocelli",          color:"#00695c", odds:"50-1" },
  23: {number:23, name:"Robusta",         color:"#8d1515", odds:"50-1" },
};

interface Bet { id:string; bettor:string; phone:string; horseId:number; amount:number; }
interface State { status:string; bets:Bet[]; rake:number; winnerHorseId?:number; }
interface Pool { total:number; payoutPool:number; byHorse:Record<number,number>; odds:Record<number,number>; }

function oddsLabel(m:number){ if(!m||m<=0)return'—'; const x=m-1; if(x<=0)return'1:1'; const d=10,n=Math.round(x*d); const g=(a:number,b:number):number=>b===0?a:g(b,a%b); const gg=g(n,d); return`${n/gg}:${d/gg}`; }
function computePayout(bets:Bet[],wid:number,rake:number,bettor:string):number{ try{ const total=bets.reduce((s,b)=>s+b.amount,0); const pool=total*(1-rake/100); const onW=bets.filter(b=>b.horseId===wid).reduce((s,b)=>s+b.amount,0); const mine=bets.filter(b=>b.horseId===wid&&b.bettor===bettor).reduce((s,b)=>s+b.amount,0); if(onW===0||mine===0)return 0; return(mine/onW)*pool; }catch{return 0;} }

type AdminView='summary'|'users'|'controls';

export default function Admin(){
  const[password,setPassword]=useState('');
  const[savedPw,setSavedPw]=useState('');
  const[authed,setAuthed]=useState(false);
  const[state,setState]=useState<State|null>(null);
  const[pool,setPool]=useState<Pool|null>(null);
  const[fetchError,setFetchError]=useState('');
  const[msg,setMsg]=useState('');
  const[msgOk,setMsgOk]=useState(true);
  const[rakeInput,setRakeInput]=useState('15');
  const[winnerSelect,setWinnerSelect]=useState(1);
  const[view,setView]=useState<AdminView>('summary');
  const[expandedUser,setExpandedUser]=useState<string|null>(null);
  const[deleting,setDeleting]=useState<string|null>(null);

  useEffect(()=>{ try{ const pw=localStorage.getItem('derby_admin_pw'); if(pw){setSavedPw(pw);setPassword(pw);setAuthed(true);} }catch{} },[]);

  const fetchData=useCallback(async()=>{
    try{
      const res=await fetch('/api/race'); const json=await res.json();
      if(json.error){setFetchError(json.error);return;}
      setState({status:json.state?.status??'open',bets:Array.isArray(json.state?.bets)?json.state.bets:[],rake:json.state?.rake??15,winnerHorseId:json.state?.winnerHorseId});
      setPool({total:json.pool?.total??0,payoutPool:json.pool?.payoutPool??0,byHorse:json.pool?.byHorse??{},odds:json.pool?.odds??{}});
      setFetchError('');
      if(json.state?.rake!=null)setRakeInput(String(json.state.rake));
    }catch{setFetchError('Could not reach server');}
  },[]);

  useEffect(()=>{ if(!authed)return; fetchData(); const t=setInterval(fetchData,5000); return()=>clearInterval(t); },[authed,fetchData]);

  const login=()=>{ if(!password.trim())return; try{localStorage.setItem('derby_admin_pw',password);}catch{} setSavedPw(password);setAuthed(true); };
  const logout=()=>{ try{localStorage.removeItem('derby_admin_pw');}catch{} setAuthed(false);setSavedPw('');setPassword('');setState(null);setPool(null); };

  const doAction=async(body:object)=>{
    setMsg('');setMsgOk(true);
    try{
      const res=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:savedPw,...body})});
      const json=await res.json();
      if(json.error){setMsg(json.error);setMsgOk(false);if(res.status===401)logout();}
      else{setMsg(json.message||'Done!');setMsgOk(true);fetchData();}
    }catch{setMsg('Network error — try again');setMsgOk(false);}
  };

  const doDelete=async(body:object,label:string)=>{
    if(!confirm(`Delete ${label}?`))return;
    setDeleting(label);
    try{
      const res=await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:savedPw,...body})});
      const json=await res.json();
      if(json.error)alert(json.error); else{fetchData();setExpandedUser(null);}
    }catch{alert('Network error');}
    setDeleting(null);
  };

  if(!authed) return(
    <div style={s.page}><Head><title>Admin – Derby</title></Head>
      <div style={s.loginBox}>
        <div style={s.loginTitle}>🌹 Host Admin</div>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} style={s.input} autoFocus/>
        <button style={s.redBtn} onClick={login}>Enter →</button>
      </div>
    </div>
  );

  if(!state||!pool) return(
    <div style={s.page}><Head><title>Admin – Derby</title></Head>
      <div style={{textAlign:'center',paddingTop:80}}>
        {fetchError?<><div style={{color:'#c00',marginBottom:12}}>{fetchError}</div><button style={s.redBtn} onClick={fetchData}>Retry</button><br/><br/><button style={{...s.grayBtn,maxWidth:140}} onClick={logout}>← Log out</button></>:<div style={{color:'#888'}}>Loading…</div>}
      </div>
    </div>
  );

  const userMap:Record<string,{phone:string;bets:Bet[];total:number}>={};
  for(const bet of state.bets){
    if(!userMap[bet.bettor])userMap[bet.bettor]={phone:bet.phone||'',bets:[],total:0};
    userMap[bet.bettor].bets.push(bet); userMap[bet.bettor].total+=bet.amount;
    if(bet.phone)userMap[bet.bettor].phone=bet.phone;
  }
  const users=Object.entries(userMap).sort((a,b)=>b[1].total-a[1].total);
  const payoutsByBettor:Record<string,number>={};
  if(state.status==='finished'&&state.winnerHorseId)
    for(const[bettor]of users) payoutsByBettor[bettor]=computePayout(state.bets,state.winnerHorseId,state.rake,bettor);
  const totalPayouts=Object.values(payoutsByBettor).reduce((s,v)=>s+v,0);
  const houseProfit=state.status==='finished'?pool.total-totalPayouts:pool.total*state.rake/100;
  const statusColor=state.status==='open'?'#1a6b00':state.status==='closed'?'#c00':'#8B6914';

  return(
    <div style={s.page}><Head><title>Admin – Derby</title></Head>
      <div style={s.adminHeader}>
        <div style={{fontWeight:700,fontSize:16,color:'#fff'}}>🌹 Host Dashboard</div>
        <button style={s.logoutBtn} onClick={logout}>Log out</button>
      </div>
      {fetchError&&<div style={s.errorBar}>⚠️ {fetchError} — <span style={{textDecoration:'underline',cursor:'pointer'}} onClick={fetchData}>retry</span></div>}
      <div style={s.tabs}>
        {(['summary','users','controls']as AdminView[]).map(t=>(
          <button key={t} style={s.tab(view===t)} onClick={()=>setView(t)}>
            {t==='summary'?'📊 Pool':t==='users'?`👥 Bettors (${users.length})`:'⚙️ Controls'}
          </button>
        ))}
      </div>

      {view==='summary'&&(
        <div style={s.section}>
          <div style={s.statCard}>
            <Row label="Status"><strong style={{color:statusColor}}>{state.status.toUpperCase()}</strong></Row>
            <Row label="Total in Pool"><strong>${pool.total.toFixed(2)}</strong></Row>
            <Row label="Bets placed"><strong>{state.bets.length}</strong></Row>
            <Row label={`Your cut (${state.rake}% rake)`}><strong style={{color:'#1a6b00'}}>${houseProfit.toFixed(2)}</strong></Row>
            <Row label="Winner payout pool"><strong>${pool.payoutPool.toFixed(2)}</strong></Row>
          </div>
          {state.status==='finished'&&Object.keys(payoutsByBettor).length>0&&(
            <div style={s.card}>
              <div style={s.cardTitle}>💰 Payouts to Make</div>
              {Object.entries(payoutsByBettor).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([bettor,payout])=>(
                <Row key={bettor} label={bettor}><strong style={{color:'#1a6b00'}}>${payout.toFixed(2)}</strong></Row>
              ))}
              <Row label="Your profit"><strong style={{color:'#8B0000'}}>${houseProfit.toFixed(2)}</strong></Row>
            </div>
          )}
          {Object.keys(pool.byHorse).length>0&&(
            <div style={s.card}>
              <div style={s.cardTitle}>Odds Board</div>
              <div style={{display:'flex',fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase' as const,letterSpacing:'0.05em',padding:'4px 8px',fontFamily:'sans-serif'}}>
                <span style={{flex:1}}>Horse</span><span style={{width:50,textAlign:'center'}}>ML</span><span style={{width:55,textAlign:'center'}}>Live</span><span style={{width:65,textAlign:'right'}}>Pool $</span>
              </div>
              {Object.entries(HORSES).map(([hid,h])=>{
                const amt=pool.byHorse[Number(hid)]||0; const liveOdds=pool.odds[Number(hid)];
                if(!amt)return null;
                return(
                  <div key={hid} style={{display:'flex',alignItems:'center',padding:'7px 8px',borderBottom:'1px solid #f0f0f0',fontSize:13}}>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{background:h.color,color:'#fff',borderRadius:4,padding:'1px 5px',fontSize:10,fontWeight:700,fontFamily:'sans-serif'}}>#{h.number}</span>
                      <span style={{fontWeight:600}}>{h.name}</span>
                    </div>
                    <span style={{width:50,textAlign:'center',color:'#888',fontFamily:'sans-serif',fontSize:12}}>{h.odds}</span>
                    <span style={{width:55,textAlign:'center',fontWeight:700,color:'#8B0000',fontFamily:'sans-serif'}}>{liveOdds?oddsLabel(liveOdds):'—'}</span>
                    <span style={{width:65,textAlign:'right',color:'#555',fontFamily:'sans-serif'}}>${amt.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view==='users'&&(
        <div style={s.section}>
          {users.length===0?<div style={{textAlign:'center',padding:'48px 20px',color:'#aaa',fontFamily:'sans-serif'}}>No bets placed yet</div>
          :users.map(([bettor,info])=>{
            const isExpanded=expandedUser===bettor; const payout=payoutsByBettor[bettor];
            return(
              <div key={bettor} style={s.userCard(isExpanded)}>
                <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>setExpandedUser(isExpanded?null:bettor)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,color:'#222'}}>{bettor}</div>
                    <div style={{fontSize:12,color:'#888',fontFamily:'sans-serif',marginTop:1}}>📱 {info.phone||'no phone'} · {info.bets.length} bet{info.bets.length!==1?'s':''}</div>
                  </div>
                  <div style={{textAlign:'right' as const,flexShrink:0}}>
                    <div style={{fontWeight:700,fontSize:15,color:'#333'}}>${info.total.toFixed(0)}</div>
                    {payout>0&&<div style={{fontSize:12,color:'#1a6b00',fontFamily:'sans-serif',fontWeight:700}}>wins ${payout.toFixed(2)}</div>}
                  </div>
                  <div style={{fontSize:16,color:'#ccc',marginLeft:4}}>{isExpanded?'▲':'▼'}</div>
                </div>
                {isExpanded&&(
                  <div style={{marginTop:12,borderTop:'1px solid #f0f0f0',paddingTop:12}}>
                    {info.bets.map(bet=>{
                      const horse=HORSES[bet.horseId]; const isWinner=state.winnerHorseId===bet.horseId;
                      return(
                        <div key={bet.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'1px solid #f8f8f8'}}>
                          {horse&&<span style={{background:horse.color,color:'#fff',borderRadius:4,padding:'1px 6px',fontSize:11,fontWeight:700,fontFamily:'sans-serif'}}>#{horse.number}</span>}
                          <span style={{flex:1,fontSize:13,color:isWinner?'#8B0000':'#333',fontWeight:isWinner?700:400}}>{horse?.name||`Horse #${bet.horseId}`}{isWinner?' 🏆':''}</span>
                          <span style={{fontSize:13,fontWeight:700,color:'#333',fontFamily:'sans-serif'}}>${bet.amount}</span>
                          <button style={s.deleteBtn} onClick={()=>doDelete({action:'deleteBet',betId:bet.id},`$${bet.amount} bet on ${horse?.name}`)} disabled={deleting!==null}>✕</button>
                        </div>
                      );
                    })}
                    <div style={{marginTop:10,display:'flex',justifyContent:'flex-end'}}>
                      <button style={s.deleteUserBtn} onClick={()=>doDelete({action:'deleteUser',bettor},`all bets for ${bettor}`)} disabled={deleting!==null}>🗑 Remove {bettor} entirely</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view==='controls'&&(
        <div style={s.section}>
          <div style={s.card}>
            <div style={s.cardTitle}>Race Controls</div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <button style={s.greenBtn} onClick={()=>doAction({action:'open'})}>🟢 Open Betting</button>
              <button style={s.redBtn} onClick={()=>doAction({action:'close'})}>🔴 Close Betting</button>
            </div>
            <div style={s.fieldLabel}>Rake %</div>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16}}>
              <input type="number" min={0} max={50} value={rakeInput} onChange={e=>setRakeInput(e.target.value)} style={{...s.input,width:80,marginBottom:0}}/>
              <button style={{...s.grayBtn,padding:'10px 18px'}} onClick={()=>doAction({action:'setRake',rake:Number(rakeInput)})}>Set Rake</button>
              <span style={{fontSize:13,color:'#888',fontFamily:'sans-serif'}}>current: {state.rake}%</span>
            </div>
            <div style={s.fieldLabel}>Declare Winner</div>
            <select value={winnerSelect} onChange={e=>setWinnerSelect(Number(e.target.value))} style={{...s.input,marginBottom:8}}>
              {Object.values(HORSES).map(h=><option key={h.number} value={h.number}>#{h.number} {h.name} ({h.odds})</option>)}
            </select>
            <button style={{...s.goldBtn,marginBottom:16}} onClick={()=>doAction({action:'setWinner',winnerHorseId:winnerSelect})}>🏁 Declare Winner</button>
            <button style={s.grayBtn} onClick={()=>{if(confirm('Clear ALL bets and reopen betting?'))doAction({action:'reset'});}}>🔄 Reset Race (clear all bets)</button>
            {msg&&<div style={{marginTop:12,padding:'8px 12px',background:msgOk?'#f0fff4':'#fff5f5',border:`1px solid ${msgOk?'#b0e0b0':'#f0b0b0'}`,borderRadius:6,fontSize:13,color:msgOk?'#1a6b00':'#c00',fontFamily:'sans-serif'}}>{msg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({label,children}:{label:string;children:React.ReactNode}){
  return <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f0f0f0',fontSize:14,fontFamily:'sans-serif',color:'#444'}}><span style={{opacity:0.7}}>{label}</span>{children}</div>;
}

const s={
  page:{minHeight:'100vh',background:'#f5f5f5',color:'#222',fontFamily:'sans-serif',maxWidth:600,margin:'0 auto'} as React.CSSProperties,
  adminHeader:{background:'#8B0000',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'},
  logoutBtn:{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontSize:12},
  loginBox:{maxWidth:300,margin:'80px auto',background:'#fff',borderRadius:12,padding:28,boxShadow:'0 2px 12px rgba(0,0,0,0.1)',display:'flex',flexDirection:'column' as const,gap:12},
  loginTitle:{color:'#8B0000',fontSize:20,fontWeight:700,textAlign:'center' as const},
  input:{width:'100%',boxSizing:'border-box' as const,background:'#f5f5f5',border:'1.5px solid #ddd',borderRadius:8,padding:'10px 12px',color:'#222',fontSize:15,outline:'none',fontFamily:'sans-serif'},
  errorBar:{background:'#fff5f5',border:'1px solid #f0b0b0',color:'#c00',padding:'10px 16px',fontSize:13},
  tabs:{display:'flex',background:'#fff',borderBottom:'2px solid #eee'},
  tab:(active:boolean)=>({flex:1,padding:'12px 4px',background:'transparent',color:active?'#8B0000':'#999',border:'none',borderBottom:active?'2px solid #8B0000':'2px solid transparent',cursor:'pointer',fontSize:12,fontWeight:active?700:400,marginBottom:-2}),
  section:{padding:12},
  statCard:{background:'#fff',borderRadius:10,padding:'4px 14px 8px',marginBottom:10,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',border:'1px solid #eee'},
  card:{background:'#fff',borderRadius:10,padding:'14px 14px 8px',marginBottom:10,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',border:'1px solid #eee'},
  cardTitle:{fontWeight:700,fontSize:14,color:'#8B0000',marginBottom:10},
  fieldLabel:{fontSize:11,fontWeight:700,color:'#aaa',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:6},
  userCard:(expanded:boolean)=>({background:'#fff',borderRadius:10,padding:14,marginBottom:8,border:expanded?'1.5px solid #d4af37':'1px solid #eee',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}),
  deleteBtn:{background:'#fff5f5',border:'1px solid #f0b0b0',color:'#c00',borderRadius:5,padding:'3px 8px',cursor:'pointer',fontSize:12,fontWeight:700},
  deleteUserBtn:{background:'#fff5f5',border:'1px solid #f0b0b0',color:'#c00',borderRadius:7,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600},
  redBtn:{display:'block',width:'100%',padding:'11px',background:'#8B0000',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600} as React.CSSProperties,
  greenBtn:{display:'block',width:'100%',padding:'11px',background:'#1a5c00',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600} as React.CSSProperties,
  goldBtn:{display:'block',width:'100%',padding:'11px',background:'#8B6914',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600} as React.CSSProperties,
  grayBtn:{display:'block',width:'100%',padding:'11px',background:'#555',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600} as React.CSSProperties,
};
