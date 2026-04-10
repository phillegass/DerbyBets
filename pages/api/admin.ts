import type { NextApiRequest, NextApiResponse } from 'next';
import { getUpstashState, setUpstashState } from './race';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'derby2025';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password, action, winnerHorseId, rake } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });

  try {
    const state: any = await getUpstashState();

    if (action === 'open') {
      state.status = 'open';
      delete state.winnerHorseId;
    } else if (action === 'close') {
      state.status = 'closed';
    } else if (action === 'setWinner') {
      if (!winnerHorseId) return res.status(400).json({ error: 'No winner provided' });
      state.status = 'finished';
      state.winnerHorseId = Number(winnerHorseId);
    } else if (action === 'reset') {
      await setUpstashState({ status: 'open', bets: [], rake: state.rake ?? 15 });
      return res.json({ success: true, message: 'Race reset!' });
    } else if (action === 'setRake') {
      if (typeof rake !== 'number' || rake < 0 || rake > 50)
        return res.status(400).json({ error: 'Rake must be 0–50' });
      state.rake = rake;
    } else {
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    await setUpstashState(state);
    res.json({ success: true, state });
  } catch (err: any) {
    console.error('admin handler error:', err);
    res.status(500).json({ error: 'Server error: ' + (err?.message || 'unknown') });
  }
}
