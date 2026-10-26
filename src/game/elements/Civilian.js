import Phaser from 'phaser';
import gameSettings from '../settings/game-settings';

// A mulher que corre entre os zumbis. Ela precisa ser resgatada (o jogador encosta nela)
// e NÃO pode levar tiro.
// estado: 'run' (correndo, é o único em que as regras valem) | 'saved' | 'dead'
class Civilian extends Phaser.GameObjects.Sprite {
  constructor(scene) {
    super(scene, Phaser.Math.Between(40, gameSettings.canvasWidth - 40), -80, 'civilian-move');
    this.scene.add.existing(this);

    scene.physics.world.enableBody(this);
    this.body.setSize(40, 70);
    scene.civilians.add(this);

    this.state = 'run';
    this.anims.play('civilian-move_anim', true);
    this.body.velocity.y = Phaser.Math.Between(...gameSettings.civilianSpeed);
  }

  update() {
    if (this.state === 'run' && this.y > gameSettings.canvasHeight + 60) {
      this.scene.score.civilianLost();
      this.finish();
    }
  }

  // texto que sobe e some: feedback do que aconteceu com a pontuação
  popup(text, color) {
    const label = this.scene.add.bitmapText(this.x, this.y - 40, 'pixelFont', text, 26);
    label.setOrigin(0.5);
    label.setTint(color);
    this.scene.tweens.add({
      targets: label, y: label.y - 50, alpha: 0, duration: 900, onComplete: () => label.destroy(),
    });
  }

  rescue() {
    if (this.state !== 'run') return;
    this.state = 'saved';
    this.body.enable = false;
    this.scene.score.rescueCivilian();
    this.popup(`+${gameSettings.scoreGainOnRescue}`, 0x66ff66);
    this.scene.tweens.add({
      targets: this, alpha: 0, scale: 1.3, duration: 400, onComplete: () => this.finish(),
    });
  }

  // 'tiro' (levou um tiro) ou 'zumbi' (foi pega): ela morre nos dois casos,
  // mas só o tiro é culpa do jogador
  die(motivo) {
    if (this.state !== 'run') return;
    this.state = 'dead';
    this.body.velocity.y = 0;
    this.anims.play('civilian-die_anim', true);
    if (motivo === 'tiro') {
      this.scene.score.civilianHit();
      this.popup(`-${gameSettings.scoreLossOnCivilianHit}`, 0xff4444);
    } else {
      this.scene.score.civilianLost();
      this.popup(`-${gameSettings.scoreLossOnCivilianLost}`, 0xffaa44);
    }
    this.scene.time.addEvent({ delay: 1500, callback: () => this.finish() });
  }

  // sai de cena e agenda a próxima
  finish() {
    const { scene } = this; // destroy() solta this.scene, então guardamos antes
    scene.civilians.remove(this, true, true);
    scene.scheduleCivilian();
  }
}

export default Civilian;
