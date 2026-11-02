import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOT_ACTION_DELAY_MS_MAX,
  BOT_ACTION_DELAY_MS_MIN,
  applyAction,
  chooseBotAction,
  nextRound,
  startMatch,
  type GameAction,
  type GameState,
  type Suit,
} from '../game';

const BOT_NAMES = ['Вася', 'Маша', 'Коля'];

function botDelayMs(): number {
  const span = BOT_ACTION_DELAY_MS_MAX - BOT_ACTION_DELAY_MS_MIN;
  return BOT_ACTION_DELAY_MS_MIN + Math.floor(Math.random() * (span + 1));
}

export function useBotGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [myId] = useState('human');
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const start = useCallback(
    (playerName: string, botCount: number) => {
      clearTimer();
      const players = [
        { id: myId, name: playerName || 'Игрок', isBot: false },
        ...Array.from({ length: botCount }, (_, i) => ({
          id: `bot_${i}`,
          name: BOT_NAMES[i] ?? `Бот ${i + 1}`,
          isBot: true,
        })),
      ];
      setState(startMatch(players));
    },
    [myId],
  );

  const dispatch = useCallback((action: GameAction) => {
    setState((prev) => {
      if (!prev) return prev;
      try {
        return applyAction(prev, action);
      } catch (e) {
        console.warn(e);
        return prev;
      }
    });
  }, []);

  const play = useCallback(
    (cardId: string, chosenSuit?: Suit) => {
      dispatch({ type: 'play', playerId: myId, cardId, chosenSuit });
    },
    [dispatch, myId],
  );

  const draw = useCallback(() => {
    dispatch({ type: 'draw', playerId: myId });
  }, [dispatch, myId]);

  const skip = useCallback(() => {
    dispatch({ type: 'skip', playerId: myId });
  }, [dispatch, myId]);

  const chooseSuit = useCallback(
    (suit: Suit) => {
      dispatch({ type: 'choose_suit', playerId: myId, suit });
    },
    [dispatch, myId],
  );

  const goNextRound = useCallback(() => {
    setState((prev) => (prev ? nextRound(prev) : prev));
  }, []);

  const exit = useCallback(() => {
    clearTimer();
    setState(null);
  }, []);

  // Bot turns — delay so humans can follow (incl. draw-then-play)
  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'playing' && state.phase !== 'choosing_suit') return;

    const current =
      state.phase === 'choosing_suit'
        ? state.players.find((p) => p.id === state.mustChooseSuitPlayerId)
        : state.players[state.currentPlayerIndex];

    if (!current?.isBot) return;

    clearTimer();
    timer.current = window.setTimeout(() => {
      const action = chooseBotAction(state, current.id);
      if (action) {
        setState((prev) => {
          if (!prev) return prev;
          try {
            return applyAction(prev, action);
          } catch (e) {
            console.warn('bot error', e);
            return prev;
          }
        });
      }
    }, botDelayMs());

    return clearTimer;
  }, [state]);

  return {
    state,
    myId,
    start,
    play,
    draw,
    skip,
    chooseSuit,
    goNextRound,
    exit,
  };
}
