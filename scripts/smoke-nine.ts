/**
 * Smoke: 9 must-cover + voluntary draw/pass
 * Run: npx tsx scripts/smoke-nine.ts
 */
import {
  applyAction,
  canPlayCard,
  legalPlays,
  startMatch,
  type GameState,
} from '../src/game/index.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function base(): GameState {
  const s0 = startMatch([
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
  return {
    ...structuredClone(s0),
    players: [
      {
        id: 'a',
        name: 'A',
        hand: [
          { id: '9-hearts', suit: 'hearts', rank: '9' },
          { id: '8-hearts', suit: 'hearts', rank: '8' },
          { id: '9-spades', suit: 'spades', rank: '9' },
          { id: 'K-diamonds', suit: 'diamonds', rank: 'K' },
        ],
        score: 0,
        isBot: false,
        connected: true,
      },
      {
        id: 'b',
        name: 'B',
        hand: [{ id: 'K-clubs', suit: 'clubs', rank: 'K' }],
        score: 0,
        isBot: false,
        connected: true,
      },
    ],
    discard: [{ id: '10-hearts', suit: 'hearts', rank: '10' }],
    currentSuit: 'hearts',
    currentPlayerIndex: 0,
    pending: { type: 'none' },
    phase: 'playing',
    drawnThisTurn: false,
    mustChooseSuitPlayerId: null,
  };
}

let s = base();
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '9-hearts' });
assert(s.pending.type === 'must_cover' && s.pending.nineSuit === 'hearts', 'must_cover');
assert(canPlayCard(s, { id: '8-hearts', suit: 'hearts', rank: '8' }), 'suit cover');
assert(canPlayCard(s, { id: '9-spades', suit: 'spades', rank: '9' }), '9 cover');

s = applyAction(s, { type: 'play', playerId: 'a', cardId: '9-spades' });
assert(s.pending.type === 'must_cover' && s.pending.nineSuit === 'spades', 'chain 9');

s = base();
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '9-hearts' });
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '8-hearts' });
assert(s.pending.type === 'none' && s.currentPlayerIndex === 1, 'cover done');

s = base();
s.players[0].hand = [
  { id: '9-hearts', suit: 'hearts', rank: '9' },
  { id: 'K-clubs', suit: 'clubs', rank: 'K' },
];
s.deck = [{ id: '6-clubs', suit: 'clubs', rank: '6' }];
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '9-hearts' });
assert(legalPlays(s, 'a').length === 0, 'no cover');
s = applyAction(s, { type: 'draw', playerId: 'a' });
assert(s.currentPlayerIndex === 0, 'turn kept after draw');
if (legalPlays(s, 'a').length === 0) {
  s = applyAction(s, { type: 'skip', playerId: 'a' });
}
assert(s.currentPlayerIndex === 1, 'pass after failed cover');

s = base();
s.players[0].hand = [
  { id: '8-hearts', suit: 'hearts', rank: '8' },
  { id: 'K-spades', suit: 'spades', rank: 'K' },
];
s = applyAction(s, { type: 'draw', playerId: 'a' });
assert(s.drawnThisTurn, 'voluntary draw');
s = applyAction(s, { type: 'skip', playerId: 'a' });
assert(s.currentPlayerIndex === 1, 'pass after draw');

s = base();
s.players[0].hand = [
  { id: '9-hearts', suit: 'hearts', rank: '9' },
  { id: 'Q-clubs', suit: 'clubs', rank: 'Q' },
  { id: 'K-diamonds', suit: 'diamonds', rank: 'K' },
];
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '9-hearts' });
s = applyAction(s, {
  type: 'play',
  playerId: 'a',
  cardId: 'Q-clubs',
  chosenSuit: 'spades',
});
assert(s.currentSuit === 'spades' && s.currentPlayerIndex === 1, 'queen cover');

console.log('SMOKE_NINE_AND_PASS OK');
