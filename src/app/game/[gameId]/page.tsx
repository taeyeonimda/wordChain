'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Game, Player } from '@/types';

// API call helper
const apiRequest = async (gameId: string, action: string, payload: object = {}) => {
  const response = await fetch(`/api/game/${gameId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    }
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message);
  }
  return response.json();
};

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [word, setWord] = useState('');
  const [name, setName] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isNameSet, setIsNameSet] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch game state periodically
  useEffect(() => {
    if (!gameId || !isNameSet) return;

    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/game/${gameId}`);
        if (response.ok) {
          const data = await response.json();
          setGame(data);
        }
      } catch (e) {
        console.error('Failed to fetch game state', e);
      }
    };

    const interval = setInterval(fetchGame, 2000);

    return () => clearInterval(interval);
  }, [gameId, isNameSet]);

  // On component mount, check if player info is in session storage
  useEffect(() => {
    const storedPlayerId = sessionStorage.getItem(`word-game-player-id-${gameId}`);
    const storedName = sessionStorage.getItem(`word-game-name-${gameId}`);
    if (storedPlayerId && storedName) {
      setPlayerId(storedPlayerId);
      setName(storedName);
      setIsNameSet(true);
    }
  }, [gameId]);

  // Timer effect
  useEffect(() => {
    if (game?.isStarted && !game.isGameOver && game.turnStartedAt) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(game.turnStartedAt).getTime()) / 1000);
        const remaining = 10 - elapsed;
        setTimeLeft(remaining > 0 ? remaining : 0);

        if (remaining <= 0) {
          if (game.players[game.currentPlayerIndex]?.id === playerId) {
            apiRequest(gameId, 'timeout', { playerId });
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [game, gameId, playerId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [game?.words, game?.isGameOver]);

  const handleJoinGame = async () => {
    if (name.trim() && gameId) {
      try {
        setError('');
        const data = await apiRequest(gameId, 'join_game', { name });
        setGame(data);
        setPlayerId(data.playerId);
        setIsNameSet(true);
        sessionStorage.setItem(`word-game-player-id-${gameId}`, data.playerId);
        sessionStorage.setItem(`word-game-name-${gameId}`, name);
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const handleStartGame = async () => {
    try {
      setError('');
      const data = await apiRequest(gameId, 'start_game', { playerId });
      setGame(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleWordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (word.trim()) {
      try {
        setError('');
        const data = await apiRequest(gameId, 'submit_word', { playerId, word });
        setGame(data);
        setWord('');
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  if (!isNameSet) {
    return (
      <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center font-sans">
        <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl text-center w-full max-w-sm">
          <h1 className="text-3xl font-bold mb-6 text-indigo-400">끝말잇기</h1>
          {error && <p className="text-red-400 mb-4 bg-red-900 p-3 rounded-lg">{error}</p>}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-3 border-2 border-gray-700 rounded-lg mb-4 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <button onClick={handleJoinGame} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-bold text-lg transition-transform transform hover:scale-105">
            Join Game
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return <div className="min-h-screen bg-gray-800 text-white flex items-center justify-center">Loading game...</div>;
  }

  const me = game.players.find(p => p.id === playerId);
  const isMyTurn = game.isStarted && !game.isGameOver && game.players[game.currentPlayerIndex]?.id === playerId;
  const losingPlayer = game.isGameOver ? game.players[game.currentPlayerIndex] : null;

  return (
    <div className="min-h-screen bg-gray-800 text-white font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col items-center">

        {/* Word and Timer */}
        <div className="text-center mb-8">
          <p className="text-6xl md:text-8xl font-bold my-4 tracking-widest break-all">
            {game.words.length > 0 ? game.words[game.words.length - 1] : "-"}
          </p>
          {game.isStarted && !game.isGameOver && <div className="text-5xl font-bold text-green-400">{timeLeft}</div>}
        </div>

        {/* Player Slots */}
        <div className="flex flex-row justify-center gap-4 mb-8">
          {game.players.map((p) => (
            <div key={p.id} className={`p-4 rounded-lg text-center w-32 transition-all ${game.players[game.currentPlayerIndex]?.id === p.id && !game.isGameOver ? 'bg-indigo-600 shadow-lg ring-2 ring-indigo-400' : 'bg-gray-700'}`}>
              <p className="font-bold truncate">{p.name} {p.id === playerId && '(You)'}</p>
              {game.hostId === p.id && <p className="text-xs font-bold text-yellow-400">HOST</p>}
            </div>
          ))}
        </div>

        {/* History */}
        <div className="w-full bg-gray-900 p-4 rounded-2xl shadow-lg mb-4 h-48 overflow-y-auto text-sm">
            {game.words.map((w, i) => (
              <div key={i} className="p-2 rounded-lg bg-gray-800 mb-1">
                <span className="font-semibold text-indigo-300">{game.players[(i) % game.players.length].name}:</span> {w}
              </div>
            ))}
            {game.isGameOver && losingPlayer && (
              <div className="p-3 rounded-lg bg-red-900 text-white font-bold text-center">
                Game Over: {losingPlayer.name} lost!
              </div>
            )}
            <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleWordSubmit} className="w-full">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={isMyTurn ? "Your turn!" : "Waiting..."}
              disabled={!isMyTurn || game.isGameOver}
              className="w-full p-4 text-lg text-white bg-gray-800 border-2 border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-gray-700"
            />
        </form>

        {(!game.isStarted || game.isGameOver) && me?.id === game.hostId && (
          <button onClick={handleStartGame} disabled={game.players.length < 2} className="mt-4 px-8 py-3 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all">
            Start Game
          </button>
        )}
      </div>
    </div>
  );
}
