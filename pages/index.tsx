import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ─── Inlined types (no lib import) ───────────────────────────────────────────
interface Bet { id: string; bettor: string; horseId: number; amount: number; timestamp: number; }
interface Horse { id: number; name: string; number: number; jockey: string; color: string; }
interface RaceState { status: 'open' | 'closed' | 'finished'; winnerHorseId?: number; bets: Bet[]; rake: number; }
interface PoolData { total: number; payoutPool: number; byHorse: Record<number, number>; odds: Record<number, number>; }
interface RaceData { state: RaceState; pool: PoolData; horses: Horse[]; }

function computeMyPayout(bets: Bet[], winnerId: number, rake: number, bettor: string): number {
  const winnerBets = bets.filter(b => b.horseId === winnerId);
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const payoutPool = total * (1 - rake / 100);
  const totalOnWinner = winnerBets.reduce((s, b) => s + b.amount, 0);
  const myAmount = winnerBets.filter(b => b.bettor === bettor).reduce((s, b) => s + b.amount, 0);
  if (totalOnWinner === 0 || myAmount === 0) return 0;
  return (myAmount / totalOnWinner) * payoutPool;
}

const PRESET_AMOUNTS = [5, 10, 20, 50];

export default function Home() {
  const [data, setData] = useState<RaceData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [betLoading, setBetLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [view, setView] = useState<'bet' | 'odds' | 'mybets'>('bet');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/race');
      if (!res.ok) { setLoadError(true); return; }
      const json = await res.json();
      if (json && json.state && json.horses) {
        setData(json);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('derby_name');
    if (saved) setSavedName(saved);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleNameSubmit = () => {
    if (name.trim().length < 2) return;
    setSavedName(name.trim());
    localStorage.setItem('derby_name', name.trim());
  };

  const handleBet = async () => {
    if (!selectedHorse || !savedName) return;
    setBetLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bettor: savedName, horseId: selectedHorse, amount }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: `✅ $${amount} bet placed on horse #${selectedHorse}!`, type: 'success' });
        setSelectedHorse(null);
        fetchData();
      } else {
        setMessage({ text: json.error || 'Something went wrong', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error — try again', type: 'error' });
    }
    setBetLoading(false);
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (!data) {
    return (
      <div style={st.loadPage}>
        <Head>
          <title>🌹 Derby Betting 2025</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        </Head>
        {loadError ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🐴</div>
            <div style={{ fontSize: 16, marginBottom: 20, opacity: 0.8 }}>Couldn't connect to the server</div>
            <button style={st.retryBtn} onClick={fetchData}>Retry</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🐴</div>
            <div style={{ fontSize: 16, opacity: 0.6 }}>Loading race data…</div>
          </>
        )}
      </div>
    );
  }

  const { state, pool, horses } = data;
  const myBets = state.bets.filter(b => b.bettor.toLowerCase() === savedName.toLowerCase());
  const winner = state.winnerHorseId ? horses.find(h => h.id === state.winnerHorseId) : null;
  const myPayout = state.status === 'finished' && state.winnerHorseId
    ? computeMyPayout(state.bets, state.winnerHorseId, state.rake, savedName)
    : null;

  return (
    <>
      <Head>
        <title>🌹 Derby Betting 2025</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <div style={st.page}>

        {/* ── Header ── */}
        <header style={st.header}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🌹🌹🌹</div>
          <h1 style={st.title}>DERBY BETTING</h1>
          <div style={st.subtitle}>Kentucky Derby 2025</div>
          <div style={st.badge(state.status)}>
            {state.status === 'open' ? '🟢 BETTING OPEN' : state.status === 'closed' ? '🔴 BETTING CLOSED' : '🏆 RACE FINISHED'}
          </div>
          {state.status !== 'finished' && (
            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85, fontFamily: 'sans-serif' }}>
              Total Pool: <strong>${pool.total.toFixed(2)}</strong>
            </div>
          )}
        </header>

        {/* ── Winner Banner ── */}
        {state.status === 'finished' && winner && (
          <div style={st.winnerBanner}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.1em' }}>🏆 WINNER 🏆</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>#{winner.number} {winner.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{winner.jockey}</div>
            {myPayout !== null && myPayout > 0 && (
              <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900, color: '#1a5c00' }}>
                💰 YOU WIN ${myPayout.toFixed(2)}!
              </div>
            )}
            {myPayout === 0 && myBets.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 15, opacity: 0.7 }}>Better luck next time, {savedName}!</div>
            )}
          </div>
        )}

        {/* ── Name Entry ── */}
        {!savedName ? (
          <div style={st.nameCard}>
            <div style={{ fontSize: 20, marginBottom: 16, color: '#d4af37' }}>Who's betting? 🎩</div>
            <input
              style={st.nameInput}
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
              autoFocus
            />
            <button style={st.nameBtn} onClick={handleNameSubmit} disabled={name.trim().length < 2}>
              Let's Bet! →
            </button>
          </div>
        ) : (
          <>
            {/* Greeting */}
            <div style={st.greeting}>
              🎩 Betting as <strong>{savedName}</strong>
              <button style={st.changeBtn} onClick={() => { setSavedName(''); setName(''); localStorage.removeItem('derby_name'); }}>
                (change)
              </button>
            </div>

            {/* Tabs */}
            <div style={st.tabs}>
              {(['bet', 'odds', 'mybets'] as const).map(tab => (
                <button key={tab} style={st.tab(view === tab)} onClick={() => setView(tab)}>
                  {tab === 'bet' ? '🏇 Place Bet' : tab === 'odds' ? '📊 Odds' : `🎟️ My Bets (${myBets.length})`}
                </button>
              ))}
            </div>

            {/* ── BET TAB ── */}
            {view === 'bet' && (
              <div style={st.section}>
                {state.status !== 'open' ? (
                  <div style={st.closedMsg}>
                    {state.status === 'closed'
                      ? '🔒 Betting is closed — the race is about to start!'
                      : '🏁 The race is over. Check the Odds tab for results.'}
                  </div>
                ) : (
                  <>
                    <div style={st.label}>1. Pick your horse</div>
                    <div style={st.grid}>
                      {horses.map(horse => {
                        const isSelected = selectedHorse === horse.id;
                        const alreadyBet = myBets.some(b => b.horseId === horse.id);
                        return (
                          <button
                            key={horse.id}
                            style={st.horseBtn(isSelected, horse.color, alreadyBet)}
                            onClick={() => setSelectedHorse(isSelected ? null : horse.id)}
                          >
                            <span style={st.horseNum(horse.color)}>#{horse.number}</span>
                            <span style={st.horseName}>{horse.name}</span>
                            <span style={st.horseJockey}>{horse.jockey}</span>
                            {pool.odds[horse.id]
                              ? <span style={st.horseOdds}>{pool.odds[horse.id].toFixed(1)}x</span>
                              : <span style={st.horseOddsBlank}>—</span>}
                            {alreadyBet && <span style={st.betBadge}>✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    {selectedHorse && (
                      <>
                        <div style={{ ...st.label, marginTop: 20 }}>2. Choose amount</div>
                        <div style={st.amountRow}>
                          {PRESET_AMOUNTS.map(a => (
                            <button key={a} style={st.amtBtn(amount === a)} onClick={() => setAmount(a)}>
                              ${a}
                            </button>
                          ))}
                        </div>
                        <div style={st.customRow}>
                          <span style={{ color: '#d4af37', fontSize: 18, marginRight: 4 }}>$</span>
                          <input
                            type="number" min={1} max={100} value={amount}
                            onChange={e => setAmount(Math.max(1, Math.min(100, Number(e.target.value))))}
                            style={st.customInput}
                          />
                        </div>
                        {message && <div style={st.msg(message.type)}>{message.text}</div>}
                        <button style={st.betBtn} onClick={handleBet} disabled={betLoading}>
                          {betLoading ? 'Placing…' : `🌹 Bet $${amount} on #${selectedHorse}`}
                        </button>
                      </>
                    )}
                    {message && !selectedHorse && <div style={st.msg(message.type)}>{message.text}</div>}
                  </>
                )}
              </div>
            )}

            {/* ── ODDS TAB ── */}
            {view === 'odds' && (
              <div style={st.section}>
                <div style={st.oddsHeader}>
                  <span>Total Pool: <strong>${pool.total.toFixed(2)}</strong></span>
                  <span style={{ fontSize: 12, opacity: 0.5 }}>Rake: {state.rake}%</span>
                </div>
                <div style={st.oddsHead}>
                  <span>#</span><span>Horse</span><span>Pool</span><span>Odds</span>
                </div>
                {horses
                  .slice().sort((a, b) => (pool.byHorse[b.id] || 0) - (pool.byHorse[a.id] || 0))
                  .map(horse => (
                    <div key={horse.id} style={st.oddsRow(state.winnerHorseId === horse.id, horse.color)}>
                      <span style={st.oddsNum(horse.color)}>#{horse.number}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{horse.name}</span>
                      <span style={{ fontSize: 13, fontFamily: 'sans-serif' }}>${(pool.byHorse[horse.id] || 0).toFixed(0)}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#d4af37', fontFamily: 'sans-serif' }}>
                        {pool.odds[horse.id] ? `${pool.odds[horse.id].toFixed(1)}x` : '—'}
                      </span>
                    </div>
                  ))}
                <div style={{ marginTop: 14, fontSize: 12, opacity: 0.4, fontFamily: 'sans-serif', textAlign: 'center' }}>
                  Odds = your payout multiplier. 4x means a $10 bet returns $40.
                </div>
              </div>
            )}

            {/* ── MY BETS TAB ── */}
            {view === 'mybets' && (
              <div style={st.section}>
                {myBets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5, fontFamily: 'sans-serif' }}>
                    No bets yet — go pick a horse! 🏇
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, marginBottom: 12, fontFamily: 'sans-serif', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: 10 }}>
                      Total wagered: <strong>${myBets.reduce((s, b) => s + b.amount, 0)}</strong>
                    </div>
                    {myBets.map(bet => {
                      const horse = horses.find(h => h.id === bet.horseId);
                      const isWin = state.winnerHorseId === bet.horseId;
                      const isLoss = state.status === 'finished' && !isWin;
                      return (
                        <div key={bet.id} style={st.myBetCard(isWin, isLoss, horse?.color || '#888')}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700 }}>#{horse?.number} {horse?.name}</div>
                              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2, fontFamily: 'sans-serif' }}>{horse?.jockey}</div>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#d4af37', fontFamily: 'sans-serif' }}>${bet.amount}</div>
                          </div>
                          {isWin && myPayout !== null && (
                            <div style={{ marginTop: 8, color: '#7fff7f', fontWeight: 700, fontFamily: 'sans-serif' }}>
                              🏆 Payout: ${myPayout.toFixed(2)}
                            </div>
                          )}
                          {isLoss && (
                            <div style={{ marginTop: 8, opacity: 0.5, fontSize: 13, fontFamily: 'sans-serif' }}>❌ No luck this time</div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: 'center', padding: '24px 0 8px', fontSize: 11, opacity: 0.3, fontFamily: 'sans-serif' }}>
          🌹 For entertainment only · Updates every 5s
        </div>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = {
  loadPage: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh',
    background: '#1a0a00', color: '#f5e6c8',
    fontFamily: 'Georgia, serif',
  },
  retryBtn: {
    padding: '12px 28px', background: '#8B0000',
    color: '#d4af37', border: '2px solid #d4af37',
    borderRadius: 10, fontSize: 16, cursor: 'pointer',
    fontFamily: 'sans-serif',
  },
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #1a0a00 0%, #2d1200 40%, #1a0a00 100%)',
    color: '#f5e6c8',
    fontFamily: 'Georgia, Times New Roman, serif',
    paddingBottom: 40,
  } as React.CSSProperties,
  header: {
    background: 'linear-gradient(180deg, #8B0000 0%, #5c0000 100%)',
    textAlign: 'center' as const, padding: '24px 16px 20px',
    borderBottom: '3px solid #d4af37',
  },
  title: {
    margin: 0, fontSize: 28, fontWeight: 900,
    letterSpacing: '0.12em', color: '#d4af37',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  subtitle: { fontSize: 13, opacity: 0.85, marginTop: 2, letterSpacing: '0.08em' },
  badge: (status: string) => ({
    display: 'inline-block', marginTop: 10, padding: '4px 14px',
    borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif',
    background: status === 'open' ? 'rgba(0,180,0,0.2)' : status === 'closed' ? 'rgba(200,0,0,0.2)' : 'rgba(212,175,55,0.2)',
    border: `1px solid ${status === 'open' ? '#00b400' : status === 'closed' ? '#c00' : '#d4af37'}`,
    color: status === 'open' ? '#7fff7f' : status === 'closed' ? '#ff8080' : '#d4af37',
  }),
  winnerBanner: {
    background: 'linear-gradient(135deg, #d4af37, #b8860b)',
    color: '#1a0a00', textAlign: 'center' as const,
    padding: '20px 16px', borderBottom: '3px solid #8B0000',
  },
  nameCard: {
    margin: '32px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 16, padding: '28px 20px', textAlign: 'center' as const,
  },
  nameInput: {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(212,175,55,0.4)',
    borderRadius: 10, padding: '12px 14px', fontSize: 18,
    color: '#f5e6c8', fontFamily: 'sans-serif', outline: 'none', marginBottom: 14,
  },
  nameBtn: {
    width: '100%', background: '#8B0000', color: '#d4af37',
    border: '2px solid #d4af37', borderRadius: 10, padding: 14,
    fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif',
  },
  greeting: {
    textAlign: 'center' as const, padding: '12px 16px',
    fontSize: 14, fontFamily: 'sans-serif',
    borderBottom: '1px solid rgba(212,175,55,0.15)',
  },
  changeBtn: {
    background: 'none', border: 'none', color: '#d4af37',
    cursor: 'pointer', fontSize: 13, marginLeft: 6, fontFamily: 'sans-serif',
  },
  tabs: { display: 'flex', borderBottom: '2px solid rgba(212,175,55,0.2)' },
  tab: (active: boolean) => ({
    flex: 1, padding: '12px 4px',
    background: active ? 'rgba(139,0,0,0.4)' : 'transparent',
    color: active ? '#d4af37' : 'rgba(245,230,200,0.6)',
    border: 'none', borderBottom: active ? '2px solid #d4af37' : '2px solid transparent',
    cursor: 'pointer', fontSize: 12, fontFamily: 'sans-serif',
    fontWeight: active ? 700 : 400, marginBottom: -2,
  }),
  section: { padding: 16 },
  label: {
    fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
    color: '#d4af37', marginBottom: 10, fontFamily: 'sans-serif',
    textTransform: 'uppercase' as const,
  },
  closedMsg: {
    textAlign: 'center' as const, padding: '40px 20px',
    fontSize: 16, opacity: 0.8, fontFamily: 'sans-serif',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 8 },
  horseBtn: (selected: boolean, color: string, bet: boolean) => ({
    background: selected ? `${color}44` : 'rgba(255,255,255,0.04)',
    border: selected ? `2px solid ${color}` : bet ? `1px solid ${color}88` : '1px solid rgba(212,175,55,0.15)',
    borderRadius: 10, padding: '10px 8px', textAlign: 'left' as const,
    cursor: 'pointer', position: 'relative' as const,
    display: 'flex', flexDirection: 'column' as const, gap: 2,
  }),
  horseNum: (color: string) => ({
    display: 'inline-block', background: color, color: '#fff',
    borderRadius: 4, padding: '1px 6px', fontSize: 11,
    fontWeight: 700, fontFamily: 'sans-serif', marginBottom: 2, alignSelf: 'flex-start' as const,
  }),
  horseName: { fontSize: 13, fontWeight: 700, color: '#f5e6c8', lineHeight: 1.2 },
  horseJockey: { fontSize: 11, opacity: 0.55, fontFamily: 'sans-serif' },
  horseOdds: {
    position: 'absolute' as const, top: 8, right: 8,
    fontSize: 13, fontWeight: 700, color: '#d4af37', fontFamily: 'sans-serif',
  },
  horseOddsBlank: {
    position: 'absolute' as const, top: 8, right: 8,
    fontSize: 13, opacity: 0.25, fontFamily: 'sans-serif',
  },
  betBadge: {
    position: 'absolute' as const, bottom: 6, right: 8,
    fontSize: 10, color: '#7fff7f', fontFamily: 'sans-serif', fontWeight: 700,
  },
  amountRow: { display: 'flex', gap: 8, marginBottom: 10 },
  amtBtn: (active: boolean) => ({
    flex: 1, padding: '10px 0',
    background: active ? '#8B0000' : 'rgba(255,255,255,0.06)',
    border: active ? '2px solid #d4af37' : '1px solid rgba(212,175,55,0.2)',
    borderRadius: 8, color: active ? '#d4af37' : '#f5e6c8',
    fontWeight: active ? 700 : 400, fontSize: 15,
    cursor: 'pointer', fontFamily: 'sans-serif',
  }),
  customRow: {
    display: 'flex', alignItems: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: 8, padding: '0 12px', marginBottom: 16,
  },
  customInput: {
    flex: 1, background: 'none', border: 'none',
    color: '#f5e6c8', fontSize: 18, padding: '10px 0',
    fontFamily: 'sans-serif', outline: 'none',
  },
  msg: (type: 'success' | 'error') => ({
    padding: '10px 14px', borderRadius: 8, marginBottom: 12,
    background: type === 'success' ? 'rgba(0,180,0,0.15)' : 'rgba(200,0,0,0.15)',
    border: `1px solid ${type === 'success' ? '#00b400' : '#c00'}`,
    color: type === 'success' ? '#7fff7f' : '#ff8080',
    fontSize: 14, fontFamily: 'sans-serif',
  }),
  betBtn: {
    width: '100%', background: 'linear-gradient(135deg, #8B0000, #5c0000)',
    color: '#d4af37', border: '2px solid #d4af37', borderRadius: 12,
    padding: 16, fontSize: 17, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'sans-serif', letterSpacing: '0.04em',
    boxShadow: '0 4px 20px rgba(139,0,0,0.4)',
  },
  oddsHeader: {
    display: 'flex', justifyContent: 'space-between',
    padding: '0 0 10px', borderBottom: '1px solid rgba(212,175,55,0.2)',
    fontSize: 14, fontFamily: 'sans-serif', marginBottom: 6,
  },
  oddsHead: {
    display: 'grid', gridTemplateColumns: '36px 1fr 52px 52px',
    padding: '4px 8px', fontSize: 11, letterSpacing: '0.08em',
    color: '#d4af37', fontFamily: 'sans-serif',
    textTransform: 'uppercase' as const, opacity: 0.6,
  },
  oddsRow: (isWinner: boolean, color: string) => ({
    display: 'grid', gridTemplateColumns: '36px 1fr 52px 52px',
    padding: '9px 8px', borderRadius: 8, marginBottom: 4,
    background: isWinner ? `${color}33` : 'rgba(255,255,255,0.04)',
    border: isWinner ? `1px solid ${color}` : '1px solid rgba(212,175,55,0.08)',
    alignItems: 'center',
  }),
  oddsNum: (color: string) => ({
    display: 'inline-block', background: color, color: '#fff',
    borderRadius: 4, padding: '1px 5px', fontSize: 11,
    fontWeight: 700, fontFamily: 'sans-serif',
  }),
  myBetCard: (isWin: boolean, isLoss: boolean, color: string) => ({
    background: isWin ? `${color}33` : isLoss ? 'rgba(80,0,0,0.3)' : 'rgba(255,255,255,0.05)',
    border: isWin ? `1px solid ${color}` : isLoss ? '1px solid rgba(200,0,0,0.3)' : '1px solid rgba(212,175,55,0.15)',
    borderRadius: 10, padding: '12px 14px', marginBottom: 8,
  }),
};
