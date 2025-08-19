
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GameModel from '@/models/Game';
import { Player } from '@/types';

// Helper to generate a unique ID for players
const generatePlayerId = () => 'player_' + Math.random().toString(36).substr(2, 9);

// GET: Fetch the current game state
export async function GET(request: Request, { params }: { params: { gameId: string } }) {
  try {
    await connectDB();
    const game = await GameModel.findOne({ gameId: params.gameId });

    if (!game) {
      return NextResponse.json({ message: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game, { status: 200 });
  } catch (error) {
    console.error('GET Game Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Handle game actions (join, start, submit word, etc.)
export async function POST(request: Request, { params }: { params: { gameId: string } }) {
  try {
    await connectDB();
    const { action, payload } = await request.json();
    const { gameId } = params;

    let game = await GameModel.findOne({ gameId });

    if (!game) {
      // If game doesn't exist, only 'join_game' is a valid action
      if (action !== 'join_game') {
        return NextResponse.json({ message: 'Game not found' }, { status: 404 });
      }
    }

    switch (action) {
      case 'join_game': {
        const { name } = payload;
        const playerId = generatePlayerId();

        if (!game) {
          // Create new game if it doesn't exist
          game = new GameModel({
            gameId,
            players: [{ id: playerId, name }],
            hostId: playerId,
            words: [],
          });
        } else {
          // Add player if not already in the game
          if (!game.players.some((p: Player) => p.name === name)) { // Avoid duplicate names
            if (game.players.length >= 10) { // Set player limit
              return NextResponse.json({ message: 'This game room is full.' }, { status: 403 });
            }
            game.players.push({ id: playerId, name });
          } else {
            // If player with same name exists, just return their ID
            const existingPlayer = game.players.find((p: Player) => p.name === name);
            return NextResponse.json({ ...game.toObject(), playerId: existingPlayer.id }, { status: 200 });
          }
        }
        await game.save();
        // Return game state with the new player's ID
        return NextResponse.json({ ...game.toObject(), playerId }, { status: 200 });
      }

      case 'start_game': {
        const { playerId } = payload;
        if (game && game.hostId === playerId) {
          game.isStarted = true;
          game.turnStartedAt = new Date(); // Start the timer for the first player
          await game.save();
        } else {
          return NextResponse.json({ message: 'Only the host can start the game.' }, { status: 403 });
        }
        break;
      }

      case 'submit_word': {
        const { word, playerId } = payload;
        if (!game || !game.isStarted) {
            return NextResponse.json({ message: 'Game has not started.' }, { status: 400 });
        }

        // Check if it's the correct player's turn
        if (game.players[game.currentPlayerIndex].id !== playerId) {
          return NextResponse.json({ message: 'Not your turn.' }, { status: 403 });
        }

        // Time validation (10 seconds)
        if (game.turnStartedAt && Date.now() - new Date(game.turnStartedAt).getTime() > 10000) {
          return NextResponse.json({ message: 'Time is up! (10 seconds)' }, { status: 400 });
        }

        // Word validation
        if (word.length < 3) {
          return NextResponse.json({ message: 'Word must be at least 3 characters long.' }, { status: 400 });
        }
        if (!/^[가-힣]+$/.test(word)) {
          return NextResponse.json({ message: 'Word must contain only Korean characters.' }, { status: 400 });
        }
        const lastWord = game.words[game.words.length - 1];
        if (game.words.length > 0 && !word.startsWith(lastWord.slice(-1))) {
          return NextResponse.json({ message: 'Word must start with the last letter of the previous word.' }, { status: 400 });
        }
        if (game.words.includes(word)) {
          return NextResponse.json({ message: 'This word has already been used.' }, { status: 400 });
        }

        game.words.push(word);
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        game.turnStartedAt = new Date(); // Reset timer for the next player
        await game.save();
        break;
      }
      case 'timeout': {
        // This action is triggered when a player's turn times out.
        if (!game || !game.isStarted) {
          return NextResponse.json({ message: 'Game has not started.' }, { status: 400 });
        }
        
        game.isGameOver = true;
        await game.save();
        break;
      }
      
      case 'leave_game': {
        const { playerId } = payload;
        if (game) {
          game.players = game.players.filter((p: Player) => p.id !== playerId);
          // If host leaves, assign a new host
          if (game.hostId === playerId && game.players.length > 0) {
            game.hostId = game.players[0].id;
          }
          // If game is empty, delete it
          if (game.players.length === 0) {
            await GameModel.deleteOne({ gameId });
            return NextResponse.json({ message: 'Game deleted' }, { status: 200 });
          } else {
            await game.save();
          }
        }
        break;
      }

      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    const updatedGame = await GameModel.findOne({ gameId });
    return NextResponse.json(updatedGame, { status: 200 });

  } catch (error) {
    console.error('POST Game Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
