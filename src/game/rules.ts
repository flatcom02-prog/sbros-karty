import { createDeck, handPoints, shuffle } from './deck';
import type {
  Card,
  ChooseSuitAction,
  GameAction,
  GameState,
  PlayerId,
  PlayerState,
  Suit,
} from './types';
import {
  MAX_SIX_STACK,
  QUEEN_END_PENALTY,
  QUEEN_SPADES_END_PENALTY,
  SCORE_LIMIT,
} from './types';

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function nextIndex(state: GameState, from: number = state.currentPlayerIndex): number {
  const n = state.players.length;
  return (from + state.direction + n) % n;
}

function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

function findPlayer(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

/** Legal cover for a 9: another 9, same suit as that 9, or Queen. */
export function isLegalNineCover(card: Card, nineSuit: Suit): boolean {
  return card.rank === '9' || card.suit === nineSuit || card.rank === 'Q';
}

/** Can this card be played given top discard + active suit + pending effect? */
export function canPlayCard(state: GameState, card: Card): boolean {
  if (state.phase !== 'playing') return false;
  const pending = state.pending;

  // Must cover a 9 — same player only (caller checks turn)
  if (pending.type === 'must_cover') {
    return isLegalNineCover(card, pending.nineSuit);
  }

  // Must respond to draw stack with another 6 (stacking)
  if (pending.type === 'draw' && pending.fromRank === '6') {
    return card.rank === '6';
  }

  // Must respond to 7 draw: cannot stack — must draw/skip
  if (pending.type === 'draw' && pending.fromRank === '7') {
    return false;
  }

  // Must skip from Ace — no play
  if (pending.type === 'skip') {
    return false;
  }

  const top = state.discard[state.discard.length - 1];
  if (!top) return true;

  // Queen can be played on any card (when not under skip/draw)
  if (card.rank === 'Q') return true;

  const activeSuit = state.currentSuit ?? top.suit;
  return card.suit === activeSuit || card.rank === top.rank;
}

export function legalPlays(state: GameState, playerId: PlayerId): Card[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];
  if (player.id !== currentPlayer(state).id) return [];
  return player.hand.filter((c) => canPlayCard(state, c));
}

export function mustDraw(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== 'playing') return false;
  if (currentPlayer(state).id !== playerId) return false;
  const pending = state.pending;
  if (pending.type === 'draw') return true;
  if (pending.type === 'skip') return false;
  return legalPlays(state, playerId).length === 0 && !state.drawnThisTurn;
}

export function mustSkip(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== 'playing') return false;
  if (currentPlayer(state).id !== playerId) return false;
  if (state.pending.type === 'skip') return true;
  if (state.drawnThisTurn && legalPlays(state, playerId).length === 0) return true;
  if (state.pending.type === 'draw' && state.pending.fromRank === '7') return false;
  return false;
}

/**
 * Draw from deck. If the pile is empty mid-round, shuffle the discard
 * (keeping the top card as the current discard) into a new deck and continue.
 * Returns cards drawn and whether a reshuffle happened.
 */
export function drawFromDeck(
  state: GameState,
  count: number,
): { cards: Card[]; reshuffled: boolean } {
  const drawn: Card[] = [];
  let reshuffled = false;
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length <= 1) break;
      const top = state.discard[state.discard.length - 1];
      const rest = state.discard.slice(0, -1);
      state.deck = shuffle(rest);
      state.discard = [top];
      reshuffled = true;
    }
    const c = state.deck.pop();
    if (c) drawn.push(c);
  }
  return { cards: drawn, reshuffled };
}

function advanceTurn(state: GameState): void {
  state.currentPlayerIndex = nextIndex(state);
  state.drawnThisTurn = false;
  state.pending = { type: 'none' };
}

function applyScoreBurn(score: number): number {
  if (score === SCORE_LIMIT) return 0;
  return score;
}

function finishRound(state: GameState, winnerId: PlayerId, lastCard: Card | null): void {
  state.phase = 'round_over';
  state.winnerId = winnerId;
  state.pending = { type: 'none' };

  for (const p of state.players) {
    if (p.id === winnerId) {
      if (lastCard?.rank === 'Q') {
        const penalty =
          lastCard.suit === 'spades' ? QUEEN_SPADES_END_PENALTY : QUEEN_END_PENALTY;
        p.score = applyScoreBurn(p.score + penalty);
      }
    } else {
      p.score = applyScoreBurn(p.score + handPoints(p.hand));
    }
  }

  state.loserIds = state.players.filter((p) => p.score > SCORE_LIMIT).map((p) => p.id);
  if (state.loserIds.length > 0) {
    state.phase = 'match_over';
  }

  const winner = findPlayer(state, winnerId);
  const qNote =
    lastCard?.rank === 'Q'
      ? lastCard.suit === 'spades'
        ? ' (−40 за даму пик)'
        : ' (−20 за даму)'
      : '';
  state.lastAction = `${winner?.name ?? 'Игрок'} сбросил все карты${qNote}. Раунд окончен.`;
}

/**
 * Apply effects of a resolved (non-9, or finished cover) card and pass the turn.
 * Queen with chosenSuit already set is handled by caller before this for suit-only;
 * here Queen without pending suit choice uses chosenSuit.
 */
function resolveCardEffects(
  s: GameState,
  player: PlayerState,
  card: Card,
  chosenSuit?: Suit,
): GameState {
  if (card.rank === 'Q') {
    const suit = chosenSuit;
    if (!suit) {
      s.phase = 'choosing_suit';
      s.mustChooseSuitPlayerId = player.id;
      s.currentSuit = card.suit;
      s.pending = { type: 'none' };
      s.lastAction = `${player.name} играет даму — выберите масть.`;
      return s;
    }
    s.currentSuit = suit;
    s.pending = { type: 'none' };
    s.lastAction = `${player.name} дама → масть изменена.`;
    s.currentPlayerIndex = nextIndex(s);
    s.drawnThisTurn = false;
    return s;
  }

  s.currentSuit = card.suit;

  if (card.rank === '6') {
    s.pending = { type: 'draw', amount: 2, fromRank: '6' };
    s.lastAction = `${player.name} играет 6 — следующему +2.`;
    s.currentPlayerIndex = nextIndex(s);
    s.drawnThisTurn = false;
    return s;
  }

  if (card.rank === '7') {
    s.pending = { type: 'draw', amount: 1, fromRank: '7' };
    s.lastAction = `${player.name} играет 7 — следующему +1.`;
    s.currentPlayerIndex = nextIndex(s);
    s.drawnThisTurn = false;
    return s;
  }

  if (card.rank === 'A') {
    s.pending = { type: 'skip' };
    s.lastAction = `${player.name} играет туз — следующий пропускает.`;
    s.currentPlayerIndex = nextIndex(s);
    s.drawnThisTurn = false;
    return s;
  }

  s.pending = { type: 'none' };
  s.lastAction = `${player.name} ходит.`;
  advanceTurn(s);
  return s;
}

/**
 * Apply the flipped opening card as if the seat *before* the starter had played it.
 *
 * Seats (clockwise):
 * - `starterIndex` — randomly chosen first actor ("первый ход").
 * - Deal also starts at `starterIndex`; the last seat in deal order is
 *   `(starterIndex - 1 + n) % n` — that player gets only 3 cards; the card that
 *   would have been their 4th is the opener.
 * - "Next" for opener specials = the starter (they face 6/7/A/9/Q), because the
 *   opener is treated as played by the previous seat.
 */
/** @internal exported for smokes — opening flip with full specials onto the starter. */
export function applyOpeningCard(
  state: GameState,
  opener: Card,
  starterIndex: number,
  roundNumber: number,
): void {
  const starter = state.players[starterIndex];
  state.discard = [opener];
  state.currentSuit = opener.suit;
  state.currentPlayerIndex = starterIndex;
  state.drawnThisTurn = false;
  state.mustChooseSuitPlayerId = null;
  state.phase = 'playing';
  state.pending = { type: 'none' };

  const prefix = `Раздача #${roundNumber}. Открыта ${opener.rank}.`;

  if (opener.rank === '9') {
    // Starter must cover the opening 9
    state.pending = { type: 'must_cover', nineSuit: opener.suit };
    state.lastAction = `${prefix} ${starter.name} должен закрыть 9.`;
    return;
  }

  if (opener.rank === 'Q') {
    // Starter chooses the suit; after choose_suit the turn advances to the next seat
    state.phase = 'choosing_suit';
    state.mustChooseSuitPlayerId = starter.id;
    state.lastAction = `${prefix} ${starter.name} выбирает масть (дама).`;
    return;
  }

  if (opener.rank === '6') {
    // Starter is "next": draw 2 or stack another 6
    state.pending = { type: 'draw', amount: 2, fromRank: '6' };
    state.lastAction = `${prefix} ${starter.name}: +2 или положить 6.`;
    return;
  }

  if (opener.rank === '7') {
    state.pending = { type: 'draw', amount: 1, fromRank: '7' };
    state.lastAction = `${prefix} ${starter.name} берёт 1 и пропускает.`;
    return;
  }

  if (opener.rank === 'A') {
    state.pending = { type: 'skip' };
    state.lastAction = `${prefix} ${starter.name} пропускает (туз).`;
    return;
  }

  // Normal ranks: starter plays on the opener as usual
  state.lastAction = `${prefix} Ходит ${starter.name}.`;
}

/**
 * New deal:
 * 1) Pick `starterIndex` uniformly at random.
 * 2) Deal clockwise from starter, 4 rounds — but the last seat in deal order
 *    (`(starter - 1 + n) % n`) does **not** receive a 4th hand card; that card
 *    is flipped as the opening table card with full specials (see applyOpeningCard).
 * 3) Hand sizes: everyone 4 except last-in-deal-order who has 3.
 */
export function createRound(
  players: { id: PlayerId; name: string; isBot: boolean; score: number }[],
  roundNumber: number,
  rng: () => number = Math.random,
): GameState {
  const n = players.length;
  // Pick starter before shuffle so tests can control the first rng() call.
  const starterIndex = Math.floor(rng() * n) % n;
  const deck = shuffle(createDeck(), rng);
  const playerStates: PlayerState[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    hand: [],
    score: p.score,
    isBot: p.isBot,
    connected: true,
  }));

  let dealIndex = starterIndex;

  // Rounds 1–3: one card each, clockwise from starter
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < n; i++) {
      playerStates[dealIndex].hand.push(deck.pop()!);
      dealIndex = (dealIndex + 1) % n;
    }
  }

  // Round 4: n - 1 cards into hands; the would-be last card is the opener
  for (let i = 0; i < n - 1; i++) {
    playerStates[dealIndex].hand.push(deck.pop()!);
    dealIndex = (dealIndex + 1) % n;
  }
  // dealIndex now === (starterIndex - 1 + n) % n  — last in deal order (3 cards)
  const opener = deck.pop()!;

  const state: GameState = {
    players: playerStates,
    deck,
    discard: [],
    currentSuit: null,
    currentPlayerIndex: starterIndex,
    direction: 1,
    pending: { type: 'none' },
    phase: 'playing',
    mustChooseSuitPlayerId: null,
    starterIndex,
    roundNumber,
    winnerId: null,
    loserIds: [],
    lastAction: null,
    drawnThisTurn: false,
  };

  applyOpeningCard(state, opener, starterIndex, roundNumber);
  return state;
}

export function startMatch(
  names: { id: PlayerId; name: string; isBot: boolean }[],
  rng?: () => number,
): GameState {
  return createRound(
    names.map((n) => ({ ...n, score: 0 })),
    1,
    rng,
  );
}

export function nextRound(state: GameState, rng?: () => number): GameState {
  if (state.phase !== 'round_over') return state;
  return createRound(
    state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      score: p.score,
    })),
    state.roundNumber + 1,
    rng,
  );
}

function applyPlay(state: GameState, playerId: PlayerId, cardId: string, chosenSuit?: Suit): GameState {
  const s = cloneState(state);
  if (s.phase !== 'playing') throw new Error('Не время ходить');
  const player = currentPlayer(s);
  if (player.id !== playerId) throw new Error('Сейчас не ваш ход');

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex < 0) throw new Error('Карты нет в руке');
  const card = player.hand[cardIndex];

  if (!canPlayCard(s, card)) throw new Error('Эту карту нельзя сыграть');

  // Stacking 6s
  if (s.pending.type === 'draw' && s.pending.fromRank === '6') {
    if (card.rank !== '6') throw new Error('Нужно сыграть шестёрку или взять карты');
    player.hand.splice(cardIndex, 1);
    s.discard.push(card);
    s.currentSuit = card.suit;
    const newAmount = Math.min(MAX_SIX_STACK, s.pending.amount + 2);
    s.pending = { type: 'draw', amount: newAmount, fromRank: '6' };
    s.lastAction = `${player.name} кладёт 6 (штраф ${newAmount}).`;
    s.drawnThisTurn = false;
    s.currentPlayerIndex = nextIndex(s);
    if (player.hand.length === 0) {
      finishRound(s, player.id, card);
    }
    return s;
  }

  // Covering a 9
  if (s.pending.type === 'must_cover') {
    if (!isLegalNineCover(card, s.pending.nineSuit)) {
      throw new Error('Нужно закрыть девятку: 9, масть девятки или дама');
    }
    player.hand.splice(cardIndex, 1);
    s.discard.push(card);
    s.drawnThisTurn = false;

    if (player.hand.length === 0) {
      finishRound(s, player.id, card);
      return s;
    }

    // Another 9 → keep covering
    if (card.rank === '9') {
      s.pending = { type: 'must_cover', nineSuit: card.suit };
      s.currentSuit = card.suit;
      s.lastAction = `${player.name} кроет девяткой — нужно закрыть снова.`;
      return s;
    }

    // Non-9 cover (suit match or Queen): specials of the cover apply
    s.lastAction = `${player.name} закрыл девятку.`;
    return resolveCardEffects(s, player, card, chosenSuit);
  }

  // Normal play (including opening a 9)
  player.hand.splice(cardIndex, 1);
  s.discard.push(card);

  if (player.hand.length === 0) {
    finishRound(s, player.id, card);
    return s;
  }

  // Nine: same player must cover (9 / suit of this 9 / Queen)
  if (card.rank === '9') {
    s.pending = { type: 'must_cover', nineSuit: card.suit };
    s.currentSuit = card.suit;
    s.drawnThisTurn = false;
    s.lastAction = `${player.name} играет 9 — закройте её (9 / масть / дама).`;
    return s;
  }

  return resolveCardEffects(s, player, card, chosenSuit);
}

function applyChooseSuit(state: GameState, action: ChooseSuitAction): GameState {
  const s = cloneState(state);
  if (s.phase !== 'choosing_suit') throw new Error('Сейчас нельзя выбрать масть');
  if (s.mustChooseSuitPlayerId !== action.playerId) throw new Error('Не ваш выбор масти');
  s.currentSuit = action.suit;
  s.phase = 'playing';
  s.mustChooseSuitPlayerId = null;
  s.pending = { type: 'none' };
  s.lastAction = `Выбрана новая масть.`;
  s.currentPlayerIndex = nextIndex(s);
  s.drawnThisTurn = false;
  return s;
}

function applyDraw(state: GameState, playerId: PlayerId): GameState {
  const s = cloneState(state);
  if (s.phase !== 'playing') throw new Error('Не время брать');
  const player = currentPlayer(s);
  if (player.id !== playerId) throw new Error('Сейчас не ваш ход');

  // Pending draw from 6 or 7 — take penalty, then turn ends
  if (s.pending.type === 'draw') {
    const amount = s.pending.amount;
    const { cards, reshuffled } = drawFromDeck(s, amount);
    player.hand.push(...cards);
    const reshuffleNote = reshuffled ? ' Колода перемешана из сброса.' : '';
    s.lastAction = `${player.name} берёт ${amount}.${reshuffleNote}`;
    advanceTurn(s);
    return s;
  }

  // Forced Ace skip — cannot draw
  if (s.pending.type === 'skip') {
    throw new Error('Нужно пропустить ход');
  }

  if (s.drawnThisTurn) throw new Error('Уже брали карту в этот ход');

  // Single draw (forced when no play, or voluntary). Never auto-pass:
  // if the hand now has a legal play/cover, player (or bot) must be able to attempt it;
  // only then may they Пас if still nothing legal.
  const { cards, reshuffled } = drawFromDeck(s, 1);
  player.hand.push(...cards);
  s.drawnThisTurn = true;
  const reshuffleNote = reshuffled ? ' Колода перемешана из сброса.' : '';
  const canNow = legalPlays(s, playerId).length > 0;
  if (canNow) {
    s.lastAction = `${player.name} берёт 1 карту — можно сходить.${reshuffleNote}`;
  } else if (s.pending.type === 'must_cover') {
    s.lastAction = `${player.name} берёт 1 — закрыть 9 всё ещё нельзя (Пас).${reshuffleNote}`;
  } else {
    s.lastAction = `${player.name} берёт 1 — хода нет (Пас).${reshuffleNote}`;
  }
  return s;
}

function applySkip(state: GameState, playerId: PlayerId): GameState {
  const s = cloneState(state);
  if (s.phase !== 'playing') throw new Error('Не время пропускать');
  const player = currentPlayer(s);
  if (player.id !== playerId) throw new Error('Сейчас не ваш ход');

  if (s.pending.type === 'skip') {
    s.lastAction = `${player.name} пропускает ход (туз).`;
    advanceTurn(s);
    return s;
  }

  // Pending penalty draw must be taken, not skipped
  if (s.pending.type === 'draw') {
    throw new Error('Нужно взять штрафные карты');
  }

  // After voluntary (or forced) draw — may pass even if legal moves remain
  if (s.drawnThisTurn) {
    s.lastAction =
      s.pending.type === 'must_cover'
        ? `${player.name} пасует, не закрыв 9.`
        : `${player.name} пасует.`;
    advanceTurn(s);
    return s;
  }

  throw new Error('Сначала возьмите карту или сходите');
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'play':
      return applyPlay(state, action.playerId, action.cardId, action.chosenSuit);
    case 'draw':
      return applyDraw(state, action.playerId);
    case 'skip':
      return applySkip(state, action.playerId);
    case 'choose_suit':
      return applyChooseSuit(state, action);
    default:
      throw new Error('Неизвестное действие');
  }
}

/** Public helpers for UI */
export function topDiscard(state: GameState): Card | null {
  return state.discard[state.discard.length - 1] ?? null;
}

export function isPlayersTurn(state: GameState, playerId: PlayerId): boolean {
  if (state.phase === 'choosing_suit') return state.mustChooseSuitPlayerId === playerId;
  if (state.phase !== 'playing') return false;
  return currentPlayer(state).id === playerId;
}
