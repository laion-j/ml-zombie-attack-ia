// Coleta um dataset de detecção de objetos jogando o próprio jogo.
//
// Uso: node tools/coletar_dataset.mjs [--url http://localhost:8097] [--amostras 4000] [--a-cada 4] [--saida ml/dataset]
// Requer o jogo servindo na URL (npm start -- --port 8097) e um Chrome/Chromium (CHROME_PATH).
//
// Por que funciona sem rotular nada à mão: o jogo sabe onde cada objeto está. A cada N quadros lemos o estado das cenas
// do Phaser (jogador, zumbis, tiros), calculamos a caixa justa de cada sprite pelo alfa da imagem e gravamos
// frame + rótulo no formato YOLO ("classe cx cy w h", normalizados). Frame e rótulo vêm do MESMO instante de render.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`)
  return i > 0 ? process.argv[i + 1] : padrao
}
const URL = arg('url', 'http://localhost:8097')
const TOTAL = Number(arg('amostras', 4000))
const A_CADA = Number(arg('a-cada', 4))
const SAIDA = path.resolve(arg('saida', 'ml/dataset'))
const CHROME = process.env.CHROME_PATH || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
const CLASSES = ['zombie', 'player', 'shot', 'corpse', 'civilian']   // corpse = zumbi ou civil na animação de morte
const LADO = 640                                          // mesmo tamanho de entrada do YOLOv5n da aula

for (const sp of ['train', 'val']) {
  fs.mkdirSync(`${SAIDA}/images/${sp}`, { recursive: true })
  fs.mkdirSync(`${SAIDA}/labels/${sp}`, { recursive: true })
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 700, height: 700 } })
page.on('pageerror', (e) => console.log('erro na página:', e.message))

let gravadas = 0
const nVal = Math.round(TOTAL * 0.15)
await page.exposeFunction('gravar', (dataUrl, texto) => {
  // as últimas amostras (blocos contíguos) vão para validação: quadros vizinhos são quase iguais e não devem vazar
  const sp = gravadas >= TOTAL - nVal ? 'val' : 'train'
  const nome = String(gravadas).padStart(5, '0')
  fs.writeFileSync(`${SAIDA}/images/${sp}/${nome}.jpg`, Buffer.from(dataUrl.split(',')[1], 'base64'))
  fs.writeFileSync(`${SAIDA}/labels/${sp}/${nome}.txt`, texto)
  gravadas++
})

await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(3000)
const canvas = page.locator('canvas')
const caixa = await canvas.boundingBox()
await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height * 0.40)
await page.keyboard.type('ia')
await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height * 0.64)   // Play
await page.waitForTimeout(2500)

// gancho de coleta dentro da página: roda no fim de cada render do Phaser
await page.evaluate(({ A_CADA, LADO }) => {
  const jogo = window.game
  const cache = new Map()   // caixa justa (pelo alfa) por quadro de textura
  const caixaJusta = (sprite) => {
    const chave = `${sprite.texture.key}:${sprite.frame.name}`
    if (cache.has(chave)) return cache.get(chave)
    const f = sprite.frame
    const c = document.createElement('canvas'); c.width = f.cutWidth; c.height = f.cutHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight)
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (px[(y * c.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    }
    const r = x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
    cache.set(chave, r)
    return r
  }
  const reduzida = document.createElement('canvas'); reduzida.width = LADO; reduzida.height = LADO
  let quadro = 0
  window.__jogo = { estado: () => jogo.scene.getScenes(true).map((s) => s.sys.settings.key) }
  jogo.events.on('postrender', () => {
    const cena = jogo.scene.getScene('gameScene')
    if (!cena || !cena.sys.isActive() || !cena.player || !cena.zombies || !cena.zombies.children || !cena.shots.children || !cena.civilians.children) return
    if (++quadro % A_CADA) return
    if (cena.player.isDead || cena.player.alpha < 1) return   // jogador morrendo/renascendo: amostra descartada
    const W = jogo.config.width, H = jogo.config.height
    const linhas = []
    const rotular = (sprite, classe) => {
      const cj = caixaJusta(sprite); if (!cj) return
      const ox = sprite.x - sprite.frame.cutWidth * sprite.originX, oy = sprite.y - sprite.frame.cutHeight * sprite.originY
      let x0 = ox + cj.x0, y0 = oy + cj.y0, x1 = x0 + cj.w, y1 = y0 + cj.h
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1)
      if (x1 - x0 < 4 || y1 - y0 < 4) return                  // quase fora da tela: não rotula
      // se a caixa foi cortada pela borda por mais de ~40%, também descarta (o modelo não precisa aprender isso)
      if ((x1 - x0) < cj.w * 0.6 || (y1 - y0) < cj.h * 0.6) return
      linhas.push(`${classe} ${((x0 + x1) / 2 / W).toFixed(6)} ${((y0 + y1) / 2 / H).toFixed(6)} ${((x1 - x0) / W).toFixed(6)} ${((y1 - y0) / H).toFixed(6)}`)
    }
    rotular(cena.player, 1)
    cena.zombies.getChildren().forEach((z) => rotular(z, z.isDead ? 3 : 0))
    // civil: correndo = civilian; morrendo = corpse; resgatada (sumindo) não é rotulada
    cena.civilians.getChildren().forEach((c) => { if (c.state !== 'saved') rotular(c, c.state === 'dead' ? 3 : 4) })
    cena.shots.getChildren().forEach((t) => rotular(t, 2))
    // imagem esticada para LADO x LADO (sem letterbox), como o worker faz na inferência
    const ctx = reduzida.getContext('2d'); ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(jogo.canvas, 0, 0, W, H, 0, 0, LADO, LADO)
    window.gravar(reduzida.toDataURL('image/jpeg', 0.92), linhas.join('\n') + (linhas.length ? '\n' : ''))
  })
}, { A_CADA, LADO })

// bot só para gerar dados (não é a IA do projeto): 70% do tempo persegue o zumbi mais próximo e atira;
// no resto anda ao acaso. Assim aparecem tiros e zumbis morrendo (classe corpse) em quantidade.
const teclas = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
let seguradas = []
const t0 = Date.now()
while (gravadas < TOTAL && Date.now() - t0 < 25 * 60 * 1000) {
  for (const t of seguradas) await page.keyboard.up(t)
  const estado = await page.evaluate(() => {
    try {
      const c = window.game.scene.getScene('gameScene')
      const ativas = window.__jogo.estado()
      if (!c || !c.player || !c.zombies || !c.zombies.children || !c.civilians || !c.civilians.children) return { px: 0, alvo: null, civil: null, ativas }   // cena em transição
      const vivos = c.zombies.getChildren().filter((z) => !z.isDead && z.y < c.player.y)
      vivos.sort((a, b) => b.y - a.y)
      const civil = c.civilians.getChildren().find((k) => k.state === 'run' && k.y < c.player.y)
      return { px: c.player.x, alvo: vivos.length ? vivos[0].x : null, civil: civil ? civil.x : null, ativas }
    } catch (e) { return null }
  })
  if (estado && estado.ativas.includes('gameOverScene')) { await page.keyboard.press('Space'); continue }
  if (estado && estado.civil !== null && Math.random() < 0.5) {   // metade das vezes tenta resgatar a civil
    const dx = estado.civil - estado.px
    seguradas = Math.abs(dx) < 8 ? [] : [dx < 0 ? 'ArrowLeft' : 'ArrowRight']
  } else if (estado && estado.alvo !== null && Math.random() < 0.7) {
    const dx = estado.alvo - estado.px
    seguradas = Math.abs(dx) < 12 ? [] : [dx < 0 ? 'ArrowLeft' : 'ArrowRight']
  } else {
    seguradas = teclas.filter(() => Math.random() < 0.3)
  }
  for (const t of seguradas) await page.keyboard.down(t)
  const naPistaDaCivil = estado && estado.civil !== null && Math.abs(estado.civil - estado.px) < 45
  for (let i = 0; i < (naPistaDaCivil && Math.random() < 0.7 ? 0 : 3); i++) {   // no mais das vezes não atira nela
    // segura o espaço por ~100 ms: o Phaser lê o teclado a cada quadro e um press instantâneo pode passar batido
    await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space')
    await page.waitForTimeout(150 + Math.random() * 150)
  }
  if (gravadas % 500 < 5) process.stdout.write(`\r${gravadas}/${TOTAL} amostras`)
}
console.log(`\n${gravadas} amostras em ${SAIDA}`)
fs.writeFileSync(`${SAIDA}/data.yaml`, `path: ${SAIDA}\ntrain: images/train\nval: images/val\nnames:\n${CLASSES.map((c, i) => `  ${i}: ${c}`).join('\n')}\n`)
await browser.close()
