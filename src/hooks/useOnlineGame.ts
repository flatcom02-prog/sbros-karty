import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, GameState, Suit } from '../game';

export interface RoomInfo {
  code: string;
  hostId: string;
  players: { id: string; name: string; ready: boolean }[];
  maxPlayers: number;
  started: boolean;
  state: GameState | null;
}

function defaultWsUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Dev: Vite on 5173, WS on 3080. Prod: same origin (static + WS on one port).
  if (import.meta.env.DEV) {
    return `${proto}//${window.location.hostname}:3080`;
  }
  return `${proto}//${window.location.host}`;
}

export function useOnlineGame() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Record<string, unknown>[] | null>(null);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      pendingRef.current = [...(pendingRef.current ?? []), msg];
    }
  }, []);

  const ensureSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return wsRef.current;
    }
    const ws = new WebSocket(defaultWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      setError(null);
      const pending = pendingRef.current ?? [];
      pendingRef.current = null;
      for (const msg of pending) ws.send(JSON.stringify(msg));
    };
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => {
      setError('Нет связи с сервером (npm run server)');
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data));
        if (data.type === 'welcome') {
          setPlayerId(data.playerId);
        } else if (data.type === 'room') {
          setRoom(data.room);
          setError(null);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch {
        /* ignore */
      }
    };
    return ws;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const createRoom = useCallback(
    (playerName: string, maxPlayers: number) => {
      setError(null);
      ensureSocket();
      send({ type: 'set_name', name: playerName });
      send({ type: 'create_room', maxPlayers });
    },
    [ensureSocket, send],
  );

  const joinRoom = useCallback(
    (playerName: string, code: string) => {
      setError(null);
      ensureSocket();
      send({ type: 'set_name', name: playerName });
      send({ type: 'join_room', code });
    },
    [ensureSocket, send],
  );

  const setReady = useCallback(
    (ready: boolean) => send({ type: 'ready', ready }),
    [send],
  );

  const startGame = useCallback(() => send({ type: 'start' }), [send]);

  const sendAction = useCallback(
    (action: GameAction) => send({ type: 'action', action }),
    [send],
  );

  const play = useCallback(
    (cardId: string, chosenSuit?: Suit) => {
      if (!playerId) return;
      sendAction({ type: 'play', playerId, cardId, chosenSuit });
    },
    [playerId, sendAction],
  );

  const draw = useCallback(() => {
    if (!playerId) return;
    sendAction({ type: 'draw', playerId });
  }, [playerId, sendAction]);

  const skip = useCallback(() => {
    if (!playerId) return;
    sendAction({ type: 'skip', playerId });
  }, [playerId, sendAction]);

  const chooseSuit = useCallback(
    (suit: Suit) => {
      if (!playerId) return;
      sendAction({ type: 'choose_suit', playerId, suit });
    },
    [playerId, sendAction],
  );

  const goNextRound = useCallback(() => send({ type: 'next_round' }), [send]);

  const exit = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setRoom(null);
    setPlayerId(null);
    setConnected(false);
    setError(null);
  }, []);

  return {
    playerId,
    room,
    error,
    connected,
    createRoom,
    joinRoom,
    setReady,
    startGame,
    play,
    draw,
    skip,
    chooseSuit,
    goNextRound,
    exit,
    setError,
  };
}
