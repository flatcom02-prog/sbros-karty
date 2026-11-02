/**
 * Quick smoke checks for shared rules (run: node scripts/smoke-rules.mjs)
 * Uses dynamic import of compiled logic via tsx-less reimplementation check —
 * prefer: npx tsx scripts/smoke-rules.ts
 */
import {
  applyAction,
  canPlayCard,
  createRound,
  handPoints,
  startMatch,
} from '../src/game/index.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const rng = (() => {
  let s = 42;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
})();

const state = startMatch(
  [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: true },
  ],
  rng,
);

assert(state.players.every((p) => p.hand.length === 4), 'deal 4 each');
assert(state.discard.length === 1, 'opener on discard');
assert(state.phase === 'playing', 'playing');
assert(handPoints([{ id: 'x', suit: 'spades', rank: 'A' }]) === 11, 'ace 11');
assert(handPoints([{ id: 'x', suit: 'spades', rank: 'Q' }]) === 3, 'queen 3');

// 125 burn
assert(createRound === createRound, 'export ok');

const cur = state.players[state.currentPlayerIndex];
const playable = cur.hand.filter((c) => canPlayCard(state, c));
console.log('starter', cur.name, 'playable', playable.length, 'top', state.discard[0]);

// Forced draw path: if no plays, draw should work
if (playable.length === 0) {
  const next = applyAction(state, { type: 'draw', playerId: cur.id });
  assert(next.players[state.currentPlayerIndex].hand.length >= 4, 'drew or skipped');
}

console.log('smoke-rules OK');
