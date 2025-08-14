
import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import connectDB from './src/lib/mongodb';
import GameModel from './src/models/Game';
import { Game, Player } from './src/types';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // In production, you should restrict this to your domain
      methods: ['GET', 'POST'],
    },
  });

  connectDB();

  io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    const emitGameUpdate = async (gameId: string) => {
      const game = await GameModel.findOne({ gameId });
      io.to(gameId).emit('game_update', game);
    };

    socket.on('join_game', async ({ gameId, name }) => {
      try {
        socket.join(gameId);
        let game = await GameModel.findOne({ gameId });

        if (!game) {
          // Create new game if it doesn't exist
          game = new GameModel({
            gameId,
            players: [{ id: socket.id, name }],
            hostId: socket.id,
            words: [],
          });
        } else {
          // Add player if not already in the game
          if (!game.players.some((p: Player) => p.id === socket.id)) {
            if (game.players.length >= 3) {
              socket.emit('error_message', 'This game room is full.');
              return;
            }
            game.players.push({ id: socket.id, name });
          }
        }
        await game.save();
        emitGameUpdate(gameId);
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error_message', 'Failed to join the game.');
      }
    });

    socket.on('start_game', async ({ gameId }) => {
      try {
        let game = await GameModel.findOne({ gameId });
        if (game && game.hostId === socket.id) {
          game.isStarted = true;
          await game.save();
          emitGameUpdate(gameId);
        }
      } catch (error) {
        console.error('Start game error:', error);
      }
    });

    socket.on('submit_word', async ({ gameId, word }) => {
      try {
        let game = await GameModel.findOne({ gameId });
        if (!game || !game.isStarted) return;

        // Check if it's the correct player's turn
        if (game.players[game.currentPlayerIndex].id !== socket.id) {
          socket.emit('error_message', 'Not your turn.');
          return;
        }

        // Word validation
        const lastWord = game.words[game.words.length - 1];
        if (game.words.length > 0 && !word.startsWith(lastWord.slice(-1))) {
          socket.emit('error_message', 'Word must start with the last letter of the previous word.');
          return;
        }
        if (game.words.includes(word)) {
          socket.emit('error_message', 'This word has already been used.');
          return;
        }

        game.words.push(word);
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        await game.save();
        emitGameUpdate(gameId);

      } catch (error) {
        console.error('Submit word error:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log('user disconnected:', socket.id);
      try {
        let game = await GameModel.findOne({ 'players.id': socket.id });
        if (game) {
          game.players = game.players.filter((p: Player) => p.id !== socket.id);
          // If host disconnects, assign a new host
          if (game.hostId === socket.id && game.players.length > 0) {
            game.hostId = game.players[0].id;
          }
          // If game is empty, delete it
          if (game.players.length === 0) {
            await GameModel.deleteOne({ gameId: game.gameId });
          } else {
            await game.save();
            emitGameUpdate(game.gameId);
          }
        }
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });

  server.all('*', (req: Request, res: Response) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
