import type { NextApiRequest, NextApiResponse } from 'next';

const HORSES = [
  { id: 1,  number: 1,  name: "Renegade",       jockey: "I. Ortiz Jr.",     color: "#1a5cb5", odds: "4-1"  },
  { id: 2,  number: 2,  name: "Albus",           jockey: "M. Franco",        color: "#2e7d32", odds: "30-1" },
  { id: 3,  number: 3,  name: "Intrepido",       jockey: "H. Berrios",       color: "#6a1b9a", odds: "50-1" },
  { id: 4,  number: 4,  name: "Litmus Test",     jockey: "J. Hernandez",     color: "#c62828", odds: "30-1" },
  { id: 6,  number: 6,  name: "Commandment",     jockey: "L. Saez",          color: "#1565c0", odds: "6-1"  },
  { id: 7,  number: 7,  name: "Danon Bourbon",   jockey: "A. Nishimura",     color: "#bdbdbd", odds: "20-1" },
  { id: 8,  number: 8,  name: "So Happy",        jockey: "M. Smith",         color: "#f9a825", odds: "15-1" },
  { id: 10, number: 10, name: "Wonder Dean",     jockey: "R. Sakai",         color: "#b71c1c", odds: "30-1" },
  { id: 11, number: 11, name: "Incredibolt",     jockey: "J. Torres",        color: "#388e3c", odds: "20-1" },
  { id: 12, number: 12, name: "Chief Wallabee",  jockey: "J. Alvarado",      color: "#1b5e20", odds: "8-1"  },
  { id: 14, number: 14, name: "Potente",         jockey: "J. Hernandez",     color: "#e65100", odds: "20-1" },
  { id: 15, number: 15, name: "Emerging Market", jockey: "B. Hernandez Jr.", color: "#880e4f", odds: "15-1" },
  { id: 16, number: 16, name: "Pavlovian",       jockey: "J. Rosario",       color: "#757575", odds: "30-1" },
  { id: 17, number: 17, name: "Six Speed",       jockey: "A. Achard",        color: "#212121", odds: "50-1" },
  { id: 18, number: 18, name: "Further Ado",     jockey: "J. Velazquez",     color: "#33691e", odds: "6-1"  },
  { id: 19, number: 19, name: "Golden Tempo",    jockey: "J. Ortiz",         color: "#0d47a1", odds: "30-1" },
  { id: 21, number: 21, name: "Great White",     jockey: "A. Achard",        color: "#9e9e9e", odds: "50-1" },
  { id: 22, number: 22, name: "Ocelli",          jockey: "J. Ramos",         color: "#00695c", odds: "50-1" },
  { id: 23, number: 23, name: "Robusta",         jockey: "C. Torres",        color: "#8d1515", odds: "50-1" },
];

export async function getUpstashState() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const defaultState = { status: 'open', bets: [], rake: 15 };
  if (!url || !token) return defaultState;
  try {
    const res = await fetch(`${url}/get/derby:race`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!json.result) return defaultState;
    const parsed = JSON.parse(json.result);
    return {
      status: parsed.status ?? 'open',
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
      rake: parsed.rake ?? 15,
      ...(parsed.winnerHorseId ? { winnerHorseId: parsed.winnerHorseId } : {}),
    };
  } catch (e) {
    console.error('getState error:', e);
    return defaultState;
  }
}

export async function setUpstashState(state: any) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  const encoded = encodeURIComponent(JSON.stringify(state));
  await fetch(`${url}/set/derby:race/${encoded}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const state = await getUpstashState();
    const bets = state.bets || [];
    const rake = state.rake ?? 15;
    const total = bets.reduce((s: number, b: any) => s + (b.amount || 0), 0);
    const payoutPool = total * (1 - rake / 100);
    const byHorse: Record<number, number> = {};
    for (const b of bets) byHorse[b.horseId] = (byHorse[b.horseId] || 0) + (b.amount || 0);
    const odds: Record<number, number> = {};
    for (const [hid, amt] of Object.entries(byHorse))
      if ((amt as number) > 0) odds[Number(hid)] = payoutPool / (amt as number);
    res.json({ state, pool: { total, payoutPool, byHorse, odds }, horses: HORSES });
  } catch (err: any) {
    console.error('race handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
