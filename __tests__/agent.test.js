import decide from '../src/ml/agent';

const jogador = {
  cls: 'player', cx: 256, cy: 470, w: 86, h: 99, score: 0.9,
};
const civil = (cx, cy) => ({
  cls: 'civilian', cx, cy, w: 86, h: 70, score: 0.9,
});
const zumbi = (cx, cy) => ({
  cls: 'zombie', cx, cy, w: 87, h: 60, score: 0.9,
});

describe('decide', () => {
  it('não faz nada sem jogador detectado', () => {
    const r = decide([zumbi(100, 100)]);
    expect(Object.values(r.teclas).some(Boolean)).toBe(false);
  });

  it('anda para o lado do zumbi mais baixo', () => {
    const r = decide([jogador, zumbi(100, 200), zumbi(400, 120)]);
    expect(r.teclas.left).toBe(true);
    expect(r.teclas.right).toBe(false);
  });

  it('atira quando o tiro está alinhado com o corpo do zumbi', () => {
    // o tiro sai 10 px à direita
    const r = decide([jogador, zumbi(256 + 10, 200)]);
    expect(r.teclas.space).toBe(true);
    expect(r.teclas.left || r.teclas.right).toBe(false);
  });

  it('não atira de novo se já há um tiro a caminho na mesma pista', () => {
    const tiro = {
      cls: 'shot', cx: 266, cy: 350, w: 6, h: 36, score: 0.8,
    };
    const r = decide([jogador, zumbi(266, 200), tiro]);
    expect(r.teclas.space).toBe(false);
  });

  it('foge de um zumbi que vai encostar nele, para o lado mais curto', () => {
    const r = decide([jogador, zumbi(256, 380)]);
    expect(r.motivo).toBe('fugindo');
    expect(r.teclas.left || r.teclas.right).toBe(true);
  });

  it('não entra na faixa de perigo de um zumbi descendo para perseguir o alvo', () => {
    // o alvo (zumbi mais baixo) está à direita, mas a faixa de perigo dele começa em
    // x=330-55-10=265
    const naBorda = { ...jogador, cx: 262 };
    const r = decide([naBorda, zumbi(330, 400)]);
    expect(r.teclas.right).toBe(false);
  });

  it('compensa o atraso: usa a posição do jogador depois do deslocamento desde o frame', () => {
    // visto em 200, já andou 40 px para a direita: agora está em 240 e o tiro (+10) acerta
    // o zumbi em 250
    const r = decide([{ ...jogador, cx: 200 }, zumbi(250, 200)], { deslocamento: 40 });
    expect(r.teclas.space).toBe(true);
  });

  it('dentro da faixa de perigo sai mesmo faltando poucos px', () => {
    const r = decide([{ ...jogador, cx: 170 }, zumbi(113, 410)]);
    expect(r.teclas.right).toBe(true);
  });

  it('não foge atravessando outro zumbi: sai pelo lado em que não há outro corpo', () => {
    // zumbi x=239 em cima do jogador e outro em x=298 à direita: sair pela direita é
    // atravessar o 298
    const r = decide([{ ...jogador, cx: 233 }, zumbi(239, 288), zumbi(298, 396)]);
    expect(r.motivo).toBe('fugindo');
    expect(r.teclas.left).toBe(true);
    expect(r.teclas.right).toBe(false);
  });

  it('ignora zumbi que já está morrendo (corpse)', () => {
    const r = decide([jogador, {
      cls: 'corpse', cx: 256, cy: 300, w: 70, h: 80, score: 0.9,
    }]);
    expect(r.motivo).toBe('sem alvo');
  });

  it('ignora zumbi que já passou do jogador', () => {
    const r = decide([jogador, zumbi(256, 540)]);
    expect(r.teclas.space).toBe(false);
  });

  describe('civil', () => {
    it('não atira se a civil está na linha do tiro, mais perto que o zumbi', () => {
      // zumbi alinhado em 266 (atiraria), mas a civil em 270 está entre o jogador e o zumbi
      const r = decide([jogador, zumbi(266, 150), civil(270, 330)]);
      expect(r.teclas.space).toBe(false);
    });

    it('atira normalmente se a civil está em outra pista', () => {
      const r = decide([jogador, zumbi(266, 150), civil(120, 330)]);
      expect(r.teclas.space).toBe(true);
    });

    it('pode atirar se a civil está acima do zumbi (o zumbi leva o tiro primeiro)', () => {
      const r = decide([jogador, zumbi(266, 230), civil(266, 60)]);
      expect(r.teclas.space).toBe(true);
    });

    it('vai ao encontro da civil quando ela se aproxima', () => {
      const r = decide([jogador, civil(120, 300)]);
      expect(r.motivo).toBe('resgatando');
      expect(r.teclas.left).toBe(true);
    });

    it('espera a civil na pista dela sem atirar nela', () => {
      const r = decide([jogador, civil(258, 300), zumbi(100, 120)]);
      expect(r.teclas.space).toBe(false);
    });

    it('não vai buscar a civil quando há um zumbi no caminho', () => {
      // civil à direita, mas um zumbi descendo entre o jogador e ela bloqueia o trecho livre
      const r = decide([{ ...jogador, cx: 262 }, civil(420, 300), zumbi(330, 400)]);
      expect(r.motivo).not.toBe('resgatando');
      expect(r.teclas.right).toBe(false);
    });

    it('civil ainda longe (acima do horizonte de resgate) não muda o comportamento', () => {
      const r = decide([jogador, civil(120, 40), zumbi(266, 200)]);
      expect(r.motivo).not.toBe('resgatando');
    });
  });
});
