const gameSettings = {
  canvasWidth: 512,
  canvasHeight: 544,
  playerSpeed: 200,
  scoreGainOnKill: 20,
  scoreLossOnHurt: 0,
  scoreLossOnEnemyPass: 40,
  scoreLossOnMissedShot: 20,
  scoreGainOnRescue: 50,
  scoreLossOnCivilianHit: 100,
  scoreLossOnCivilianLost: 40,
  civilianSpeed: [90, 120],
  civilianDelay: [2500, 5000], // ms entre uma civil sair de cena e a próxima entrar
  startingLife: 3,
  increaseDifficultyEach: 400,
};

export default gameSettings;