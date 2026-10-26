// Camada transparente por cima do canvas do jogo que mostra o que o detector está vendo e o que a IA decidiu.
const CORES = {
  zombie: '#ff4040', player: '#40a0ff', shot: '#ffe040', corpse: '#c040ff', civilian: '#40ff90',
};

export default function criarOverlay(canvasDoJogo) {
  const tela = document.createElement('canvas');
  tela.width = canvasDoJogo.width;
  tela.height = canvasDoJogo.height;
  Object.assign(tela.style, { position: 'absolute', pointerEvents: 'none', zIndex: 10 });
  document.body.appendChild(tela);
  const ctx = tela.getContext('2d');

  // o canvas do Phaser é redimensionado pelo CSS: acompanha posição e tamanho dele
  const alinhar = () => {
    const r = canvasDoJogo.getBoundingClientRect();
    Object.assign(tela.style, {
      left: `${r.left + window.scrollX}px`,
      top: `${r.top + window.scrollY}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  };
  alinhar();
  window.addEventListener('resize', alinhar);

  return {
    desenhar(deteccoes, status) {
      alinhar();
      ctx.clearRect(0, 0, tela.width, tela.height);
      ctx.font = '12px monospace';
      deteccoes.forEach((d) => {
        ctx.strokeStyle = CORES[d.cls] || '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.cx - d.w / 2, d.cy - d.h / 2, d.w, d.h);
        ctx.fillStyle = CORES[d.cls] || '#fff';
        ctx.fillText(`${d.cls} ${(d.score * 100).toFixed(0)}%`, d.cx - d.w / 2, d.cy - d.h / 2 - 3);
      });
      ctx.fillStyle = '#fff';
      ctx.fillText(status, 8, tela.height - 8);
    },
  };
}
