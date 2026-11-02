import { useState } from 'react';
import { GameTable } from './components/GameTable';
import { Lobby } from './components/Lobby';
import {
  ModeSelect,
  type StartBots,
  type StartOnline,
} from './components/ModeSelect';
import { useBotGame } from './hooks/useBotGame';
import { useOnlineGame } from './hooks/useOnlineGame';
import './App.css';

type Screen = 'menu' | 'bots' | 'online';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const bots = useBotGame();
  const online = useOnlineGame();

  function handleBots(opts: StartBots) {
    bots.start(opts.playerName, opts.botCount);
    setScreen('bots');
  }

  function handleOnline(opts: StartOnline) {
    if (opts.action === 'create') {
      online.createRoom(opts.playerName, opts.maxPlayers);
    } else {
      online.joinRoom(opts.playerName, opts.code);
    }
    setScreen('online');
  }

  function exitToMenu() {
    if (screen === 'bots') bots.exit();
    if (screen === 'online') online.exit();
    setScreen('menu');
  }

  if (screen === 'bots' && bots.state) {
    return (
      <GameTable
        state={bots.state}
        myId={bots.myId}
        onPlay={bots.play}
        onDraw={bots.draw}
        onSkip={bots.skip}
        onChooseSuit={bots.chooseSuit}
        onNextRound={bots.goNextRound}
        onExit={exitToMenu}
      />
    );
  }

  if (screen === 'online') {
    const room = online.room;
    if (room?.started && room.state && online.playerId) {
      return (
        <GameTable
          state={room.state}
          myId={online.playerId}
          onPlay={online.play}
          onDraw={online.draw}
          onSkip={online.skip}
          onChooseSuit={online.chooseSuit}
          onNextRound={
            online.playerId === room.hostId ? online.goNextRound : undefined
          }
          onExit={exitToMenu}
        />
      );
    }
    if (room && online.playerId) {
      return (
        <Lobby
          room={room}
          myId={online.playerId}
          onReady={online.setReady}
          onStart={online.startGame}
          onExit={exitToMenu}
        />
      );
    }
    return (
      <div className="connecting">
        <p>{online.error ?? 'Подключение…'}</p>
        <button type="button" className="btn" onClick={exitToMenu}>
          Назад
        </button>
      </div>
    );
  }

  return (
    <ModeSelect
      onStartBots={handleBots}
      onStartOnline={handleOnline}
      onlineError={online.error}
    />
  );
}
