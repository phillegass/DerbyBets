import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

interface Bet { id: string; bettor: string; phone: string; horseId: number; amount: number; timestamp: number; }
interface Horse { id: number; name: string; number: number; jockey: string; color: string; }
interface RaceState { status: 'open' | 'closed' | 'finished'; winnerHorseId?: number; bets: Bet[]; rake: number; }
interface PoolData { total: number; payoutPool: number; byHorse: Record<number, number>; odds: Record<number, number>; }
interface RaceData { state: RaceState; pool: PoolData; horses: Horse[]; }

function oddsLabel(multiplier: number): string {
  if (!multiplier || multiplier <= 0) return '—';
  const x = multiplier - 1;
  if (x <= 0) return '1:1';
  const denom = 10;
  const num = Math.round(x * denom);
  const g = gcd(num, denom);
  return `${num/g}:${denom/g}`;
}
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function tenDollarPayout(multiplier: number): string {
  if (!multiplier || multiplier <= 0) return '—';
  return '$' + (10 * multiplier).toFixed(2);
}

function computeMyPayout(bets: Bet[], winnerId: number, rake: number, bettor: string): number {
  const winnerBets = bets.filter(b => b.horseId === winnerId);
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const payoutPool = total * (1 - rake / 100);
  const totalOnWinner = winnerBets.reduce((s, b) => s + b.amount, 0);
  const myAmount = winnerBets.filter(b => b.bettor === bettor).reduce((s, b) => s + b.amount, 0);
  if (totalOnWinner === 0 || myAmount === 0) return 0;
  return (myAmount / totalOnWinner) * payoutPool;
}

function computeHorsePayout(bets: Bet[], horseId: number, rake: number, bettor: string): number {
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const payoutPool = total * (1 - rake / 100);
  const totalOnHorse = bets.filter(b => b.horseId === horseId).reduce((s, b) => s + b.amount, 0);
  const myOnHorse = bets.filter(b => b.horseId === horseId && b.bettor === bettor).reduce((s, b) => s + b.amount, 0);
  if (totalOnHorse === 0 || myOnHorse === 0) return 0;
  return (myOnHorse / totalOnHorse) * payoutPool;
}

export default function Home() {
  const [data, setData] = useState<RaceData | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Login state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savedName, setSavedName] = useState('');
  const [savedPhone, setSavedPhone] = useState('');

  // Bet entry: map of horseId -> dollar amount string
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{text: string; type: 'success'|'error'} | null>(null);

  const [view, setView] = useState<'bet' | 'odds'>('bet');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      if (!res.ok) { setLoadError(true); return; }
      const json = await res.json();
      if (json?.state && json?.horses) { setData(json); setLoadError(false); }
      else setLoadError(true);
    } catch { setLoadError(true); }
  }, []);

  useEffect(() => {
    try {
      const n = localStorage.getItem('derby_name');
      const p = localStorage.getItem('derby_phone');
      if (n) setSavedName(n);
      if (p) setSavedPhone(p);
    } catch {}
    fetchData();
    const t = setInterval(fetchData, 5000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleLogin = () => {
    if (name.trim().length < 2) return;
    if (phone.trim().length < 7) return;
    try {
      localStorage.setItem('derby_name', name.trim());
      localStorage.setItem('derby_phone', phone.trim());
    } catch {}
    setSavedName(name.trim());
    setSavedPhone(phone.trim());
  };

  const handleSubmitBets = async () => {
    const entries = Object.entries(betAmounts).filter(([, v]) => Number(v) > 0);
    if (entries.length === 0) { setSubmitMsg({text: 'Enter at least one bet amount', type: 'error'}); return; }

    setSubmitting(true);
    setSubmitMsg(null);
    const errors: string[] = [];
    const successes: string[] = [];

    for (const [horseIdStr, amtStr] of entries) {
      const horseId = Number(horseIdStr);
      const amount = Number(amtStr);
      if (!amount || amount < 1) continue;
      try {
        const res = await fetch('/api/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bettor: savedName, phone: savedPhone, horseId, amount }),
        });
        const json = await res.json();
        if (json.success) {
          const horse = data?.horses.find(h => h.id === horseId);
          successes.push(`$${amount} on #${horse?.number} ${horse?.name}`);
        } else {
          errors.push(json.error || 'Error on horse #' + horseId);
        }
      } catch { errors.push('Network error on horse #' + horseId); }
    }

    await fetchData();
    setBetAmounts({});
    setSubmitting(false);

    if (errors.length > 0) {
      setSubmitMsg({text: errors.join(' · '), type: 'error'});
    } else {
      setSubmitMsg({text: '✅ Bets placed: ' + successes.join(', '), type: 'success'});
    }
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (!data) return (
    <div style={s.loadPage}>
      <Head>
        <title>🌹 Derby Betting 2025</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div style={{fontSize:48, marginBottom:16}}>🌹</div>
      {loadError
        ? <><div style={{fontSize:15, marginBottom:16, color:'#c00'}}>Couldn't connect to server</div>
            <button style={s.retryBtn} onClick={fetchData}>Retry</button></>
        : <div style={{fontSize:15, color:'#888'}}>Loading…</div>}
    </div>
  );

  const { state, pool, horses } = data;
  const myBets = state.bets.filter(b => b.bettor === savedName);
  const myTotalWagered = myBets.reduce((s, b) => s + b.amount, 0);
  const myWinnerBets = state.winnerHorseId ? myBets.filter(b => b.horseId === state.winnerHorseId) : [];
  const myWinPayout = state.status === 'finished' && state.winnerHorseId
    ? computeMyPayout(state.bets, state.winnerHorseId, state.rake, savedName)
    : null;
  const winner = state.winnerHorseId ? horses.find(h => h.id === state.winnerHorseId) : null;

  // Total pending bets in input fields
  const pendingTotal = Object.values(betAmounts).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <>
      <Head>
        <title>🌹 Derby Betting 2025</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div style={s.page}>

        {/* Header */}
        <header style={s.header}>
          <div style={{fontSize:18, marginBottom:4, letterSpacing:4}}>🌹 🌹 🌹</div>
          <h1 style={s.title}>DERBY BETTING</h1>
          <div style={s.subtitle}>Kentucky Derby 2025</div>
          <div style={s.badge(state.status)}>
            {state.status === 'open' ? '🟢 BETTING OPEN' : state.status === 'closed' ? '🔴 BETTING CLOSED' : '🏆 RACE FINISHED'}
          </div>
          <div style={{marginTop:8, fontSize:13, color:'#666', fontFamily:'sans-serif'}}>
            Pool: <strong style={{color:'#333'}}>${pool.total.toFixed(2)}</strong>
          </div>
        </header>

        {/* Winner Banner */}
        {state.status === 'finished' && winner && (
          <div style={s.winnerBanner}>
            <div style={{fontSize:13, fontWeight:700, letterSpacing:'0.12em', marginBottom:4}}>🏆 WINNER</div>
            <div style={{fontSize:24, fontWeight:900}}>#{winner.number} {winner.name}</div>
            <div style={{fontSize:13, opacity:0.7, marginTop:2}}>{winner.jockey}</div>
            {myWinPayout !== null && myWinPayout > 0 && (
              <div style={{marginTop:10, fontSize:20, fontWeight:900, color:'#1a6b00'}}>
                💰 You win ${myWinPayout.toFixed(2)}!
              </div>
            )}
            {myWinPayout === 0 && myBets.length > 0 && (
              <div style={{marginTop:8, fontSize:14, opacity:0.6}}>Better luck next time, {savedName}!</div>
            )}
          </div>
        )}

        {/* Login */}
        {!savedName ? (
          <div style={s.card}>
            <div style={s.cardTitle}>Who's betting? 🎩</div>
            <label style={s.fieldLabel}>Your name</label>
            <input
              style={s.input}
              placeholder="First & last name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <label style={s.fieldLabel}>Phone number</label>
            <input
              style={s.input}
              placeholder="So the host can pay you!"
              value={phone}
              type="tel"
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              style={{...s.primaryBtn, opacity: (name.trim().length < 2 || phone.trim().length < 7) ? 0.5 : 1}}
              onClick={handleLogin}
              disabled={name.trim().length < 2 || phone.trim().length < 7}
            >
              Enter the Winners Circle →
            </button>
          </div>
        ) : (
          <>
            {/* Greeting bar */}
            <div style={s.greetingBar}>
              <span>🎩 <strong>{savedName}</strong> · {savedPhone}</span>
              <button style={s.textBtn} onClick={() => {
                setSavedName(''); setSavedPhone('');
                try { localStorage.removeItem('derby_name'); localStorage.removeItem('derby_phone'); } catch {}
              }}>change</button>
            </div>

            {/* Tabs */}
            <div style={s.tabs}>
              <button style={s.tab(view === 'bet')} onClick={() => setView('bet')}>🏇 Place Bets</button>
              <button style={s.tab(view === 'odds')} onClick={() => setView('odds')}>📊 Odds & My Bets</button>
            </div>

            {/* ── BET TAB ── */}
            {view === 'bet' && (
              <div style={{padding:16}}>
                {state.status !== 'open' ? (
                  <div style={s.closedMsg}>
                    {state.status === 'closed' ? '🔒 Betting is closed — the race is about to start!' : '🏁 The race is over. Check Odds & My Bets for results.'}
                  </div>
                ) : (
                  <>
                    <div style={s.betInstructions}>
                      Enter dollar amounts next to any horses you want to bet on, then tap Submit Bets.
                    </div>

                    {/* Horse bet list */}
                    <div style={s.horseList}>
                      {horses.map(horse => {
                        const myOnThis = myBets.filter(b => b.horseId === horse.id).reduce((s, b) => s + b.amount, 0);
                        const pendingAmt = betAmounts[horse.id] || '';
                        const odds = pool.odds[horse.id];
                        return (
                          <div key={horse.id} style={s.horseRow(!!pendingAmt && Number(pendingAmt) > 0)}>
                            <div style={{display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0}}>
                              <div style={s.silkBadge(horse.color)}>#{horse.number}</div>
                              <div style={{minWidth:0}}>
                                <div style={s.horseName}>{horse.name}</div>
                                <div style={s.horseJockey}>{horse.jockey}</div>
                              </div>
                            </div>
                            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                              {odds && (
                                <div style={s.oddsChip}>
                                  <div style={{fontSize:11, fontWeight:700, color:'#8B0000'}}>{oddsLabel(odds)}</div>
                                  <div style={{fontSize:10, color:'#888'}}>$10→{tenDollarPayout(odds)}</div>
                                </div>
                              )}
                              {myOnThis > 0 && (
                                <div style={s.alreadyBetChip}>${myOnThis} bet</div>
                              )}
                              <div style={s.inputWrap}>
                                <span style={{fontSize:14, color:'#999', marginRight:2}}>$</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="0"
                                  value={pendingAmt}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setBetAmounts(prev => ({...prev, [horse.id]: v}));
                                  }}
                                  style={s.betInput}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit */}
                    {submitMsg && (
                      <div style={s.msg(submitMsg.type)}>{submitMsg.text}</div>
                    )}
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, gap:12}}>
                      <div style={{fontSize:14, color:'#555', fontFamily:'sans-serif'}}>
                        {pendingTotal > 0 ? <>Pending: <strong style={{color:'#333'}}>${pendingTotal.toFixed(0)}</strong></> : <span style={{opacity:0.5}}>No amounts entered</span>}
                      </div>
                      <button
                        style={{...s.primaryBtn, flex:'none' as any, padding:'12px 24px', opacity: (pendingTotal === 0 || submitting) ? 0.5 : 1}}
                        onClick={handleSubmitBets}
                        disabled={pendingTotal === 0 || submitting}
                      >
                        {submitting ? 'Placing…' : `Submit Bets →`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ODDS TAB ── */}
            {view === 'odds' && (
              <div style={{padding:16}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:12, fontSize:13, color:'#555', fontFamily:'sans-serif'}}>
                  <span>Total pool: <strong style={{color:'#333'}}>${pool.total.toFixed(2)}</strong></span>
                  <span>My wagered: <strong style={{color:'#333'}}>${myTotalWagered.toFixed(2)}</strong></span>
                </div>

                {/* Header row */}
                <div style={s.oddsHeaderRow}>
                  <span style={{flex:1}}>Horse</span>
                  <span style={{width:60, textAlign:'center'}}>Odds</span>
                  <span style={{width:70, textAlign:'right'}}>$10 pays</span>
                  <span style={{width:70, textAlign:'right'}}>My bet</span>
                  <span style={{width:70, textAlign:'right'}}>My payout</span>
                </div>

                {horses
                  .slice().sort((a, b) => (pool.byHorse[b.id]||0) - (pool.byHorse[a.id]||0))
                  .map(horse => {
                    const odds = pool.odds[horse.id];
                    const myOnHorse = myBets.filter(b => b.horseId === horse.id).reduce((s, b) => s + b.amount, 0);
                    const myHorsePayout = myOnHorse > 0 ? computeHorsePayout(state.bets, horse.id, state.rake, savedName) : 0;
                    const isWinner = state.winnerHorseId === horse.id;
                    return (
                      <div key={horse.id} style={s.oddsRow(isWinner, horse.color)}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{display:'flex', alignItems:'center', gap:6}}>
                            <span style={s.silkBadgeSmall(horse.color)}>#{horse.number}</span>
                            <span style={{fontSize:13, fontWeight:600, color: isWinner ? '#8B0000' : '#222'}}>{horse.name}</span>
                          </div>
                          <div style={{fontSize:11, color:'#888', marginTop:1, fontFamily:'sans-serif'}}>${(pool.byHorse[horse.id]||0).toFixed(0)} in pool</div>
                        </div>
                        <span style={{width:60, textAlign:'center', fontSize:13, fontWeight:700, color:'#8B0000', fontFamily:'sans-serif'}}>{odds ? oddsLabel(odds) : '—'}</span>
                        <span style={{width:70, textAlign:'right', fontSize:13, color:'#555', fontFamily:'sans-serif'}}>{odds ? tenDollarPayout(odds) : '—'}</span>
                        <span style={{width:70, textAlign:'right', fontSize:13, fontWeight: myOnHorse > 0 ? 700 : 400, color: myOnHorse > 0 ? '#333' : '#bbb', fontFamily:'sans-serif'}}>
                          {myOnHorse > 0 ? `$${myOnHorse}` : '—'}
                        </span>
                        <span style={{width:70, textAlign:'right', fontSize:13, fontWeight: myHorsePayout > 0 ? 700 : 400, color: myHorsePayout > 0 ? '#1a6b00' : '#bbb', fontFamily:'sans-serif'}}>
                          {myHorsePayout > 0 ? `$${myHorsePayout.toFixed(2)}` : '—'}
                        </span>
                      </div>
                    );
                  })}

                <div style={{marginTop:16, fontSize:11, color:'#aaa', fontFamily:'sans-serif', textAlign:'center', lineHeight:1.6}}>
                  Odds update live as bets come in. "My payout" assumes your horse wins.
                </div>
              </div>
            )}
          </>
        )}

        <div style={{textAlign:'center', padding:'20px 0 8px', fontSize:11, color:'#bbb', fontFamily:'sans-serif'}}>
          🌹 For entertainment only · Updates every 5s
        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  loadPage: {
    display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center',
    minHeight:'100vh', background:'#f8f5f2', color:'#333', fontFamily:'Georgia, serif',
  },
  retryBtn: {
    padding:'10px 24px', background:'#8B0000', color:'#fff',
    border:'none', borderRadius:8, fontSize:15, cursor:'pointer', fontFamily:'sans-serif',
  },
  page: {
    minHeight:'100vh',
    background:'#f8f5f2',
    color:'#222',
    fontFamily:'Georgia, Times New Roman, serif',
    paddingBottom:40,
    maxWidth:600,
    margin:'0 auto',
  } as React.CSSProperties,
  header: {
    background:'linear-gradient(160deg, #8B0000 0%, #6b0000 100%)',
    textAlign:'center' as const,
    padding:'24px 16px 20px',
    borderBottom:'3px solid #d4af37',
  },
  title: {
    margin:0, fontSize:26, fontWeight:900,
    letterSpacing:'0.14em', color:'#fff',
    textShadow:'0 1px 4px rgba(0,0,0,0.3)',
  },
  subtitle: { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2, letterSpacing:'0.06em', fontFamily:'sans-serif' },
  badge: (status: string) => ({
    display:'inline-block', marginTop:10, padding:'4px 14px',
    borderRadius:20, fontSize:12, fontWeight:700, fontFamily:'sans-serif',
    background: status === 'open' ? 'rgba(255,255,255,0.2)' : status === 'closed' ? 'rgba(0,0,0,0.25)' : 'rgba(212,175,55,0.3)',
    border:`1px solid ${status === 'open' ? 'rgba(255,255,255,0.5)' : status === 'closed' ? 'rgba(255,255,255,0.2)' : '#d4af37'}`,
    color: status === 'open' ? '#fff' : status === 'closed' ? 'rgba(255,255,255,0.6)' : '#d4af37',
  }),
  winnerBanner: {
    background:'linear-gradient(135deg, #fffbe6, #fef3c7)',
    borderBottom:'2px solid #d4af37',
    textAlign:'center' as const,
    padding:'18px 16px',
    color:'#5c3d00',
  },
  card: {
    margin:16, background:'#fff', borderRadius:12, padding:20,
    boxShadow:'0 1px 4px rgba(0,0,0,0.08)', border:'1px solid #eee',
  },
  cardTitle: { fontSize:17, fontWeight:700, marginBottom:14, color:'#222' },
  fieldLabel: { display:'block' as const, fontSize:11, fontWeight:700, letterSpacing:'0.06em', color:'#888', marginBottom:5, textTransform:'uppercase' as const, fontFamily:'sans-serif' },
  input: {
    width:'100%', boxSizing:'border-box' as const,
    background:'#f5f5f5', border:'1.5px solid #ddd',
    borderRadius:8, padding:'11px 13px',
    fontSize:15, color:'#222', fontFamily:'sans-serif',
    outline:'none', marginBottom:12,
  },
  primaryBtn: {
    display:'block', width:'100%',
    background:'#8B0000', color:'#fff',
    border:'none', borderRadius:10, padding:'14px',
    fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'sans-serif',
    letterSpacing:'0.02em',
  } as React.CSSProperties,
  greetingBar: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 16px', background:'#fff', borderBottom:'1px solid #eee',
    fontSize:13, fontFamily:'sans-serif', color:'#555',
  },
  textBtn: {
    background:'none', border:'none', color:'#8B0000', cursor:'pointer',
    fontSize:13, fontFamily:'sans-serif', textDecoration:'underline',
  },
  tabs: { display:'flex', background:'#fff', borderBottom:'2px solid #eee' },
  tab: (active: boolean) => ({
    flex:1, padding:'13px 4px',
    background:'transparent',
    color: active ? '#8B0000' : '#999',
    border:'none', borderBottom: active ? '2px solid #8B0000' : '2px solid transparent',
    cursor:'pointer', fontSize:13, fontFamily:'sans-serif',
    fontWeight: active ? 700 : 400, marginBottom:-2,
  }),
  betInstructions: {
    fontSize:13, color:'#666', fontFamily:'sans-serif',
    background:'#fff8f0', border:'1px solid #f0ddd0',
    borderRadius:8, padding:'10px 12px', marginBottom:14, lineHeight:1.5,
  },
  horseList: { display:'flex', flexDirection:'column' as const, gap:6 },
  horseRow: (hasAmount: boolean) => ({
    display:'flex', alignItems:'center', gap:8,
    background: hasAmount ? '#fff8f0' : '#fff',
    border: hasAmount ? '1.5px solid #d4af37' : '1px solid #eee',
    borderRadius:10, padding:'10px 12px',
  }),
  silkBadge: (color: string) => ({
    background:color, color:'#fff', borderRadius:5,
    padding:'3px 7px', fontSize:11, fontWeight:700,
    fontFamily:'sans-serif', whiteSpace:'nowrap' as const, flexShrink:0,
  }),
  silkBadgeSmall: (color: string) => ({
    background:color, color:'#fff', borderRadius:4,
    padding:'1px 5px', fontSize:10, fontWeight:700,
    fontFamily:'sans-serif', whiteSpace:'nowrap' as const, flexShrink:0,
  }),
  horseName: { fontSize:13, fontWeight:700, color:'#222', lineHeight:1.2 },
  horseJockey: { fontSize:11, color:'#999', fontFamily:'sans-serif', marginTop:1 },
  oddsChip: {
    textAlign:'center' as const, background:'#fff5f5', border:'1px solid #f0d0d0',
    borderRadius:6, padding:'3px 7px', flexShrink:0,
  },
  alreadyBetChip: {
    fontSize:11, background:'#f0fff0', border:'1px solid #b0e0b0',
    color:'#2a6b2a', borderRadius:6, padding:'3px 7px', fontFamily:'sans-serif',
    fontWeight:700, whiteSpace:'nowrap' as const, flexShrink:0,
  },
  inputWrap: {
    display:'flex', alignItems:'center',
    background:'#f5f5f5', border:'1.5px solid #ddd',
    borderRadius:8, padding:'6px 8px', width:72,
  },
  betInput: {
    width:50, background:'none', border:'none',
    fontSize:15, color:'#222', fontFamily:'sans-serif',
    outline:'none', fontWeight:700,
  },
  msg: (type: 'success'|'error') => ({
    padding:'10px 14px', borderRadius:8, marginTop:10,
    background: type === 'success' ? '#f0fff4' : '#fff5f5',
    border:`1px solid ${type === 'success' ? '#b0e0b0' : '#f0b0b0'}`,
    color: type === 'success' ? '#1a6b00' : '#c00',
    fontSize:13, fontFamily:'sans-serif', lineHeight:1.5,
  }),
  closedMsg: {
    textAlign:'center' as const, padding:'48px 20px',
    fontSize:15, color:'#666', fontFamily:'sans-serif', lineHeight:1.6,
  },
  oddsHeaderRow: {
    display:'flex', alignItems:'center', padding:'6px 10px',
    fontSize:11, fontWeight:700, color:'#aaa', fontFamily:'sans-serif',
    textTransform:'uppercase' as const, letterSpacing:'0.05em',
    borderBottom:'1px solid #eee', marginBottom:4,
  },
  oddsRow: (isWinner: boolean, color: string) => ({
    display:'flex', alignItems:'center', padding:'10px',
    borderRadius:8, marginBottom:4,
    background: isWinner ? '#fffbe6' : '#fff',
    border: isWinner ? '1.5px solid #d4af37' : '1px solid #eee',
  }),
};
