import type { Card, GameState, PlayerId, Suit } from '../game';
import {
  SUIT_NAME_RU,
  SUIT_SYMBOL,
  isPlayersTurn,
  legalPlays,
  topDiscard,
} from '../game';
import { CardView } from './CardView';
import { SuitPicker } from './SuitPicker';
import './GameTable.css';

interface Props {
  state: GameState;
  myId: PlayerId;
  onPlay: (cardId: string, chosenSuit?: Suit) => void;
  onDraw: () => void;
  onSkip: () => void;
  onChooseSuit: (suit: Suit) => void;
  onNextRound?: () => void;
  onExit: () => void;
}

export function GameTable({
  state,
  myId,
  onPlay,
  onDraw,
  onSkip,
  onChooseSuit,
  onNextRound,
  onExit,
}: Props) {
  const me = state.players.find((p) => p.id === myId);
  const top = topDiscard(state);
  const myTurn = isPlayersTurn(state, myId);
  const plays = myTurn && state.phase === 'playing' ? legalPlays(state, myId) : [];
  const playIds = new Set(plays.map((c) => c.id));

  const pendingLabel = (() => {
    if (state.pending.type === 'draw') {
      return `Штраф: взять ${state.pending.amount}`;
    }
    if (state.pending.type === 'skip') return 'Пропуск хода';
    if (state.pending.type === 'must_cover') {
      return `Закройте 9 (${SUIT_SYMBOL[state.pending.nineSuit]})`;
    }
    return null;
  })();

  const underPenaltyDraw = state.pending.type === 'draw';
  const underAceSkip = state.pending.type === 'skip';

  // «Взять карту» — always on your turn except Ace-skip; penalty draw uses same button
  const showDraw =
    myTurn &&
    state.phase === 'playing' &&
    !underAceSkip &&
    (underPenaltyDraw || !state.drawnThisTurn);

  // «Пас» — after draw (even with legal moves), or forced Ace skip
  const showPass =
    myTurn &&
    state.phase === 'playing' &&
    (underAceSkip || state.drawnThisTurn);

  function handleCardClick(card: Card) {
    if (!myTurn || state.phase !== 'playing') return;
    if (!playIds.has(card.id)) return;
    onPlay(card.id);
  }

  return (
    <div className="table">
      <header className="table-bar">
        <button type="button" className="btn ghost" onClick={onExit}>
          ← Меню
        </button>
        <div className="table-meta">
          Раунд {state.roundNumber}
          {state.currentSuit && (
            <>
              {' · '}
              Масть:{' '}
              <span
                className={
                  state.currentSuit === 'hearts' || state.currentSuit === 'diamonds'
                    ? 'text-red'
                    : ''
                }
              >
                {SUIT_SYMBOL[state.currentSuit]} {SUIT_NAME_RU[state.currentSuit]}
              </span>
            </>
          )}
        </div>
      </header>

      <div className="opponents">
        {state.players
          .filter((p) => p.id !== myId)
          .map((p) => {
            const isCurrent = state.players[state.currentPlayerIndex]?.id === p.id;
            return (
              <div
                key={p.id}
                className={`opponent ${isCurrent ? 'opponent-active' : ''}`}
              >
                <div className="opponent-name">
                  {p.name}
                  {p.isBot ? ' 🤖' : ''}
                </div>
                <div className="opponent-cards">
                  {p.hand.map((c) => (
                    <CardView key={c.id} card={c} faceDown small />
                  ))}
                </div>
                <div className="opponent-score">очки: {p.score}</div>
              </div>
            );
          })}
      </div>

      <div className="center-pile">
        {top && <CardView card={top} disabled />}
        <div className="deck-count">колода: {state.deck.length}</div>
        {pendingLabel && <div className="pending-badge">{pendingLabel}</div>}
      </div>

      {state.lastAction && <p className="action-log">{state.lastAction}</p>}

      <div className="hand-area">
        <div className="hand-header">
          <span>
            {me?.name ?? 'Вы'} · очки: {me?.score ?? 0}
            {myTurn ? ' · ваш ход' : ''}
          </span>
        </div>
        <div className="hand">
          {(me?.hand ?? []).map((card) => (
            <CardView
              key={card.id}
              card={card}
              disabled={!myTurn || !playIds.has(card.id)}
              selected={false}
              onClick={() => handleCardClick(card)}
            />
          ))}
        </div>
        <div className="hand-actions">
          {showDraw && (
            <button type="button" className="btn primary" onClick={onDraw}>
              {underPenaltyDraw
                ? `Взять ${state.pending.type === 'draw' ? state.pending.amount : 1}`
                : 'Взять карту'}
            </button>
          )}
          {showPass && (
            <button type="button" className="btn" onClick={onSkip}>
              {plays.length > 0 ? 'Пас' : 'Пас (хода нет)'}
            </button>
          )}
          {myTurn && state.drawnThisTurn && plays.length > 0 && (
            <span className="hint-inline">Можно сходить взятой картой</span>
          )}
        </div>
      </div>

      {state.phase === 'choosing_suit' && state.mustChooseSuitPlayerId === myId && (
        <SuitPicker onChoose={onChooseSuit} />
      )}

      {(state.phase === 'round_over' || state.phase === 'match_over') && (
        <div className="overlay">
          <div className="overlay-card">
            <h2>
              {state.phase === 'match_over' ? 'Матч окончен' : 'Раунд окончен'}
            </h2>
            <ul className="score-list">
              {state.players.map((p) => (
                <li key={p.id}>
                  {p.name}: <strong>{p.score}</strong>
                  {state.winnerId === p.id ? ' ★' : ''}
                  {state.loserIds.includes(p.id) ? ' (проигрыш >125)' : ''}
                </li>
              ))}
            </ul>
            {state.phase === 'round_over' && onNextRound && (
              <button type="button" className="btn primary" onClick={onNextRound}>
                Следующий раунд
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onExit}>
              В меню
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
