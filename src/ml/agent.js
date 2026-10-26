// Política do jogador de IA: recebe o que o detector viu e devolve quais teclas apertar.
// Função pura (sem Phaser, sem DOM) para poder testar com um jogo "de mentira".
//
// Detecções: [{ cls: 'zombie' | 'player' | 'shot' | 'corpse', cx, cy, w, h, score }], em pixels do canvas do jogo.
//
// A ideia: cada zumbi que está descendo cria uma FAIXA de posições horizontais em que o jogador seria atingido.
// O jogador só pode andar dentro do trecho livre onde está (atravessar uma faixa é levar o zumbi) e, dentro dele,
// vai para a posição que alinha o tiro com o alvo. Se já estiver numa faixa, sai pela borda mais próxima.
//
// A civil (a mulher que precisa ser salva) é uma classe à parte: nunca é alvo. Dois comportamentos:
//   - segurar o tiro: se ela está na linha do tiro (e mais perto que o alvo), atirar mataria a civil (-100);
//   - resgatar: quando ela se aproxima, vai para a pista dela e deixa que ela encoste (+50), desde que o caminho
//     até lá esteja livre de zumbis. A fuga dos zumbis continua tendo prioridade sobre tudo.
//
// O corpo de colisão do Phaser é centrado no sprite e menor que o desenho (Player.js: setSize(40, 80);
// Zombie.js: setSize(70, 70), ou 40x70 para o zombie2). Como o detector não distingue os dois zumbis, usamos o maior.
const CORPO = {
  jogador: {
    x0: -20, x1: 20, y0: -40, y1: 40,
  },
  zumbi: {
    x0: -35, x1: 35, y0: -35, y1: 35,
  },
};
export const VEL_JOGADOR = 200; // px/s (gameSettings.playerSpeed)
const VEL_ZUMBI = 125; // px/s: média dos zumbis (100 a 150)
const VEL_CIVIL = 105; // px/s: média da civil (90 a 120)
const CORPO_CIVIL = 20; // meia largura do corpo da civil (Civilian.js: setSize(40, 70))
const TIRO_DX = 10; // o tiro nasce 10 px à direita do centro do jogador (Shot.js)
const X_MIN = 50; // limites do centro do sprite (o corpo não sai do mundo)
const X_MAX = 462;
const OPCOES = {
  horizonte: 200, // px acima do jogador em que um zumbi já conta como ameaça
  margem: 10, // folga horizontal extra ao desviar
  tolerancia: 8, // px: dentro disso o jogador fica parado
  distanciaResgate: 300, // px acima do jogador em que a civil já merece ser esperada
  folgaCivil: 14, // px extras ao redor do tiro e da civil para decidir que ela está na linha de tiro
  toleranciaTiro: 16, // px entre o tiro e o centro do zumbi (o zombie2 só tem ±20 px de corpo)
  larguraPista: 30, // dois tiros assim próximos acertam o mesmo zumbi
};

const melhor = (dets, cls) => dets.filter((d) => d.cls === cls).sort((a, b) => b.score - a.score)[0];
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// posições do centro do jogador em que os corpos se sobrepõem na horizontal
const faixaPerigo = (z, margem) => [
  z.cx + CORPO.zumbi.x0 - CORPO.jogador.x1 - margem,
  z.cx + CORPO.zumbi.x1 - CORPO.jogador.x0 + margem,
];

// junta faixas que se tocam
const unir = (faixas) => faixas.sort((a, b) => a[0] - b[0]).reduce((acc, f) => {
  const ultima = acc[acc.length - 1];
  if (ultima && f[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], f[1]);
  else acc.push([f[0], f[1]]);
  return acc;
}, []);

// opcoes.atrasoMs: idade do frame que gerou as detecções; opcoes.deslocamento: quanto o jogador já andou (px, com
// sinal) desde esse frame. Com isso a política trabalha com a posição de AGORA e não a de ~150 ms atrás.
export default function decide(deteccoes, opcoes = {}) {
  const o = { ...OPCOES, ...opcoes };
  const atraso = (o.atrasoMs || 0) / 1000;
  const teclas = {
    left: false, right: false, up: false, down: false, space: false,
  };
  const visto = melhor(deteccoes, 'player');
  if (!visto) return { teclas, motivo: 'sem jogador' };
  const jogador = { ...visto, cx: limitar(visto.cx + (o.deslocamento || 0), X_MIN, X_MAX) };

  // zumbis só descem: avança cada um pelo tempo que o frame demorou a chegar
  const vivos = deteccoes.filter((d) => d.cls === 'zombie').map((z) => ({ ...z, cy: z.cy + VEL_ZUMBI * atraso }));
  const tiros = deteccoes.filter((d) => d.cls === 'shot');
  const civis = deteccoes.filter((d) => d.cls === 'civilian').map((c) => ({ ...c, cy: c.cy + VEL_CIVIL * atraso }));

  // ameaças: zumbis que ainda vão alcançar o jogador (ou já estão sobrepostos na vertical)
  const faixas = unir(vivos
    .filter((z) => z.cy - jogador.cy < CORPO.jogador.y1 - CORPO.zumbi.y0 && jogador.cy - z.cy < o.horizonte)
    .map((z) => faixaPerigo(z, o.margem)));
  const faixaAtual = faixas.find((f) => jogador.cx > f[0] && jogador.cx < f[1]);
  const emPerigo = Boolean(faixaAtual);

  // trecho livre: entre a faixa mais próxima à esquerda e a mais próxima à direita
  const lo = Math.max(X_MIN, ...faixas.filter((f) => f[1] <= jogador.cx).map((f) => f[1]));
  const hi = Math.min(X_MAX, ...faixas.filter((f) => f[0] >= jogador.cx).map((f) => f[0]));

  // alvos acima do jogador, do mais baixo (mais perto de passar) para o mais alto
  const acima = vivos.filter((z) => z.cy < jogador.cy).sort((a, b) => b.cy - a.cy);
  // o jogador alcança o tiro certo (jogador.cx + TIRO_DX = zumbi.cx) sem sair do trecho livre?
  const alcancavel = (z) => z.cx - TIRO_DX >= lo && z.cx - TIRO_DX <= hi;
  const alvo = acima.find(alcancavel) || acima[0];

  // civil a resgatar: a mais baixa que ainda não passou do jogador e já está perto o bastante
  const civil = civis
    .filter((c) => c.cy < jogador.cy + 40 && jogador.cy - c.cy < o.distanciaResgate)
    .sort((a, b) => b.cy - a.cy)[0];
  const civilAlcancavel = civil && civil.cx >= lo && civil.cx <= hi;

  let destino = jogador.cx;
  let resgatando = false;
  if (emPerigo) {
    // sai pela borda mais próxima da faixa em que está (se a borda for parede, usa a outra)
    const esq = faixaAtual[0] - 1;
    const dir = faixaAtual[1] + 1;
    const esqOk = esq >= X_MIN;
    const dirOk = dir <= X_MAX;
    if (esqOk && (!dirOk || jogador.cx - esq <= dir - jogador.cx)) destino = esq;
    else if (dirOk) destino = dir;
    else destino = jogador.cx;
  } else if (civilAlcancavel) {
    destino = civil.cx;
    resgatando = true;
  } else if (alvo) {
    destino = limitar(alvo.cx - TIRO_DX, lo, hi);
  }

  const dx = destino - jogador.cx;
  // dentro da faixa de perigo não há tolerância: ficar parado a 3 px da saída ainda é levar o zumbi
  if (Math.abs(dx) > (emPerigo ? 0 : o.tolerancia)) teclas[dx < 0 ? 'left' : 'right'] = true;

  // tiro: alinhado com o alvo e sem tiro já a caminho na pista dele
  if (alvo && !emPerigo) {
    const erro = jogador.cx + TIRO_DX - alvo.cx;
    const jaTemTiro = tiros.some((t) => Math.abs(t.cx - alvo.cx) < o.larguraPista && t.cy < jogador.cy);
    // o tiro sobe em linha reta a partir de jogador.cx + TIRO_DX; a civil na frente do alvo seria atingida primeiro
    const civilNaLinha = civis.some((c) => c.cy < jogador.cy + 40 && c.cy > alvo.cy - 40
      && Math.abs(c.cx - (jogador.cx + TIRO_DX)) < CORPO_CIVIL + o.folgaCivil);
    if (Math.abs(erro) <= o.toleranciaTiro && !jaTemTiro && !civilNaLinha) teclas.space = true;
  }
  let motivo = 'mirando';
  if (emPerigo) motivo = 'fugindo';
  else if (resgatando) motivo = 'resgatando';
  else if (teclas.space) motivo = 'atirando';
  else if (!alvo) motivo = 'sem alvo';
  return {
    teclas, motivo, alvo, movimento: dx,
  };
}
