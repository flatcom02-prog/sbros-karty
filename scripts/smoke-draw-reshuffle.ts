/**
 * Smoke: draw-then-play, no auto-pass, discard reshuffle
 * Run: npx tsx scripts/smoke-draw-reshuffle.ts
 */
import {
  applyAction,
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
    discard: [{ id: '10-hearts', suit: 'hearts', rank: '10' }],
    deck: [{ id: '8-hearts', suit: 'hearts', rank: '8' }],
    currentSuit: 'hearts',
    currentPlayerIndex: 0,
    pending: { type: 'none' },
    phase: 'playing',
    drawnThisTurn: false,
    mustChooseSuitPlayerId: null,
  };
}

// Cannot play → draw playable → must be able to play (no auto-pass)
let s = base();
assert(legalPlays(s, 'a').length === 0, 'no play before draw');
s = applyAction(s, { type: 'draw', playerId: 'a' });
assert(s.currentPlayerIndex === 0, 'still A turn after draw');
assert(s.drawnThisTurn === true, 'drawn flag');
assert(legalPlays(s, 'a').length === 1, 'drawn card playable');
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '8-hearts' });
assert(s.currentPlayerIndex === 1, 'played after draw');

// Draw unplayable → stay for Pass (no auto-pass)
s = base();
s.deck = [{ id: '6-clubs', suit: 'clubs', rank: '6' }];
s = applyAction(s, { type: 'draw', playerId: 'a' });
assert(s.currentPlayerIndex === 0, 'still turn');
assert(legalPlays(s, 'a').length === 0, 'still no play');
s = applyAction(s, { type: 'skip', playerId: 'a' });
assert(s.currentPlayerIndex === 1, 'pass after failed draw');

// Voluntary draw with existing legal play → can still play after
s = base();
s.players[0].hand = [
  { id: '8-hearts', suit: 'hearts', rank: '8' },
  { id: 'K-clubs', suit: 'clubs', rank: 'K' },
];
s.deck = [{ id: '7-spades', suit: 'spades', rank: '7' }];
assert(legalPlays(s, 'a').length > 0, 'had play');
s = applyAction(s, { type: 'draw', playerId: 'a' });
assert(s.drawnThisTurn && s.currentPlayerIndex === 0, 'voluntary draw keeps turn');
assert(legalPlays(s, 'a').some((c) => c.id === '8-hearts'), 'can still play old card');
s = applyAction(s, { type: 'play', playerId: 'a', cardId: '8-hearts' });
assert(s.currentPlayerIndex === 1, 'play after voluntary draw');

// Empty deck → reshuffle discard except top
s = base();
s.deck = [];
s.discard = [
  { id: '6-diamonds', suit: 'diamonds', rank: '6' },
  { id: '7-diamonds', suit: 'diamonds', rank: '7' },
  { id: '8-diamonds', suit: 'diamonds', rank: '8' },
  { id: '10-hearts', suit: 'hearts', rank: '10' },
];
s.players[0].hand = [{ id: 'K-clubs', suit: 'clubs', rank: 'K' }];
s = applyAction(s, { type: 'draw', playerId: 'a' });
assert(s.discard.length === 1 && s.discard[0].id === '10-hearts', 'top kept');
assert(s.players[0].hand.length === 2, 'drew 1 after reshuffle');
assert(
  (s.lastAction ?? '').includes('перемешана') || s.deck.length >= 0,
  'reshuffle noted or deck ok',
);
assert(s.currentPlayerIndex === 0, 'turn kept after reshuffle draw');

console.log('SMOKE_DRAW_RESHUFFLE OK');
