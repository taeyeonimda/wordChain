'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState('');
  const router = useRouter();

  const handleCreateGame = () => {
    if (!name) {
      alert('Please enter your name.');
      return;
    }
    const newGameId = Math.random().toString(36).substr(2, 6);
    router.push(`/game/${newGameId}?name=${name}`);
  };

  const handleJoinGame = () => {
    if (!name || !gameId) {
      alert('Please enter your name and a game ID.');
      return;
    }
    router.push(`/game/${gameId}?name=${name}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-indigo-400">끝말잇기</h1>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300">Your Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="플레이어 이름"
            />
          </div>
          <div>
            <button
              onClick={handleCreateGame}
              className="w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-800"
            >
              Create New Game
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center space-x-2">
            <hr className="flex-grow border-gray-600"/>
            <span className="text-gray-400">OR</span>
            <hr className="flex-grow border-gray-600"/>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="gameId" className="block text-sm font-medium text-gray-300">Game ID</label>
            <input
              id="gameId"
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="게임 ID 입력"
            />
          </div>
          <button
            onClick={handleJoinGame}
            className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-800"
          >
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}
