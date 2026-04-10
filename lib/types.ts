export interface Horse {
  id: number;
  name: string;
  number: number;
  jockey: string;
  color: string;
}

export interface Bet {
  id: string;
  bettor: string;
  horseId: number;
  amount: number;
  timestamp: number;
}

export interface RaceState {
  status: 'open' | 'closed' | 'finished';
  winnerHorseId?: number;
  bets: Bet[];
  rake: number; // percentage (e.g. 15 = 15%)
}

export const HORSES: Horse[] = [
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

export function computePool(bets: Bet[], rake: number) {
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const payoutPool = total * (1 - rake / 100);

  const byHorse: Record<number, number> = {};
  for (const b of bets) {
    byHorse[b.horseId] = (byHorse[b.horseId] || 0) + b.amount;
  }

  // Odds = (payoutPool / amountOnHorse) — shown as "X to $1"
  const odds: Record<number, number> = {};
  for (const [hid, amt] of Object.entries(byHorse)) {
    odds[Number(hid)] = payoutPool / amt;
  }

  return { total, payoutPool, byHorse, odds };
}

export function computePayout(
  bets: Bet[],
  winnerId: number,
  rake: number,
  bettorName: string
): number {
  const winnerBets = bets.filter((b) => b.horseId === winnerId);
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const payoutPool = total * (1 - rake / 100);
  const totalOnWinner = winnerBets.reduce((s, b) => s + b.amount, 0);
  const myBets = winnerBets.filter((b) => b.bettor === bettorName);
  const myAmount = myBets.reduce((s, b) => s + b.amount, 0);
  if (totalOnWinner === 0 || myAmount === 0) return 0;
  return (myAmount / totalOnWinner) * payoutPool;
}
