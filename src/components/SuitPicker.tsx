import type { Suit } from '../game';
import { SUIT_NAME_RU, SUIT_SYMBOL, SUITS } from '../game';
import './SuitPicker.css';

interface Props {
  onChoose: (suit: Suit) => void;
}

export function SuitPicker({ onChoose }: Props) {
  return (
    <div className="suit-picker" role="dialog" aria-label="Выбор масти">
      <p>Выберите масть</p>
      <div className="suit-picker-row">
        {SUITS.map((suit) => {
          const red = suit === 'hearts' || suit === 'diamonds';
          return (
            <button
              key={suit}
              type="button"
              className={`suit-btn ${red ? 'suit-red' : 'suit-black'}`}
              onClick={() => onChoose(suit)}
            >
              <span className="suit-sym">{SUIT_SYMBOL[suit]}</span>
              <span>{SUIT_NAME_RU[suit]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
