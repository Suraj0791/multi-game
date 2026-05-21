import { findByEmail } from '../models/User.js';

const BOT_EMAIL_DOMAIN = '@tourneyhub.demo';

export function isBotUser(user) {
  return user && user.email && user.email.endsWith(BOT_EMAIL_DOMAIN);
}

export function isBotByEmail(email) {
  return email && email.endsWith(BOT_EMAIL_DOMAIN);
}

export async function checkBotOpponent(match) {
  if (!match) return null;

  const botFields = [
    { id: match.player_1_id, email: match.player_1_email },
    { id: match.player_2_id, email: match.player_2_email },
  ];

  for (const f of botFields) {
    if (f.email && isBotByEmail(f.email)) {
      return f.id;
    }
  }

  return null;
}

export function pickBotTriviaAnswer(game) {
  const currentQ = game.questions[game.currentQuestionIndex];
  const isCorrect = Math.random() < 0.5;
  if (isCorrect) {
    return { answer: currentQ.correctAnswer, timeTakenMs: 3000 + Math.random() * 5000 };
  }
  const wrong = currentQ.options.filter(o => o !== currentQ.correctAnswer);
  return { answer: wrong[Math.floor(Math.random() * wrong.length)], timeTakenMs: 2000 + Math.random() * 6000 };
}

const BOT_WORDS = ['APPLE', 'BANANA', 'SUN', 'TREE', 'HOUSE', 'STAR', 'MOON', 'FISH'];

export function botQuickDrawGuess(game) {
  if (Math.random() < 0.08) {
    return { guess: game.wordToDraw };
  }
  const wrong = BOT_WORDS.filter(w => w !== game.wordToDraw);
  return { guess: wrong[Math.floor(Math.random() * wrong.length)] };
}

const BOT_SHAPES = {
  house: [
    { type: 'start', x: 200, y: 300 }, { type: 'draw', x: 200, y: 200 },
    { type: 'start', x: 200, y: 200 }, { type: 'draw', x: 300, y: 120 },
    { type: 'start', x: 300, y: 120 }, { type: 'draw', x: 400, y: 200 },
    { type: 'start', x: 400, y: 200 }, { type: 'draw', x: 400, y: 300 },
    { type: 'start', x: 400, y: 300 }, { type: 'draw', x: 200, y: 300 },
    { type: 'start', x: 270, y: 300 }, { type: 'draw', x: 270, y: 230 },
    { type: 'start', x: 270, y: 230 }, { type: 'draw', x: 330, y: 230 },
    { type: 'start', x: 330, y: 230 }, { type: 'draw', x: 330, y: 300 },
  ],
  sun: [
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 350, y: 200 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 250, y: 200 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 300, y: 150 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 300, y: 250 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 335, y: 165 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 265, y: 165 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 265, y: 235 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 335, y: 235 },
    { type: 'start', x: 285, y: 200 }, { type: 'draw', x: 275, y: 190 },
  ],
  star: [
    { type: 'start', x: 300, y: 100 }, { type: 'draw', x: 325, y: 180 },
    { type: 'start', x: 325, y: 180 }, { type: 'draw', x: 400, y: 180 },
    { type: 'start', x: 400, y: 180 }, { type: 'draw', x: 340, y: 230 },
    { type: 'start', x: 340, y: 230 }, { type: 'draw', x: 365, y: 310 },
    { type: 'start', x: 365, y: 310 }, { type: 'draw', x: 300, y: 260 },
    { type: 'start', x: 300, y: 260 }, { type: 'draw', x: 235, y: 310 },
    { type: 'start', x: 235, y: 310 }, { type: 'draw', x: 260, y: 230 },
    { type: 'start', x: 260, y: 230 }, { type: 'draw', x: 200, y: 180 },
    { type: 'start', x: 200, y: 180 }, { type: 'draw', x: 275, y: 180 },
    { type: 'start', x: 275, y: 180 }, { type: 'draw', x: 300, y: 100 },
  ],
  tree: [
    { type: 'start', x: 300, y: 300 }, { type: 'draw', x: 300, y: 200 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 250, y: 250 },
    { type: 'start', x: 300, y: 200 }, { type: 'draw', x: 350, y: 250 },
    { type: 'start', x: 300, y: 230 }, { type: 'draw', x: 230, y: 280 },
    { type: 'start', x: 300, y: 230 }, { type: 'draw', x: 370, y: 280 },
    { type: 'start', x: 285, y: 300 }, { type: 'draw', x: 315, y: 300 },
  ],
  fish: [
    { type: 'start', x: 200, y: 200 }, { type: 'draw', x: 400, y: 200 },
    { type: 'start', x: 400, y: 200 }, { type: 'draw', x: 420, y: 180 },
    { type: 'start', x: 400, y: 200 }, { type: 'draw', x: 420, y: 220 },
    { type: 'start', x: 420, y: 180 }, { type: 'draw', x: 420, y: 220 },
    { type: 'start', x: 250, y: 190 }, { type: 'draw', x: 270, y: 200 },
    { type: 'start', x: 250, y: 210 }, { type: 'draw', x: 270, y: 200 },
  ],
  apple: [
    { type: 'start', x: 300, y: 150 }, { type: 'draw', x: 280, y: 170 },
    { type: 'start', x: 280, y: 170 }, { type: 'draw', x: 280, y: 280 },
    { type: 'start', x: 280, y: 280 }, { type: 'draw', x: 320, y: 280 },
    { type: 'start', x: 320, y: 280 }, { type: 'draw', x: 320, y: 170 },
    { type: 'start', x: 320, y: 170 }, { type: 'draw', x: 300, y: 150 },
    { type: 'start', x: 300, y: 150 }, { type: 'draw', x: 300, y: 130 },
  ],
};

const SHAPE_NAMES = Object.keys(BOT_SHAPES);
let _botShapeIdx = 0;
let _botStrokeInShape = 0;
let _botCurrentShape = null;

export function generateBotStroke() {
  if (!_botCurrentShape || _botStrokeInShape >= _botCurrentShape.length) {
    const name = SHAPE_NAMES[_botShapeIdx % SHAPE_NAMES.length];
    _botShapeIdx++;
    _botCurrentShape = BOT_SHAPES[name];
    _botStrokeInShape = 0;
  }
  const s = _botCurrentShape[_botStrokeInShape];
  _botStrokeInShape++;
  return {
    x: s.x + (Math.random() - 0.5) * 10,
    y: s.y + (Math.random() - 0.5) * 10,
    type: s.type,
  };
}
