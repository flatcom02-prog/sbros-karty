import { useState } from 'react';
import './ModeSelect.css';

export type StartBots = { mode: 'bots'; botCount: number; playerName: string };
export type StartOnline =
  | { mode: 'online'; action: 'create'; playerName: string; maxPlayers: number }
  | { mode: 'online'; action: 'join'; playerName: string; code: string };

interface Props {
  onStartBots: (opts: StartBots) => void;
  onStartOnline: (opts: StartOnline) => void;
  onlineError?: string | null;
}

export function ModeSelect({ onStartBots, onStartOnline, onlineError }: Props) {
  const [tab, setTab] = useState<'bots' | 'online'>('bots');
  const [name, setName] = useState('Игрок');
  const [botCount, setBotCount] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [code, setCode] = useState('');

  return (
    <div className="mode">
      <div className="mode-hero">
        <h1>Сбрось карты</h1>
        <p>Русская колода 36 · цель — сбросить все</p>
      </div>

      <label className="field">
        Имя
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value || 'Игрок')}
          autoComplete="nickname"
        />
      </label>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === 'bots' ? 'tab active' : 'tab'}
          aria-selected={tab === 'bots'}
          onClick={() => setTab('bots')}
        >
          Боты
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'online' ? 'tab active' : 'tab'}
          aria-selected={tab === 'online'}
          onClick={() => setTab('online')}
        >
          Онлайн
        </button>
      </div>

      {tab === 'bots' && (
        <div className="panel">
          <label className="field">
            Ботов: {botCount}
            <input
              type="range"
              min={1}
              max={3}
              value={botCount}
              onChange={(e) => setBotCount(Number(e.target.value))}
            />
          </label>
          <p className="hint">Игроков за столом: {botCount + 1} (вы + боты)</p>
          <button
            type="button"
            className="btn primary wide"
            onClick={() =>
              onStartBots({ mode: 'bots', botCount, playerName: name.trim() || 'Игрок' })
            }
          >
            Играть
          </button>
        </div>
      )}

      {tab === 'online' && (
        <div className="panel">
          <label className="field">
            Макс. игроков (создать): {maxPlayers}
            <input
              type="range"
              min={2}
              max={4}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="btn primary wide"
            onClick={() =>
              onStartOnline({
                mode: 'online',
                action: 'create',
                playerName: name.trim() || 'Игрок',
                maxPlayers,
              })
            }
          >
            Создать комнату
          </button>
          <div className="or">или</div>
          <label className="field">
            Код комнаты
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              maxLength={4}
              autoCapitalize="characters"
            />
          </label>
          <button
            type="button"
            className="btn wide"
            disabled={code.trim().length < 4}
            onClick={() =>
              onStartOnline({
                mode: 'online',
                action: 'join',
                playerName: name.trim() || 'Игрок',
                code: code.trim(),
              })
            }
          >
            Войти
          </button>
          {onlineError && <p className="error">{onlineError}</p>}
          <p className="hint">Нужен запущенный сервер: npm run server</p>
        </div>
      )}

      <details className="rules-brief">
        <summary>Кратко правила</summary>
        <ul>
          <li>Стартер случайный; раздача по 4, у последнего в круге 3 — 4-я карта открывается на стол со спецэффектом</li>
          <li>Ход: та же масть или достоинство; дама — на любую + смена масти</li>
          <li>9: сразу закройте её (ещё 9 / масть этой 9 / дама); цепочка 9; иначе взять → пас</li>
          <li>6: следующему +2 (стек до 8); 7: +1; туз: пропуск</li>
          <li>«Взять карту» / «Пас»: после взятия можно сходить, если карта подходит; иначе Пас</li>
          <li>Пустая колода: сброс (кроме верхней) перемешивается в новую колоду</li>
          <li>Очки за остаток; &gt;125 — проигрыш; ровно 125 → 0; сброс на даме −20 (−40 ♠)</li>
        </ul>
      </details>
    </div>
  );
}
