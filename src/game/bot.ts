import { canPlayCard, legalPlays } from './rules';
import type { GameAction, GameState, PlayerId, Suit } from './types';
import { SUITS } from './types';

/**
 * Simple heuristic bot:
 * - must_cover → prefer non-9 cover, then 9, then Queen
 * - If must take draw stack and has 6 → play 6
 * - Prefer non-special cards; save A/6/7/9/Q
 */
export function chooseBotAction(state: GameState, playerId: PlayerId): GameAction | null {
  if (state.phase === 'choosing_suit' && state.mustChooseSuitPlayerId === playerId) {
    return { type: 'choose_suit', playerId, suit: bestSuit(state, playerId) };
  }

  if (state.phase !== 'playing') return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || state.players[state.currentPlayerIndex].id !== playerId) return null;

  if (state.pending.type === 'skip') {
    return { type: 'skip', playerId };
  }

  if (state.pending.type === 'draw') {
    if (state.pending.fromRank === '6') {
      const six = player.hand.find((c) => c.rank === '6' && canPlayCard(state, c));
      if (six) return { type: 'play', playerId, cardId: six.id };
    }
    return { type: 'draw', playerId };
  }

  // Cover a 9
  if (state.pending.type === 'must_cover') {
    const covers = legalPlays(state, playerId);
    if (covers.length === 0) {
      if (!state.drawnThisTurn) return { type: 'draw', playerId };
      return { type: 'skip', playerId };
    }
    const coverPriority = (rank: string): number => {
      if (rank === '9') return 3;
      if (rank === 'Q') return 2;
      return 1; // suit cover preferred
    };
    const sorted = [...covers].sort((a, b) => coverPriority(a.rank) - coverPriority(b.rank));
    const choice = sorted[0];
    if (choice.rank === 'Q') {
      return {
        type: 'play',
        playerId,
        cardId: choice.id,
        chosenSuit: bestSuit(state, playerId),
      };
    }
    return { type: 'play', playerId, cardId: choice.id };
  }

  const plays = legalPlays(state, playerId);
  if (plays.length === 0) {
    if (!state.drawnThisTurn) return { type: 'draw', playerId };
    return { type: 'skip', playerId };
  }

  // Prefer: normal → 7 → 6 → A → 9 → Q (avoid opening 9 without need)
  const rankPriority = (rank: string): number => {
    if (rank === 'Q') return 6;
    if (rank === '9') return 5;
    if (rank === 'A') return 4;
    if (rank === '6') return 3;
    if (rank === '7') return 2;
    return 1;
  };

  const sorted = [...plays].sort((a, b) => rankPriority(a.rank) - rankPriority(b.rank));
  const choice = sorted[0];

  if (choice.rank === 'Q') {
    return {
      type: 'play',
      playerId,
      cardId: choice.id,
      chosenSuit: bestSuit(state, playerId),
    };
  }

  return { type: 'play', playerId, cardId: choice.id };
}

function bestSuit(state: GameState, playerId: PlayerId): Suit {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 'hearts';
  const counts: Record<Suit, number> = {
    hearts: 0,
    diamonds: 0,
    clubs: 0,
    spades: 0,
  };
  for (const c of player.hand) {
    if (c.rank === 'Q') continue;
    counts[c.suit]++;
  }
  let best: Suit = SUITS[0];
  for (const s of SUITS) {
    if (counts[s] > counts[best]) best = s;
  }
  return best;
}
