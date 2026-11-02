import type { Card } from '../game';
import { SUIT_SYMBOL } from '../game';
import './CardView.css';

interface Props {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
  small?: boolean;
}

export function CardView({
  card,
  selected,
  disabled,
  faceDown,
  onClick,
  small,
}: Props) {
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  if (faceDown) {
    return (
      <button
        type="button"
        className={`card card-back ${small ? 'card-small' : ''}`}
        disabled
        aria-label="рубашка"
      />
    );
  }
  return (
    <button
      type="button"
      className={`card ${red ? 'card-red' : 'card-black'} ${selected ? 'card-selected' : ''} ${small ? 'card-small' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${card.rank} ${SUIT_SYMBOL[card.suit]}`}
    >
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}
