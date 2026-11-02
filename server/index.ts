/**
 * Production-ready WebSocket lobby + static client for «Сбрось карты».
 * Dev:  npm run server          → WS only on :3080
 * Prod: npm run start:prod      → static dist/ + WS on one PORT
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  applyAction,
  nextRound,
  startMatch,
  type GameAction,
  type GameState,
} from '../src/game/index.ts';

const PORT = Number(process.env.PORT ?? 3080);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SERVE_STATIC = process.env.SERVE_STATIC !== '0' && existsSync(join(DIST, 'index.html'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

interface Client {
  ws: WebSocket;
  playerId: string;
  name: string;
  roomCode: string | null;
}

interface Room {
  code: string;
  hostId: string;
  players: { id: string; name: string; ready: boolean }[];
  maxPlayers: number;
  state: GameState | null;
  started: boolean;
}

const clients = new Map<WebSocket, Client>();
const rooms = new Map<string, Room>();

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastRoom(room: Room, msg: unknown, except?: WebSocket) {
  for (const [, c] of clients) {
    if (c.roomCode === room.code && c.ws !== except) {
      send(c.ws, msg);
    }
  }
}

function roomPublic(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players,
    maxPlayers: room.maxPlayers,
    started: room.started,
    state: room.state,
  };
}

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  if (rooms.has(code)) return makeCode();
  return code;
}

function syncRoom(room: Room) {
  broadcastRoom(room, { type: 'room', room: roomPublic(room) });
}

function safeDistPath(urlPath: string): string | null {
  const cleaned = decodeURIComponent(urlPath.split('?')[0] || '/');
  const rel = cleaned === '/' ? 'index.html' : cleaned.replace(/^\//, '');
  const full = normalize(join(DIST, rel));
  if (!full.startsWith(DIST + sep) && full !== DIST) return null;
  return full;
}

function sendFile(res: ServerResponse, filePath: string) {
  const type = MIME[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  createReadStream(filePath).pipe(res);
}

function handleHttp(req: IncomingMessage, res: ServerResponse) {
  if (!SERVE_STATIC) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Сбрось карты — WebSocket сервер\n');
    return;
  }

  const url = req.url ?? '/';
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok\n');
    return;
  }

  let filePath = safeDistPath(url);
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    // SPA fallback
    filePath = join(DIST, 'index.html');
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  sendFile(res, filePath);
}

const httpServer = createServer(handleHttp);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
  const client: Client = {
    ws,
    playerId,
    name: `Игрок`,
    roomCode: null,
  };
  clients.set(ws, client);
  send(ws, { type: 'welcome', playerId });

  ws.on('message', (raw) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'error', message: 'Неверный JSON' });
      return;
    }

    try {
      handleMessage(client, data);
    } catch (e) {
      send(ws, {
        type: 'error',
        message: e instanceof Error ? e.message : 'Ошибка',
      });
    }
  });

  ws.on('close', () => {
    leaveRoom(client);
    clients.delete(ws);
  });
});

function leaveRoom(client: Client) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== client.playerId);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === client.playerId) {
    room.hostId = room.players[0].id;
  }
  if (room.state) {
    const p = room.state.players.find((x) => x.id === client.playerId);
    if (p) p.connected = false;
  }
  syncRoom(room);
}

function handleMessage(client: Client, data: Record<string, unknown>) {
  const type = data.type as string;

  if (type === 'set_name') {
    client.name = String(data.name || 'Игрок').slice(0, 20);
    send(client.ws, { type: 'named', name: client.name, playerId: client.playerId });
    return;
  }

  if (type === 'create_room') {
    leaveRoom(client);
    const maxPlayers = Math.min(4, Math.max(2, Number(data.maxPlayers) || 4));
    const code = makeCode();
    const room: Room = {
      code,
      hostId: client.playerId,
      players: [{ id: client.playerId, name: client.name, ready: false }],
      maxPlayers,
      state: null,
      started: false,
    };
    rooms.set(code, room);
    client.roomCode = code;
    syncRoom(room);
    return;
  }

  if (type === 'join_room') {
    const code = String(data.code || '')
      .toUpperCase()
      .trim();
    const room = rooms.get(code);
    if (!room) throw new Error('Комната не найдена');
    if (room.started) throw new Error('Игра уже началась');
    if (room.players.length >= room.maxPlayers) throw new Error('Комната полна');
    if (room.players.some((p) => p.id === client.playerId)) {
      client.roomCode = code;
      syncRoom(room);
      return;
    }
    leaveRoom(client);
    room.players.push({ id: client.playerId, name: client.name, ready: false });
    client.roomCode = code;
    syncRoom(room);
    return;
  }

  if (type === 'ready') {
    const room = rooms.get(client.roomCode ?? '');
    if (!room) throw new Error('Нет комнаты');
    const p = room.players.find((x) => x.id === client.playerId);
    if (p) p.ready = Boolean(data.ready);
    syncRoom(room);
    return;
  }

  if (type === 'start') {
    const room = rooms.get(client.roomCode ?? '');
    if (!room) throw new Error('Нет комнаты');
    if (room.hostId !== client.playerId) throw new Error('Только хост может начать');
    if (room.players.length < 2) throw new Error('Нужно минимум 2 игрока');
    room.state = startMatch(
      room.players.map((p) => ({ id: p.id, name: p.name, isBot: false })),
    );
    room.started = true;
    syncRoom(room);
    return;
  }

  if (type === 'action') {
    const room = rooms.get(client.roomCode ?? '');
    if (!room?.state) throw new Error('Игра не идёт');
    const action = data.action as GameAction;
    if (action.playerId !== client.playerId) throw new Error('Чужой ход');
    room.state = applyAction(room.state, action);
    syncRoom(room);
    return;
  }

  if (type === 'next_round') {
    const room = rooms.get(client.roomCode ?? '');
    if (!room?.state) throw new Error('Нет игры');
    if (room.hostId !== client.playerId) throw new Error('Только хост');
    if (room.state.phase !== 'round_over') throw new Error('Раунд ещё не окончен');
    room.state = nextRound(room.state);
    syncRoom(room);
    return;
  }

  throw new Error(`Неизвестная команда: ${type}`);
}

httpServer.listen(PORT, () => {
  const mode = SERVE_STATIC ? 'static+WS' : 'WS-only';
  console.log(`Сбрось карты (${mode}) http://localhost:${PORT}  ws://localhost:${PORT}`);
});
