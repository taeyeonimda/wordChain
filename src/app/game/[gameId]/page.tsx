'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { Game, Player } from '@/types';

let socket: Socket;

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const name = searchParams.get('name') || 'Player';

  const [game, setGame] = useState<Game | null>(null);
  const [word, setWord] = useState('');

  useEffect(() => {
    // Initialize socket connection
    socket = io();

    socket.on('connect', () => {
      console.log('Connected to socket server');
      socket.emit('join_game', { gameId, name });
    });

    socket.on('game_update', (updatedGame: Game) => {
      setGame(updatedGame);
    });

    socket.on('error_message', (message: string) => {
      alert(message);
    });

    // Cleanup on component unmount
    return () => {
      socket.disconnect();
    };
  }, [gameId, name]);

  const handleStartGame = () => {
    socket.emit('start_game', { gameId });
  };

  const handleWordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (word.trim()) {
      socket.emit('submit_word', { gameId, word });
      setWord('');
    }
  };

  if (!game) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  }

  const me = game.players.find(p => p.id === socket.id);
  const isMyTurn = game.isStarted && game.players[game.currentPlayerIndex]?.id === socket.id;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl md:text-4xl font-bold text-indigo-400 mb-2">끝말잇기</h1>
        <p className="text-gray-400 mb-6">Game ID: {game.gameId}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Players List */}
          <div className="md:col-span-1 bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            <ul>
              {game.players.map((p, i) => (
                <li key={p.id} className={`flex items-center justify-between p-2 rounded ${game.players[game.currentPlayerIndex]?.id === p.id ? 'bg-indigo-500' : ''}`}>
                  <span>{p.name} {p.id === socket.id && '(You)'}</span>
                  {game.hostId === p.id && <span className="text-xs font-bold text-yellow-400">HOST</span>}
                </li>
              ))}
            </ul>
            {!game.isStarted && me?.id === game.hostId && (
              <button onClick={handleStartGame} className="w-full mt-4 px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">
                Start Game
              </button>
            )}
          </div>

          {/* Game Board */}
          <div className="md:col-span-2 bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Words</h2>
            <div className="h-64 overflow-y-auto bg-gray-900 p-2 rounded mb-4">
              {game.words.length === 0 && <p className="text-gray-500">No words yet...</p>}
              <p className="text-lg leading-relaxed break-all">
                {game.words.join(' → ')}
              </p>
            </div>
            {game.isStarted && (
              <form onSubmit={handleWordSubmit}>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder={isMyTurn ? "Your turn..." : "Waiting for other player..."}
                  disabled={!isMyTurn}
                  className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-600"
                />
                <button type="submit" disabled={!isMyTurn} className="w-full mt-2 px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-500">
                  Submit Word
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
