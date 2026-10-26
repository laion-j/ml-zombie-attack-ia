import Phaser from 'phaser';
import gameSettings from '../settings/game-settings';
import formatZeros from '../helpers/output-formatter';

class Score extends Phaser.GameObjects.Container {
  constructor(scene) {
    super(scene);
    this.scene = scene;

    this.scoreLabel = this.scene.add.bitmapText(20, 20, 'pixelFont', 'SCORE: 000000', 20);
    this.score = 0;
  }

  enemyPass() {
    const newScore = this.score - gameSettings.scoreLossOnEnemyPass;
    this.score = (newScore > 0) ? newScore : 0;
    this.updateLabel();
  }

  missedShot() {
    const newScore = this.score - gameSettings.scoreLossOnMissedShot;
    this.score = (newScore > 0) ? newScore : 0;
    this.updateLabel();
  }

  hurtByEnemy() {
    const newScore = this.score - gameSettings.scoreLossOnHurt;
    this.score = (newScore > 0) ? newScore : 0;
    this.updateLabel();
  }

  hitEnemy() {
    this.score += gameSettings.scoreGainOnKill;
    this.updateLabel();
  }

  // civil resgatada: bônus
  rescueCivilian() {
    this.score += gameSettings.scoreGainOnRescue;
    this.updateLabel();
  }

  // tiro na civil: a penalidade mais pesada do jogo
  civilianHit() {
    const newScore = this.score - gameSettings.scoreLossOnCivilianHit;
    this.score = (newScore > 0) ? newScore : 0;
    this.updateLabel();
  }

  // civil que passou do fim da tela ou foi pega por um zumbi
  civilianLost() {
    const newScore = this.score - gameSettings.scoreLossOnCivilianLost;
    this.score = (newScore > 0) ? newScore : 0;
    this.updateLabel();
  }

  updateLabel() {
    this.scoreLabel.text = `SCORE: ${formatZeros(this.score)}`;
  }
}

export default Score;