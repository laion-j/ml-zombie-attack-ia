// Web Worker do detector: recebe um frame do jogo, roda o YOLOv5n treinado neste jogo e devolve as caixas.
// Mesmo desenho do worker da aula (imagem -> tensor -> modelo -> caixas), com o modelo e as classes deste jogo.
import * as tf from '@tensorflow/tfjs';

const MODELO = 'model/model.json';
const CLASSES = ['zombie', 'player', 'shot', 'corpse', 'civilian'];
const LIMIAR = 0.35; // abaixo disso a detecção é ignorada
const LADO = 640; // entrada do modelo; o treino usou o frame esticado para 640x640, então a inferência faz igual

let modelo = null;

async function carregar() {
  await tf.ready();
  modelo = await tf.loadGraphModel(MODELO);
  // aquecimento: a primeira execução compila os shaders e é lenta
  const falso = tf.zeros([1, LADO, LADO, 3]);
  tf.dispose(await modelo.executeAsync(falso));
  tf.dispose(falso);
  postMessage({ type: 'pronto', backend: tf.getBackend() });
}

// ImageBitmap -> tensor [1, 640, 640, 3] com valores em [0, 1]. tf.tidy libera os tensores temporários.
const preparar = (imagem) => tf.tidy(() => tf.image
  .resizeBilinear(tf.browser.fromPixels(imagem), [LADO, LADO])
  .div(255)
  .expandDims(0));

async function detectar(imagem) {
  const entrada = preparar(imagem);
  const saida = await modelo.executeAsync(entrada); // o NMS já vem dentro do modelo exportado
  tf.dispose(entrada);
  const [caixas, pontuacoes, classes] = await Promise.all(saida.slice(0, 3).map((t) => t.data()));
  saida.forEach((t) => t.dispose());

  const { width, height } = imagem;
  const deteccoes = [];
  for (let i = 0; i < pontuacoes.length; i++) {
    if (pontuacoes[i] < LIMIAR) continue;
    // caixas normalizadas [x1, y1, x2, y2] -> pixels do frame original
    const x1 = caixas[i * 4] * width;
    const y1 = caixas[i * 4 + 1] * height;
    const x2 = caixas[i * 4 + 2] * width;
    const y2 = caixas[i * 4 + 3] * height;
    deteccoes.push({
      cls: CLASSES[classes[i]], cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: x2 - x1, h: y2 - y1, score: pontuacoes[i],
    });
  }
  return deteccoes;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'predict' || !modelo) return;
  const t0 = performance.now();
  const deteccoes = await detectar(data.image);
  data.image.close();
  postMessage({
    type: 'deteccoes', deteccoes, ms: performance.now() - t0, quadro: data.quadro,
  });
};

carregar();
