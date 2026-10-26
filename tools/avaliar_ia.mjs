// Mede o jogador de IA (?ia=1) em partidas reais no navegador: abates, tiros perdidos, inimigos que passaram, vidas
// e o que aconteceu com a civil (resgatada, morta por tiro do jogador, perdida para zumbi ou por sair da tela).
// Uso: node tools/avaliar_ia.mjs [--url http://localhost:8097] [--partidas 3] [--segundos 75]
// Usa a GPU (--use-angle=gl): com renderização por software (SwiftShader) a inferência passa de 1 s e a IA não joga.
import { chromium } from 'playwright-core'

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : p }
const URL = arg('url', 'http://localhost:8097')
const PARTIDAS = Number(arg('partidas', 3))
const SEGUNDOS = Number(arg('segundos', 75))
const CHROME = process.env.CHROME_PATH || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`

const resultados = []
for (let n = 1; n <= PARTIDAS; n++) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'],
  })
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } })
  await page.goto(`${URL}/?ia=1`, { waitUntil: 'load' })
  await page.waitForTimeout(4000)
  const c = await page.locator('canvas').first().boundingBox()
  await page.mouse.click(c.x + c.width / 2, c.y + c.height * 0.40)
  await page.keyboard.type('ia')
  await page.mouse.click(c.x + c.width / 2, c.y + c.height * 0.64)
  await page.waitForTimeout(1500)
  // conta os eventos do jogo envolvendo as funções do placar e da vida (chamadas pelo próprio jogo)
  await page.evaluate(() => {
    const cena = window.game.scene.getScene('gameScene')
    window.__m = { abates: 0, perdidos: 0, passaram: 0, danos: 0, resgates: 0, tirosNaCivil: 0, civisPerdidas: 0 }
    const envolver = (obj, nome, chave) => { const o = obj[nome].bind(obj); obj[nome] = (...a) => { window.__m[chave]++; return o(...a) } }
    envolver(cena.score, 'hitEnemy', 'abates'); envolver(cena.score, 'missedShot', 'perdidos')
    envolver(cena.score, 'enemyPass', 'passaram'); envolver(cena.life, 'playerDie', 'danos')
    envolver(cena.score, 'rescueCivilian', 'resgates'); envolver(cena.score, 'civilianHit', 'tirosNaCivil')
    envolver(cena.score, 'civilianLost', 'civisPerdidas')
  })
  const t0 = Date.now()
  let fim = null
  while (Date.now() - t0 < SEGUNDOS * 1000) {
    await page.waitForTimeout(2000)
    fim = await page.evaluate(() => { const s = window.game.scene.getScene('gameScene'); return { ...window.__m, pontos: s.score.score, ativa: s.sys.isActive() } })
    if (!fim.ativa) break
  }
  fim.segundos = Math.round((Date.now() - t0) / 1000)
  fim.precisao = fim.abates + fim.perdidos ? +(fim.abates / (fim.abates + fim.perdidos)).toFixed(2) : null
  resultados.push(fim)
  console.log(`partida ${n}:`, JSON.stringify(fim))
  await browser.close()
}
const soma = (k) => resultados.reduce((a, r) => a + r[k], 0)
console.log(`TOTAL ${resultados.length} partidas: abates ${soma('abates')}, tiros perdidos ${soma('perdidos')}, `
  + `passaram ${soma('passaram')}, vidas perdidas ${soma('danos')}, civis resgatadas ${soma('resgates')}, `
  + `tiros na civil ${soma('tirosNaCivil')}, civis perdidas ${soma('civisPerdidas')}, precisão ${(soma('abates') / (soma('abates') + soma('perdidos'))).toFixed(2)}`)
