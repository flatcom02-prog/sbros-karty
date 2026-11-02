import type { Card, Rank, Suit } from './types';
import { RANKS, SUITS } from './types';

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${rank}-${suit}`, suit, rank });
    }
  }
  return cards;
}

/** Fisher–Yates shuffle (pure: returns new array). */
export function shuffle(cards: Card[], rng: () => number = Math.random): Card[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cardPoints(card: Card): number {
  const map: Record<Rank, number> = {
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
  return map[card.rank];
}

export function handPoints(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0);
}

export function formatCard(card: Card): string {
  const symbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  return `${card.rank}${symbols[card.suit]}`;
}
