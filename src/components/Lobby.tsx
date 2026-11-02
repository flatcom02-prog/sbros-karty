import type { RoomInfo } from '../hooks/useOnlineGame';
import './Lobby.css';

interface Props {
  room: RoomInfo;
  myId: string;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onExit: () => void;
}

export function Lobby({ room, myId, onReady, onStart, onExit }: Props) {
  const me = room.players.find((p) => p.id === myId);
  const isHost = room.hostId === myId;

  return (
    <div className="lobby">
      <button type="button" className="btn ghost" onClick={onExit}>
        ← Выйти
      </button>
      <h1>Комната</h1>
      <div className="room-code" aria-label="Код комнаты">
        {room.code}
      </div>
      <p className="lobby-hint">Сообщите код друзьям · {room.players.length}/{room.maxPlayers}</p>

      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id}>
            <span>
              {p.name}
              {p.id === room.hostId ? ' (хост)' : ''}
              {p.id === myId ? ' — вы' : ''}
            </span>
            <span className={p.ready ? 'ready' : 'wait'}>
              {p.ready ? 'готов' : 'ждёт'}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn wide"
        onClick={() => onReady(!me?.ready)}
      >
        {me?.ready ? 'Не готов' : 'Готов'}
      </button>

      {isHost && (
        <button
          type="button"
          className="btn primary wide"
          disabled={room.players.length < 2}
          onClick={onStart}
        >
          Начать игру
        </button>
      )}
    </div>
  );
}
