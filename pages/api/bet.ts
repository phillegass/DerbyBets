import type { NextApiRequest, NextApiResponse } from 'next';
import { getUpstashState, setUpstashState } from './race';

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { bettor, phone, horseId, amount } = req.body || {};

  if (!bettor || typeof bettor !== 'string' || bettor.trim().length < 2)
    return res.status(400).json({ error: 'Enter your name (at least 2 characters)' });
  if (!horseId || typeof horseId !== 'number')
    return res.status(400).json({ error: 'Select a horse' });
  if (!amount || typeof amount !== 'number' || amount < 1 || amount > 100)
    return res.status(400).json({ error: 'Bet must be between $1 and $100' });

  try {
    const state = await getUpstashState();
    if (state.status !== 'open')
      return res.status(400).json({ error: 'Betting is currently closed' });

    const bets = state.bets || [];

    // Check duplicate on same horse
    const alreadyBet = bets.find(
      (b: any) => b.bettor?.toLowerCase() === bettor.trim().toLowerCase() && b.horseId === horseId
    );
    if (alreadyBet) return res.status(400).json({ error: `You've already bet on horse #${horseId}` });

    // Check per-person total
    const personTotal = bets
      .filter((b: any) => b.bettor?.toLowerCase() === bettor.trim().toLowerCase())
      .reduce((s: number, b: any) => s + (b.amount || 0), 0);
    if (personTotal + amount > 200)
      return res.status(400).json({ error: `Max $200 total per person. You have $${personTotal} so far.` });

    const newBet = {
      id: makeId(),
      bettor: bettor.trim(),
      phone: (phone || '').trim(),
      horseId,
      amount,
      timestamp: Date.now(),
    };
    const newState = { ...state, bets: [...bets, newBet] };
    await setUpstashState(newState);
    res.json({ success: true, bet: newBet });
  } catch (err: any) {
    console.error('bet handler error:', err);
    res.status(500).json({ error: 'Server error — try again' });
  }
}
