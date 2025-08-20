import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GameModel from '@/models/Game';
import { Player } from '@/types';

// Helper to generate a unique ID for players
const generatePlayerId = () => 'player_' + Math.random().toString(36).substr(2, 9);

const KOREAN_WORDS = [
  "하늘", "바다", "구름", "나무", "사랑", "희망", "미래", "행복", "웃음", "사람",
  "친구", "가족", "건강", "성공", "열정", "노력", "결실", "보람", "믿음", "소망",
  "시간", "공간", "우주", "세상", "자연", "동물", "식물", "음악", "미술", "영화",
  "책상", "의자", "컴퓨터", "핸드폰", "자동차", "자전거", "비행기", "기차", "지하철",
  "버스", "택시", "도로", "신호등", "건물", "아파트", "주택", "빌라", "학교", "회사",
  "병원", "약국", "은행", "우체국", "도서관", "박물관", "미술관", "공원", "놀이터",
  "운동장", "수영장", "체육관", "경기장", "콘서트", "페스티벌", "축제", "여행", "휴가",
  "방학", "주말", "평일", "오늘", "내일", "어제", "아침", "점심", "저녁", "새벽",
  "봄", "여름", "가을", "겨울", "해", "달", "별", "바람", "비", "눈"
];

const getRandomKoreanWord = () => {
  const randomIndex = Math.floor(Math.random() * KOREAN_WORDS.length);
  return KOREAN_WORDS[randomIndex];
};

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
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return NextResponse.json({ message: 'Player name is required.' }, { status: 400 });
        }

        const newPlayerId = generatePlayerId();

        if (!game) {
          // If game doesn't exist, create it with the first player
          const newGame = new GameModel({
            gameId,
            players: [{ id: newPlayerId, name }],
            hostId: newPlayerId,
            words: [],
          });
          await newGame.save();
          return NextResponse.json({ ...newGame.toObject(), playerId: newPlayerId }, { status: 201 });
        }

        // If game exists, check for player limit
        if (game.players.length >= 10) {
          return NextResponse.json({ message: 'This game room is full.' }, { status: 403 });
        }

        // Atomically add player if name doesn't exist
        const updatedGame = await GameModel.findOneAndUpdate(
          { gameId, 'players.name': { $ne: name } },
          { $push: { players: { id: newPlayerId, name } } },
          { new: true }
        );

        if (updatedGame) {
          // Player was added successfully
          return NextResponse.json({ ...updatedGame.toObject(), playerId: newPlayerId });
        } else {
          // Player with the same name already exists, fetch the game and find the player's ID
          const existingGame = await GameModel.findOne({ gameId });
          const existingPlayer = existingGame.players.find((p: Player) => p.name === name);
          return NextResponse.json({ ...existingGame.toObject(), playerId: existingPlayer.id });
        }
      }

      case 'start_game': {
        const { playerId } = payload;
        if (game && game.hostId === playerId) {
          // If the game is over, reset it for a new round
          if (game.isGameOver) {
            // Removed previous round history capture as per user request to rollback
            // const losingPlayer = game.players[game.currentPlayerIndex];
            // const currentRoundHistory = {
            //   words: game.words,
            //   losingPlayerId: losingPlayer ? losingPlayer.id : null,
            //   startedAt: game.turnStartedAt || new Date(), // Use turnStartedAt or current time
            //   endedAt: new Date(),
            // };
            // game.previousRounds.push(currentRoundHistory);

            game.words = []; // Reset words
            // game.words = [getRandomKoreanWord()]; // Start with a new random word
            game.currentPlayerIndex = 0; // Reset current player
            game.isGameOver = false; // Set game over to false
          } else if (game.words.length === 0) {
            // game.words.push(getRandomKoreanWord());
          }
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
          game.isGameOver = true;
          await game.save();
          return NextResponse.json({ message: 'Time is up! (10 seconds)' }, { status: 400 });
        }

        // Word validation
        if (word.length < 2) {
          return NextResponse.json({ message: 'Word must be at least 2 characters long.' }, { status: 400 });
        }
        if (!/^[가-힣]+$/.test(word)) {
          return NextResponse.json({ message: 'Word must contain only Korean characters.' }, { status: 400 });
        }
        if (game.words.length > 0) {
            const lastWord = game.words[game.words.length - 1];
            if (!word.startsWith(lastWord.slice(-1))) {
              return NextResponse.json({ message: 'Word must start with the last letter of the previous word.' }, { status: 400 });
            }
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