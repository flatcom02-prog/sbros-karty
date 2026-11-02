import {
  applyAction,
  canPlayCard,
  handPoints,
  startMatch,
} from '../src/game/index.ts';

function assert(cond: unknown, msg: string): asserts cond {
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

const hands = state.players.map((p) => p.hand.length).sort();
assert(hands[0] === 3 && hands[1] === 4, 'deal 3+4 (last in order misses 4th)');
assert(state.discard.length === 1, 'opener on discard');
assert(
  state.phase === 'playing' || state.phase === 'choosing_suit',
  'playing or choosing suit from opener',
);
assert(handPoints([{ id: 'x', suit: 'spades', rank: 'A' }]) === 11, 'ace 11');
assert(handPoints([{ id: 'x', suit: 'spades', rank: 'Q' }]) === 3, 'queen 3');

if (state.phase === 'choosing_suit') {
  const id = state.mustChooseSuitPlayerId!;
  const next = applyAction(state, { type: 'choose_suit', playerId: id, suit: 'hearts' });
  assert(next.currentSuit === 'hearts', 'suit chosen');
} else if (state.pending.type === 'skip') {
  const cur = state.players[state.currentPlayerIndex];
  applyAction(state, { type: 'skip', playerId: cur.id });
} else if (state.pending.type === 'draw') {
  const cur = state.players[state.currentPlayerIndex];
  applyAction(state, { type: 'draw', playerId: cur.id });
} else {
  const cur = state.players[state.currentPlayerIndex];
  const playable = cur.hand.filter((c) => canPlayCard(state, c));
  console.log('starter', cur.name, 'playable', playable.length);
  if (playable.length === 0) {
    const next = applyAction(state, { type: 'draw', playerId: cur.id });
    assert(next.players.some((p) => p.id === cur.id), 'player remains');
  } else {
    const card = playable[0];
    const next = applyAction(state, {
      type: 'play',
      playerId: cur.id,
      cardId: card.id,
      chosenSuit: card.rank === 'Q' ? 'hearts' : undefined,
    });
    assert(next.discard.at(-1)?.id === card.id, 'card played');
  }
}

console.log('smoke-rules OK');
