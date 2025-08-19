export interface Player {
  id: string;
  name: string;
}

export interface Game {
  gameId: string;
  players: Player[];
  words: string[];
  currentPlayerIndex: number;
  isStarted: boolean;
  isGameOver: boolean;
  hostId: string;
  turnStartedAt: Date | null;
}
