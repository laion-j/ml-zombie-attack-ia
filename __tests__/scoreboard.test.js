import ScoreBoard from '../src/game/api/ScoreBoard';

describe('ScoreBoard (placar local)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  it('começa vazio', async () => {
    const scores = await new ScoreBoard().getScores();
    expect(scores.result).toEqual([]);
  });

  it('guarda a pontuação enviada e devolve em ordem decrescente', async () => {
    const scoreBoard = new ScoreBoard();
    await scoreBoard.submitScore('Player1', 120);
    await scoreBoard.submitScore('Player3', 1500);
    await scoreBoard.submitScore('Player2', 240);
    const scores = await scoreBoard.getScores();
    expect(scores.result.map(s => s.user)).toEqual(['Player3', 'Player2', 'Player1']);
  });

  it('responde com sucesso ao enviar uma pontuação válida', async () => {
    const response = await new ScoreBoard().submitScore('Player', 1200);
    expect(response.result).toEqual('Leaderboard score created correctly.');
  });

  it('responde "Invalid arguments." quando os tipos estão errados', async () => {
    const response = await new ScoreBoard().submitScore(['Player'], '1200');
    expect(response.result).toEqual('Invalid arguments.');
  });

  it('nunca faz requisição de rede', async () => {
    const scoreBoard = new ScoreBoard();
    await scoreBoard.submitScore('Player', 10);
    await scoreBoard.getScores();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
