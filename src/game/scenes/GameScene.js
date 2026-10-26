import Phaser from 'phaser';
import { createBackground, createRandomZombie } from '../helpers/environment-creator';
import Player from '../elements/Player';
import Zombie from '../elements/Zombie';
import Civilian from '../elements/Civilian';
import Shot from '../elements/Shot';
import Score from '../elements/Score';
import Life from '../elements/Life';
import handleShots from '../helpers/shots-handler';
import gameSettings from '../settings/game-settings';

// regras da civil (não usam o estado da cena, por isso ficam fora da classe)
const shootCivilian = (shot, civilian) => {
  if (civilian.state !== 'run') return;
  shot.destroy();
  civilian.die('tiro');
};

const rescueCivilian = (player, civilian) => {
  if (player.isDead || civilian.state !== 'run') return;
  civilian.rescue();
};

const zombieGetsCivilian = (zombie, civilian) => {
  if (zombie.isDead || civilian.state !== 'run') return;
  civilian.die('zumbi');
};

class GameScene extends Phaser.Scene {
  constructor() {
    super('gameScene');
    this.difficulty = 1;
  }

  create() {
    createBackground(this);

    // create groups
    this.shots = this.add.group({
      classType: Shot,
      runChildUpdate: true,
    });

    this.zombies = this.add.group({
      classType: Zombie,
      runChildUpdate: true,
    });

    // a civil que precisa ser salva (uma por vez)
    this.civilians = this.add.group({
      classType: Civilian,
      runChildUpdate: true,
    });
    this.scheduleCivilian();

    // create zombies and players
    for (let i = 0; i < 4; i += 1) {
      const zombie = new Zombie(this, createRandomZombie()); // eslint-disable-line no-unused-vars
    }
    this.player = new Player(this);

    // create score and life
    this.score = new Score(this);
    this.life = new Life(this);
    this.gameOver = false;

    // add keys and overlaps
    this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.physics.add.overlap(this.shots, this.zombies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.player, this.zombies, this.hurtPlayer, null, this);
    this.physics.add.overlap(this.shots, this.civilians, shootCivilian, null, this);
    this.physics.add.overlap(this.player, this.civilians, rescueCivilian, null, this);
    this.physics.add.overlap(this.zombies, this.civilians, zombieGetsCivilian, null, this);
  }

  update() {
    this.player.moveManager();

    handleShots(this);
  }

  hurtPlayer(player, zombie) {
    if (player.isDead || player.alpha < 1 || zombie.isDead) return;
    player.die();
    this.score.hurtByEnemy();
    this.life.playerDie();
    if (this.gameOver) {
      this.time.addEvent({
        delay: 1800,
        callback: () => {
          const playerScore = this.score.score;
          const { playerName } = this.sys.game.globals.preferences;
          if (playerScore > 0) {
            this.sys.game.globals.scores.push({ user: playerName, score: playerScore });
            this.sys.game.globals.scoreBoard.submitScore(playerName, playerScore);
            this.sys.game.globals.preferences.playerScore = this.score.score;
          }
          this.scene.start('gameOverScene');
        },
        callbackScope: this,
        loop: false,
      });
    }
  }

  scheduleCivilian() {
    this.time.addEvent({
      delay: Phaser.Math.Between(...gameSettings.civilianDelay),
      callback: () => { if (!this.gameOver) new Civilian(this); }, // eslint-disable-line no-new
      callbackScope: this,
    });
  }

  hitEnemy(shot, zombie) {
    if (zombie.isDead) return;
    shot.destroy();
    zombie.die();
    this.score.hitEnemy();
    this.handleDifficulty();
  }

  handleDifficulty() {
    if (this.score.score / gameSettings.increaseDifficultyEach >= this.difficulty) {
      const zombie = new Zombie(this, createRandomZombie()); // eslint-disable-line no-unused-vars
      this.difficulty += 1;
    }
  }
}

export default GameScene;