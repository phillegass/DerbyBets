import type { NextApiRequest, NextApiResponse } from 'next';
import { getUpstashState, setUpstashState } from './race';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'derby2025';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password, action, betId, bettor } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });

  try {
    const state = await getUpstashState();
    const bets = state.bets || [];

    if (action === 'deleteBet') {
      // Delete a single bet by id
      state.bets = bets.filter((b: any) => b.id !== betId);
    } else if (action === 'deleteUser') {
      // Delete all bets for a bettor
      state.bets = bets.filter((b: any) => b.bettor !== bettor);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    await setUpstashState(state);
    res.json({ success: true });
  } catch (err: any) {
    console.error('delete handler error:', err);
    res.status(500).json({ error: 'Server error: ' + (err?.message || 'unknown') });
  }
}
