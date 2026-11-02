/** Shared types for «Сбрось карты» (36-card Russian shed). */

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type PlayerId = string;

export interface PlayerState {
  id: PlayerId;
  name: string;
  hand: Card[];
  score: number;
  isBot: boolean;
  connected: boolean;
}

export type PendingEffect =
  | { type: 'none' }
  | { type: 'draw'; amount: number; fromRank: '6' | '7' } // stacked draw from 6s, or single 7
  | { type: 'skip' } // from Ace
  | { type: 'must_cover'; nineSuit: Suit }; // after playing 9: same player must cover

export interface GameState {
  players: PlayerState[];
  deck: Card[];
  discard: Card[];
  currentSuit: Suit | null; // active suit (may differ after Queen)
  currentPlayerIndex: number;
  direction: 1; // always clockwise for this ruleset
  pending: PendingEffect;
  phase: 'waiting' | 'playing' | 'choosing_suit' | 'round_over' | 'match_over';
  mustChooseSuitPlayerId: PlayerId | null;
  starterIndex: number;
  roundNumber: number;
  winnerId: PlayerId | null; // round winner (emptied hand)
  loserIds: PlayerId[]; // match losers (exceeded 125)
  lastAction: string | null;
  drawnThisTurn: boolean; // player already drew once this turn
}

export interface PlayCardAction {
  type: 'play';
  playerId: PlayerId;
  cardId: string;
  chosenSuit?: Suit; // required when playing Queen
}

export interface DrawAction {
  type: 'draw';
  playerId: PlayerId;
}

export interface SkipAction {
  type: 'skip';
  playerId: PlayerId;
}

export interface ChooseSuitAction {
  type: 'choose_suit';
  playerId: PlayerId;
  suit: Suit;
}

export type GameAction = PlayCardAction | DrawAction | SkipAction | ChooseSuitAction;

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_NAME_RU: Record<Suit, string> = {
  hearts: 'черви',
  diamonds: 'бубны',
  clubs: 'трефы',
  spades: 'пики',
};

export const RANK_POINTS: Record<Rank, number> = {
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 2,
  Q: 3,
  K: 4,
  A: 11,
};

export const SCORE_LIMIT = 125;
export const QUEEN_END_PENALTY = -20;
export const QUEEN_SPADES_END_PENALTY = -40;
export const MAX_SIX_STACK = 8; // max draw from stacked 6s

/** Delay between bot actions so humans can follow (ms). */
export const BOT_ACTION_DELAY_MS_MIN = 800;
export const BOT_ACTION_DELAY_MS_MAX = 1500;
