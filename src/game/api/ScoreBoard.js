// Placar local (localStorage). Mantém a mesma interface do placar remoto antigo,
// mas nada sai do navegador: as partidas da IA não enviam pontuação para servidor nenhum.
const STORAGE_KEY = 'zombie-attack:scores';

const readScores = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || [];
  } catch (error) {
    return [];
  }
};

const writeScores = (key, scores) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(scores));
  } catch (error) {
    // sem localStorage (modo privado, por exemplo): o placar vale só até recarregar a página
  }
};

class ScoreBoard {
  constructor() {
    this.storageKey = STORAGE_KEY;
  }

  async getScores() {
    return { result: readScores(this.storageKey) };
  }

  async submitScore(player, score) {
    if (typeof player !== 'string' || typeof score !== 'number') {
      return { result: 'Invalid arguments.' };
    }
    const scores = readScores(this.storageKey);
    scores.push({ user: player, score });
    // guarda só as 50 melhores para o storage não crescer sem limite
    writeScores(this.storageKey, scores.sort((a, b) => b.score - a.score).slice(0, 50));
    return { result: 'Leaderboard score created correctly.' };
  }
}

export default ScoreBoard;
