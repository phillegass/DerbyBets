import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

const HORSES = [
  { id: 1, number: 1, name: "Sovereignty", jockey: "J. Velazquez", color: "#c0392b" },
  { id: 2, number: 2, name: "Journalism", jockey: "F. Prat", color: "#e67e22" },
  { id: 3, number: 3, name: "Rodriguez", jockey: "L. Saez", color: "#f1c40f" },
  { id: 4, number: 4, name: "Baeza", jockey: "B. Hernandez", color: "#2ecc71" },
  { id: 5, number: 5, name: "Chunk of Gold", jockey: "I. Ortiz Jr.", color: "#1abc9c" },
  { id: 6, number: 6, name: "American Promise", jockey: "M. Smith", color: "#3498db" },
  { id: 7, number: 7, name: "River Thames", jockey: "D. Van Dyke", color: "#9b59b6" },
  { id: 8, number: 8, name: "Sandman", jockey: "T. Gaffalione", color: "#e91e63" },
  { id: 9, number: 9, name: "Herecomesthebride", jockey: "J. Rosario", color: "#ff5722" },
  { id: 10, number: 10, name: "Flying Mohawk", jockey: "O. Bocachica", color: "#607d8b" },
  { id: 11, number: 11, name: "Luxor Cafe", jockey: "C. Lanerie", color: "#795548" },
  { id: 12, number: 12, name: "Grande Reserve", jockey: "M. Franco", color: "#009688" },
  { id: 13, number: 13, name: "Tiztastic", jockey: "E. Cancel", color: "#673ab7" },
  { id: 14, number: 14, name: "Clever Again", jockey: "R. Santana Jr.", color: "#2196f3" },
  { id: 15, number: 15, name: "Steam Engine", jockey: "J. Castellano", color: "#4caf50" },
  { id: 16, number: 16, name: "Noble Reggie", jockey: "P. Lopez", color: "#ff9800" },
  { id: 17, number: 17, name: "Ammo", jockey: "J. Graham", color: "#f44336" },
  { id: 18, number: 18, name: "Burnham Square", jockey: "K. Carmouche", color: "#9c27b0" },
  { id: 19, number: 19, name: "Netspend", jockey: "A. Beschizza", color: "#00bcd4" },
  { id: 20, number: 20, name: "Render Judgment", jockey: "C. Velasquez", color: "#8bc34a" },
];

interface Bet { id: string; bettor: string; horseId: number; amount: number; }
interface State { status: string; bets: Bet[]; rake: number; winnerHorseId?: number; }
interface Pool { total: number; payoutPool: number; byHorse: Record<number,number>; odds: Record<number,number>; }

function safePool(pool: any): Pool {
  return {
    total: pool?.total ?? 0,
    payoutPool: pool?.payoutPool ?? 0,
    byHorse: pool?.byHorse ?? {},
    odds: pool?.odds ?? {},
  };
}

function safeState(state: any): State {
  return {
    status: state?.status ?? 'open',
    bets: Array.isArray(state?.bets) ? state.bets : [],
    rake: state?.rake ?? 15,
    winnerHorseId: state?.winnerHorseId,
  };
}

function computePayout(bets: Bet[], winnerId: number, rake: number, bettor: string): number {
  try {
    const winnerBets = bets.filter(b => b.horseId === winnerId);
    const total = bets.reduce((s, b) => s + (b.amount || 0), 0);
    const payoutPool = total * (1 - rake / 100);
    const totalOnWinner = winnerBets.reduce((s, b) => s + (b.amount || 0), 0);
    const myAmount = winnerBets.filter(b => b.bettor === bettor).reduce((s, b) => s + (b.amount || 0), 0);
    if (totalOnWinner === 0 || myAmount === 0) return 0;
    return (myAmount / totalOnWinner) * payoutPool;
  } catch { return 0; }
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [savedPw, setSavedPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const [rakeInput, setRakeInput] = useState('15');
  const [winnerSelect, setWinnerSelect] = useState(1);

  useEffect(() => {
    try {
      const pw = localStorage.getItem('derby_admin_pw');
      if (pw) { setSavedPw(pw); setPassword(pw); setAuthed(true); }
    } catch {}
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      const json = await res.json();
      if (json.error) { setFetchError(json.error); return; }
      setState(safeState(json.state));
      setPool(safePool(json.pool));
      setFetchError('');
      if (json.state?.rake != null) setRakeInput(String(json.state.rake));
    } catch (e: any) {
      setFetchError('Could not reach server: ' + (e?.message || 'network error'));
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchData();
    const t = setInterval(fetchData, 5000);
    return () => clearInterval(t);
  }, [authed, fetchData]);

  const login = () => {
    if (!password.trim()) return;
    try { localStorage.setItem('derby_admin_pw', password); } catch {}
    setSavedPw(password);
    setAuthed(true);
  };

  const logout = () => {
    try { localStorage.removeItem('derby_admin_pw'); } catch {}
    setAuthed(false); setSavedPw(''); setPassword(''); setState(null); setPool(null);
  };

  const action = async (body: object) => {
    setMsg(''); setMsgOk(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: savedPw, ...body }),
      });
      const json = await res.json();
      if (json.error) { setMsg(json.error); setMsgOk(false); if (res.status === 401) logout(); }
      else { setMsg(json.message || 'Done!'); setMsgOk(true); fetchData(); }
    } catch { setMsg('Network error — try again'); setMsgOk(false); }
  };

  // ── Login ──
  if (!authed) return (
    <div style={s.page}>
      <Head><title>Admin – Derby</title></Head>
      <div style={s.loginBox}>
        <div style={s.loginTitle}>🏇 Host Admin</div>
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={s.input} autoFocus />
        <button style={s.btn('#8B0000')} onClick={login}>Enter →</button>
      </div>
    </div>
  );

  // ── Loading / Error ──
  if (!state || !pool) return (
    <div style={s.page}>
      <Head><title>Admin – Derby</title></Head>
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        {fetchError
          ? <><div style={{ color: '#ff8080', marginBottom: 16 }}>{fetchError}</div>
              <button style={s.btn('#555')} onClick={fetchData}>Retry</button>
              <br/><br/>
              <button style={{ ...s.btn('#333'), maxWidth: 160 }} onClick={logout}>← Log out</button></>
          : <div style={{ opacity: 0.5 }}>Loading…</div>}
      </div>
    </div>
  );

  // ── Payouts ──
  const payoutsByBettor: Record<string, number> = {};
  if (state.status === 'finished' && state.winnerHorseId) {
    const bettors = [...new Set((state.bets || []).map(b => b.bettor))];
    for (const bettor of bettors) {
      try {
        payoutsByBettor[bettor] = computePayout(state.bets, state.winnerHorseId, state.rake, bettor);
      } catch {}
    }
  }

  const totalPayouts = Object.values(payoutsByBettor).reduce((s, v) => s + v, 0);
  const houseProfit = state.status === 'finished'
    ? (pool.total - totalPayouts)
    : (pool.total * state.rake / 100);

  const statusColor = state.status === 'open' ? '#7fff7f' : state.status === 'closed' ? '#ff8080' : '#d4af37';

  return (
    <div style={s.page}>
      <Head><title>Admin – Derby</title></Head>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h1 style={s.title}>🏇 Host Dashboard</h1>
        <button style={{ background:'#222', border:'1px solid #444', color:'#aaa', borderRadius:6, padding:'6px 12px', cursor:'pointer', fontSize:12 }} onClick={logout}>Log out</button>
      </div>

      {fetchError && (
        <div style={{ background:'rgba(200,0,0,0.15)', border:'1px solid #c00', color:'#ff8080', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13 }}>
          ⚠️ {fetchError} — <span style={{ textDecoration:'underline', cursor:'pointer' }} onClick={fetchData}>retry</span>
        </div>
      )}

      {/* Pool */}
      <div style={s.card}>
        <div style={s.cardTitle}>Pool Summary</div>
        <Row label="Status"><strong style={{ color: statusColor }}>{state.status.toUpperCase()}</strong></Row>
        <Row label="Total in Pool"><strong>${(pool.total || 0).toFixed(2)}</strong></Row>
        <Row label={`Bets placed`}><strong>{(state.bets || []).length}</strong></Row>
        <Row label={`Your cut (${state.rake}% rake)`}><strong style={{ color:'#7fff7f' }}>${(houseProfit || 0).toFixed(2)}</strong></Row>
        <Row label="Winner payout pool"><strong>${(pool.payoutPool || 0).toFixed(2)}</strong></Row>
      </div>

      {/* Controls */}
      <div style={s.card}>
        <div style={s.cardTitle}>Race Controls</div>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button style={s.btn('#1a5c00')} onClick={() => action({ action:'open' })}>🟢 Open Betting</button>
          <button style={s.btn('#8B0000')} onClick={() => action({ action:'close' })}>🔴 Close Betting</button>
        </div>

        <div style={s.fieldLabel}>Rake %</div>
        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
          <input type="number" min={0} max={50} value={rakeInput}
            onChange={e => setRakeInput(e.target.value)}
            style={{ width:80, background:'#2a2a2a', border:'1px solid #444', borderRadius:8, padding:'10px 12px', color:'#eee', fontSize:15, outline:'none' }} />
          <button
            onClick={() => action({ action:'setRake', rake: Number(rakeInput) })}
            style={{ background:'#555', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', cursor:'pointer', fontSize:14, fontWeight:600 }}>
            Set Rake
          </button>
          <span style={{ opacity:0.5, fontSize:13 }}>now: {state.rake}%</span>
        </div>

        <div style={s.fieldLabel}>Declare Winner</div>
        <select value={winnerSelect} onChange={e => setWinnerSelect(Number(e.target.value))}
          style={{ ...s.input, marginBottom:8 }}>
          {HORSES.map(h => <option key={h.id} value={h.id}>#{h.number} {h.name}</option>)}
        </select>
        <button style={{ ...s.btn('#7a5c00'), marginBottom:16 }}
          onClick={() => action({ action:'setWinner', winnerHorseId: winnerSelect })}>
          🏁 Declare Winner
        </button>

        <button style={s.btn('#2a2a2a')}
          onClick={() => { if (confirm('Clear ALL bets and reopen betting?')) action({ action:'reset' }); }}>
          🔄 Reset Race (clear all bets)
        </button>

        {msg && (
          <div style={{ marginTop:12, padding:'8px 12px', background:'#222', borderRadius:6, fontSize:13, color: msgOk ? '#7fff7f' : '#ff8080' }}>
            {msg}
          </div>
        )}
      </div>

      {/* Payouts */}
      {state.status === 'finished' && Object.keys(payoutsByBettor).length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>💰 Payouts to Make</div>
          {Object.entries(payoutsByBettor)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([bettor, payout]) => (
              <Row key={bettor} label={bettor}>
                <strong style={{ color:'#7fff7f' }}>${payout.toFixed(2)}</strong>
              </Row>
            ))}
          <Row label="Your profit"><strong style={{ color:'#d4af37' }}>${(houseProfit || 0).toFixed(2)}</strong></Row>
        </div>
      )}

      {/* Odds */}
      {Object.keys(pool.byHorse || {}).length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>Odds Board</div>
          {HORSES.filter(h => (pool.byHorse || {})[h.id])
            .sort((a, b) => ((pool.byHorse || {})[b.id] || 0) - ((pool.byHorse || {})[a.id] || 0))
            .map(h => (
              <div key={h.id} style={{ display:'flex', gap:8, padding:'7px 0', borderBottom:'1px solid #2a2a2a', fontSize:14, alignItems:'center' }}>
                <span style={{ background:h.color, color:'#fff', borderRadius:4, padding:'1px 6px', fontSize:11, fontWeight:700 }}>#{h.number}</span>
                <span style={{ flex:1 }}>{h.name}</span>
                <span style={{ opacity:0.6 }}>${((pool.byHorse || {})[h.id] || 0).toFixed(0)}</span>
                <strong style={{ color:'#d4af37', minWidth:40, textAlign:'right' }}>
                  {(pool.odds || {})[h.id] ? `${(pool.odds[h.id]).toFixed(2)}x` : '—'}
                </strong>
              </div>
            ))}
        </div>
      )}

      {/* All Bets */}
      <div style={s.card}>
        <div style={s.cardTitle}>All Bets ({(state.bets || []).length})</div>
        {(state.bets || []).length === 0
          ? <div style={{ opacity:0.4, fontSize:13 }}>No bets yet</div>
          : <div style={{ maxHeight:300, overflowY:'auto' }}>
              {[...(state.bets || [])].reverse().map((bet, i) => {
                const horse = HORSES.find(h => h.id === bet.horseId);
                return (
                  <div key={bet.id || i} style={{ display:'flex', gap:8, fontSize:13, padding:'6px 0', borderBottom:'1px solid #222' }}>
                    <span style={{ flex:1 }}>{bet.bettor || '?'}</span>
                    <span style={{ flex:2, opacity:0.7 }}>#{horse?.number} {horse?.name || '?'}</span>
                    <strong style={{ color:'#d4af37' }}>${bet.amount || 0}</strong>
                  </div>
                );
              })}
            </div>}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #2a2a2a', fontSize:14 }}>
      <span style={{ opacity:0.7 }}>{label}</span>
      {children}
    </div>
  );
}

const s = {
  page: { minHeight:'100vh', background:'#111', color:'#eee', padding:'20px 16px 60px', fontFamily:'sans-serif', maxWidth:600, margin:'0 auto' } as React.CSSProperties,
  title: { fontSize:22, color:'#d4af37', margin:0 },
  loginBox: { maxWidth:300, margin:'80px auto', background:'#1e1e1e', borderRadius:12, padding:28, display:'flex', flexDirection:'column' as const, gap:14 },
  loginTitle: { color:'#d4af37', fontSize:20, fontWeight:700, textAlign:'center' as const },
  card: { background:'#1e1e1e', borderRadius:12, padding:16, marginBottom:16, border:'1px solid #2a2a2a' },
  cardTitle: { color:'#d4af37', fontSize:15, fontWeight:700, marginBottom:12 },
  fieldLabel: { fontSize:12, opacity:0.5, marginBottom:6, textTransform:'uppercase' as const, letterSpacing:'0.06em' },
  btn: (bg: string) => ({ display:'block', width:'100%', padding:'11px 12px', background:bg, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600, boxSizing:'border-box' } as React.CSSProperties),
  input: { width:'100%', boxSizing:'border-box' as const, background:'#2a2a2a', border:'1px solid #444', borderRadius:8, padding:'10px 12px', color:'#eee', fontSize:15, marginBottom:8, outline:'none' },
};
