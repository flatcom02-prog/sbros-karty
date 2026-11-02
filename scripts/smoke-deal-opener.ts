/**
 * Smoke: random starter, 4-except-last deal, opening card specials
 * Run: npx tsx scripts/smoke-deal-opener.ts
 */
import {
  applyAction,
  applyOpeningCard,
  createRound,
  type Card,
  type GameState,
} from '../src/game/index.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function blankTwoPlayer(starterIndex = 0): GameState {
  return {
    players: [
      {
        id: 'a',
        name: 'A',
        hand: [{ id: 'K-clubs', suit: 'clubs', rank: 'K' }],
        score: 0,
        isBot: false,
        connected: true,
      },
      {
        id: 'b',
        name: 'B',
        hand: [{ id: 'K-spades', suit: 'spades', rank: 'K' }],
        score: 0,
        isBot: false,
        connected: true,
      },
    ],
    deck: [
      { id: '8-clubs', suit: 'clubs', rank: '8' },
      { id: '8-diamonds', suit: 'diamonds', rank: '8' },
      { id: '8-spades', suit: 'spades', rank: '8' },
    ],
    discard: [],
    currentSuit: null,
    currentPlayerIndex: starterIndex,
    direction: 1,
    pending: { type: 'none' },
    phase: 'playing',
    mustChooseSuitPlayerId: null,
    starterIndex,
    roundNumber: 1,
    winnerId: null,
    loserIds: [],
    lastAction: null,
    drawnThisTurn: false,
  };
}

// --- Hand sizes + starter ---
{
  const players = [
    { id: 'a', name: 'A', isBot: false, score: 0 },
    { id: 'b', name: 'B', isBot: false, score: 0 },
    { id: 'c', name: 'C', isBot: false, score: 0 },
  ];
  let call = 0;
  const rng = () => {
    call++;
    if (call === 1) return 0.5; // floor(0.5*3)=1
    return Math.random();
  };
  const s = createRound(players, 1, rng);
  assert(s.starterIndex === 1, 'starter random → 1');
  const lastDeal = (s.starterIndex - 1 + 3) % 3;
  assert(s.players[lastDeal].hand.length === 3, 'last in deal order has 3');
  for (let i = 0; i < 3; i++) {
    if (i === lastDeal) continue;
    assert(s.players[i].hand.length === 4, `player ${i} has 4`);
  }
  assert(s.discard.length === 1, 'opener on table');
  assert(s.currentPlayerIndex === s.starterIndex, 'current = starter');
}

function withOpener(rank: Card['rank'], suit: Card['suit'] = 'hearts'): GameState {
  const s = blankTwoPlayer(0);
  const opener: Card = { id: `${rank}-${suit}`, suit, rank };
  applyOpeningCard(s, opener, 0, 1);
  return s;
}

{
  const s9 = withOpener('9');
  assert(s9.pending.type === 'must_cover', 'open 9 must_cover');
  assert(s9.currentPlayerIndex === 0, 'starter covers');

  const sQ = withOpener('Q');
  assert(sQ.phase === 'choosing_suit' && sQ.mustChooseSuitPlayerId === 'a', 'open Q');

  const s6 = withOpener('6');
  assert(s6.pending.type === 'draw' && s6.pending.amount === 2, 'open 6');
  s6.players[0].hand.push({ id: '6-spades', suit: 'spades', rank: '6' });
  const stacked = applyAction(s6, { type: 'play', playerId: 'a', cardId: '6-spades' });
  assert(stacked.pending.type === 'draw' && stacked.pending.amount === 4, 'stack open 6');
  assert(stacked.currentPlayerIndex === 1, 'stack to next');

  const s7 = withOpener('7');
  const after7 = applyAction(s7, { type: 'draw', playerId: 'a' });
  assert(after7.currentPlayerIndex === 1 && after7.pending.type === 'none', '7 then next');

  const sA = withOpener('A');
  const afterA = applyAction(sA, { type: 'skip', playerId: 'a' });
  assert(afterA.currentPlayerIndex === 1, 'A skip → next');

  const sN = withOpener('8');
  assert(sN.pending.type === 'none' && sN.phase === 'playing', 'open normal');
}

{
  const s = createRound(
    [
      { id: 'a', name: 'A', isBot: false, score: 0 },
      { id: 'b', name: 'B', isBot: true, score: 0 },
    ],
    2,
    () => 0.25,
  );
  assert(s.starterIndex === 0, 'starter 0');
  assert(s.players[0].hand.length === 4 && s.players[1].hand.length === 3, '4 and 3');
  if (s.pending.type === 'draw' || s.pending.type === 'skip' || s.pending.type === 'must_cover') {
    assert(s.currentPlayerIndex === 0, 'starter faces special');
  }
  if (s.phase === 'choosing_suit') {
    assert(s.mustChooseSuitPlayerId === 'a', 'starter chooses');
  }
}

console.log('SMOKE_DEAL_OPENER OK');
