import type { NextApiRequest, NextApiResponse } from 'next';

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
    for (const b of bets) {
      byHorse[b.horseId] = (byHorse[b.horseId] || 0) + (b.amount || 0);
    }
    const odds: Record<number, number> = {};
    for (const [hid, amt] of Object.entries(byHorse)) {
      if ((amt as number) > 0) odds[Number(hid)] = payoutPool / (amt as number);
    }
    res.json({ state, pool: { total, payoutPool, byHorse, odds }, horses: HORSES });
  } catch (err: any) {
    console.error('race handler error:', err);
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
