import Phaser from 'phaser';
import './assets/styles/style.css';
import config from './game/settings/config';
import Preferences from './game/settings/Preferences';
import ScoreBoard from './game/api/ScoreBoard';

class Game extends Phaser.Game {
  constructor() {
    super(config);
    const preferences = new Preferences();
    const scoreBoard = new ScoreBoard();
    this.globals = { preferences, scoreBoard };
  }
}

window.game = new Game();

// ?ia=1 liga o jogador de IA (detector YOLO no navegador);
// carregado sob demanda para não pesar no jogo normal
if (new URLSearchParams(window.location.search).has('ia')) {
  import('./ml/main').then((modulo) => modulo.default(window.game));
}