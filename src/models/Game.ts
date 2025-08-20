import { Schema, model, models } from 'mongoose';
import { Game, Player } from '@/types';

const playerSchema = new Schema<Player>({
  id: { type: String, required: true },
  name: { type: String, required: true },
});

const gameRoundHistorySchema = new Schema({
  words: [{ type: String }],
  losingPlayerId: { type: String, default: null },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
});

const gameSchema = new Schema<Game>({
  gameId: { type: String, required: true, unique: true, index: true },
  players: [playerSchema],
  words: [{ type: String }],
  currentPlayerIndex: { type: Number, default: 0 },
  isStarted: { type: Boolean, default: false },
  isGameOver: { type: Boolean, default: false },
  hostId: { type: String, required: true },
  turnStartedAt: { type: Date, default: null },
}, { timestamps: true });

const GameModel = models.Game || model<Game>('Game', gameSchema);

export default GameModel;