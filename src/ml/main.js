// Liga a IA ao jogo: a cada ~100 ms copia o frame, manda para o worker (detecção), passa as caixas para a política
// (agent.js) e transforma a decisão em teclas. Ativado com ?ia=1 na URL.
import decide, { VEL_JOGADOR } from './agent';
import criarOverlay from './overlay';

const CODIGOS = {
  left: 37, up: 38, right: 39, down: 40, space: 32,
};
const NOMES = {
  left: 'ArrowLeft', up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', space: 'Space',
};
const INTERVALO_MS = 100;
const RECARGA_TIRO_MS = 350;
const MAX_PULSO_MS = 250; // quanto tempo uma tecla de direção fica apertada sem nova decisão

// O Phaser escuta keydown/keyup na janela: emitimos os mesmos eventos que o teclado real emitiria
const emitir = (tipo, tecla) => window.dispatchEvent(new KeyboardEvent(tipo, {
  key: tecla === 'space' ? ' ' : NOMES[tecla], code: NOMES[tecla], keyCode: CODIGOS[tecla], which: CODIGOS[tecla], bubbles: true,
}));

export default function iniciarIA(jogo) {
  const worker = new Worker(new URL('./worker.js', import.meta.url));
  const overlay = criarOverlay(jogo.canvas);
  const apertadas = new Set();
  let pronto = false;
  let ocupado = false;
  let ultimoQuadro = 0;
  let ultimoTiro = 0;
  let ms = 0;
  // histórico do movimento horizontal que NÓS pedimos: [{ t, dir }], dir = -1 (esq.), 0 ou 1 (dir.)
  const historico = [{ t: performance.now(), dir: 0 }];
  let soltar = null;

  const dirAtual = () => (apertadas.has('left') ? -1 : 0) + (apertadas.has('right') ? 1 : 0);
  // quantos px o jogador já andou desde o instante t0 (o frame que gerou a decisão), pelas teclas que apertamos
  const deslocamentoDesde = (t0) => {
    const agora = performance.now();
    let total = 0;
    historico.forEach((h, i) => {
      const fim = i + 1 < historico.length ? historico[i + 1].t : agora;
      const ini = Math.max(h.t, t0);
      if (fim > ini) total += h.dir * VEL_JOGADOR * ((fim - ini) / 1000);
    });
    while (historico.length > 30) historico.shift();
    return total;
  };

  const aplicar = ({ left, right, up, down }) => {
    Object.entries({ left, right, up, down }).forEach(([tecla, quer]) => {
      if (quer && !apertadas.has(tecla)) { apertadas.add(tecla); emitir('keydown', tecla); }
      if (!quer && apertadas.has(tecla)) { apertadas.delete(tecla); emitir('keyup', tecla); }
    });
    const dir = dirAtual();
    if (historico[historico.length - 1].dir !== dir) historico.push({ t: performance.now(), dir });
  };
  const atirar = () => {
    const agora = performance.now();
    if (agora - ultimoTiro < RECARGA_TIRO_MS) return;
    ultimoTiro = agora;
    emitir('keydown', 'space');
    setTimeout(() => emitir('keyup', 'space'), 60);
  };

  worker.onmessage = ({ data }) => {
    if (data.type === 'pronto') { pronto = true; overlay.desenhar([], `IA pronta (${data.backend})`); return; }
    ocupado = false;
    ms = data.ms;
    const cena = jogo.scene.getScene('gameScene');
    if (!cena || !cena.sys.isActive()) { aplicar({}); overlay.desenhar([], 'IA: aguardando partida'); return; }
    const atrasoMs = performance.now() - data.quadro;
    const { teclas, motivo, movimento } = decide(data.deteccoes, {
      atrasoMs, deslocamento: deslocamentoDesde(data.quadro),
    });
    window.__ia = { teclas, motivo, deteccoes: data.deteccoes, ms: data.ms, em: performance.now() }; // para depuração
    aplicar(teclas);
    // anda só o necessário: solta a tecla quando o trajeto restante (a velocidade fixa) acabar
    clearTimeout(soltar);
    if (teclas.left || teclas.right) {
      const duracao = Math.min(MAX_PULSO_MS, Math.max(30, (Math.abs(movimento) / VEL_JOGADOR) * 1000));
      soltar = setTimeout(() => aplicar({ ...teclas, left: false, right: false }), duracao);
    }
    if (teclas.space) atirar();
    overlay.desenhar(data.deteccoes, `IA: ${motivo} | inferência ${ms.toFixed(0)} ms`);
  };

  // captura o frame no fim de cada render (é quando o canvas WebGL ainda tem o desenho)
  jogo.events.on('postrender', () => {
    const agora = performance.now();
    if (!pronto || ocupado || agora - ultimoQuadro < INTERVALO_MS) return;
    ocupado = true;
    ultimoQuadro = agora;
    createImageBitmap(jogo.canvas).then((imagem) => worker.postMessage({ type: 'predict', image: imagem, quadro: agora }, [imagem]));
  });
  return worker;
}
