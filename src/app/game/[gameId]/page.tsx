'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Game, Player } from '@/src/types';

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

    const interval = setInterval(fetchGame, 2000); // Poll every 2 seconds

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

  const handleJoinGame = async () => {
    if (name.trim() && gameId) {
      try {
        setError('');
        const data = await apiRequest(gameId, 'join_game', { name });
        setGame(data);
        setPlayerId(data.playerId);
        setIsNameSet(true);
        // Store player info in session storage to persist across reloads
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
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Enter Your Name</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          className="p-2 border rounded mb-4"
        />
        <button onClick={handleJoinGame} className="bg-blue-500 text-white p-2 rounded">
          Join Game
        </button>
      </div>
    );
  }

  if (!game) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;
  }

  const me = game.players.find(p => p.id === playerId);
  const isMyTurn = game.isStarted && game.players[game.currentPlayerIndex]?.id === playerId;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl md:text-4xl font-bold text-indigo-400 mb-2">끝말잇기</h1>
        <p className="text-gray-400 mb-2">Game ID: {game.gameId}</p>
        {error && <p className="text-red-500 mb-4">Error: {error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Players List */}
          <div className="md:col-span-1 bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            <ul>
              {game.players.map((p, i) => (
                <li key={p.id} className={`flex items-center justify-between p-2 rounded ${game.players[game.currentPlayerIndex]?.id === p.id ? 'bg-indigo-500' : ''}`}>
                  <span>{p.name} {p.id === playerId && '(You)'}</span>
                  {game.hostId === p.id && <span className="text-xs font-bold text-yellow-400">HOST</span>}
                </li>
              ))}
            </ul>
            {!game.isStarted && me?.id === game.hostId && (
              <button onClick={handleStartGame} disabled={game.players.length < 2} className="w-full mt-4 px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
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
