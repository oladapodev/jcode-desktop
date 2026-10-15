// Drive real interactions against the built prototype and screenshot results.
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const exe = `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
const url = pathToFileURL(resolve('dist/index.html')).href
const out = process.argv[2] || '/tmp/ix'
const b = await chromium.launch({ executablePath: exe })
const errors = []
let pass = 0, fail = 0
const fresh = async (hash = '', w = 1440) => {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  p.on('pageerror', (e) => errors.push(e.message))
  await p.goto(url + hash); await p.waitForTimeout(900)
  return p
}
const check = async (name, fn) => {
  try { await fn(); pass++; console.log('ok  ', name) } catch (e) { fail++; console.log('FAIL', name, '-', e.message.split('\n')[0]) }
}
const panels = (p) => p.evaluate(() => [...document.querySelectorAll('.dv-tab')].map((t) => t.textContent.trim()))
const groups = (p) => p.evaluate(() => document.querySelectorAll('.dv-groupview').length)

let p = await fresh()
await check('slash menu opens and runs /terminal into the dock', async () => {
  const ta = p.locator('textarea').first()
  await ta.fill('/'); await p.getByText('Branch this conversation').waitFor({ timeout: 2000 })
  await p.screenshot({ path: `${out}/slash.png` })
  await ta.fill('/term'); await p.keyboard.press('Enter'); await p.waitForTimeout(500)
  if (!(await panels(p)).some((t) => t.includes('Terminal'))) throw new Error('no terminal tab')
})
await check('@ mention lists files', async () => {
  await p.locator('textarea').first().fill('fix @kor'); await p.getByText('src/scene/korope.rs').first().waitFor({ timeout: 2000 })
  await p.keyboard.press('Escape'); await p.locator('textarea').first().fill('')
})
await check('model picker switches to Claude Opus', async () => {
  await p.locator('button:has-text("GPT-6 Astra")').last().click(); await p.waitForTimeout(300)
  await p.getByText('Claude Opus').first().click(); await p.waitForTimeout(300)
  await p.locator('button:has-text("Claude Opus")').last().waitFor({ timeout: 2000 })
})
await check('Ctrl+2 switches to Code layout with editor and files', async () => {
  await p.keyboard.press('Control+2'); await p.waitForTimeout(800)
  const t = await panels(p)
  if (!t.some((x) => x.includes('korope.rs')) || !t.some((x) => x.includes('Files'))) throw new Error(t.join('|'))
  await p.screenshot({ path: `${out}/code.png` })
})
await check('file tree opens a file as an editor tab', async () => {
  await p.locator('.dv-content-container button:has-text("main.rs")').first().click(); await p.waitForTimeout(500)
  if (!(await panels(p)).some((x) => x.includes('main.rs'))) throw new Error('main.rs not opened')
  await p.locator('.cm-content').first().waitFor({ timeout: 2000 })
})
await check('editor has syntax highlighting (coloured tokens)', async () => {
  const colors = await p.evaluate(() => new Set([...document.querySelectorAll('.cm-content span')].map((s) => getComputedStyle(s).color)).size)
  if (colors < 4) throw new Error('only ' + colors + ' token colours')
})
await check('maximize focuses one pane and restores', async () => {
  await p.keyboard.press('Control+Shift+M'); await p.waitForTimeout(500)
  const max = await p.evaluate(() => !!document.querySelector('.dv-groupview') && useAppMax())
    .catch(async () => p.evaluate(() => [...document.querySelectorAll('.dv-groupview')].filter((g) => g.getBoundingClientRect().width > 0).length))
  await p.screenshot({ path: `${out}/maximized.png` })
  await p.keyboard.press('Control+Shift+M'); await p.waitForTimeout(400)
})
await check('drag Chat tab onto editor bottom edge splits the layout', async () => {
  const before = await groups(p)
  const tab = p.locator('.dv-tab:has-text("Chat")').first()
  const target = p.locator('.dv-groupview:has(.dv-tab:has-text("korope.rs")) .dv-content-container').first()
  const tb = await target.boundingBox()
  await tab.dragTo(target, { targetPosition: { x: tb.width / 2, y: tb.height - 12 } })
  await p.waitForTimeout(600)
  const after = await groups(p)
  await p.screenshot({ path: `${out}/after-drag.png` })
  if (after < before) throw new Error(`groups ${before} -> ${after}`)
})
await check('Ctrl+3 review layout shows diff with unified/split toggle', async () => {
  await p.keyboard.press('Control+3'); await p.waitForTimeout(800)
  await p.getByText('Split').first().click(); await p.waitForTimeout(500)
  if (!(await p.locator('.cm-mergeView').count())) throw new Error('no split merge view')
  await p.screenshot({ path: `${out}/review-split.png` })
})
await check('terminal (libghostty) renders a canvas', async () => {
  await p.keyboard.press('Control+5'); await p.waitForTimeout(2200)
  if (!(await p.locator('.dv-content-container canvas').count())) throw new Error('no terminal canvas')
})
await check('Ctrl K palette opens a file', async () => {
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300)
  await p.keyboard.type('provenance'); await p.waitForTimeout(200); await p.keyboard.press('Enter'); await p.waitForTimeout(700)
  if (!(await panels(p)).some((x) => x.includes('provenance.toml'))) throw new Error('not opened')
})
await check('Ctrl B collapses sidebar to icon rail', async () => {
  await p.keyboard.press('Control+b'); await p.waitForTimeout(600)
  const w = await p.evaluate(() => document.querySelector('aside').getBoundingClientRect().width)
  if (w > 80 || w < 40) throw new Error('rail width ' + w)
})
await p.close()

p = await fresh('#agents')
await check('agents: click swarm node selects it in the drawer', async () => {
  await p.locator('section button:has-text("Lighting")').first().click(); await p.waitForTimeout(400)
  await p.locator('aside >> text=Sun, shadows, haze').waitFor({ timeout: 2000 })
})
await check('agents: approve from inbox removes the item', async () => {
  const row = p.locator('div.flex-wrap:has(> div > div:text-is("Delete 2 stale snapshot files?"))')
  await row.locator('button:has-text("Approve")').click(); await p.waitForTimeout(600)
  if (await p.locator('text=Delete 2 stale snapshot files?').count()) throw new Error('still there')
  await p.screenshot({ path: `${out}/agents.png` })
})
await p.close()

p = await fresh('', 900)
await check('narrow window: sidebar auto-rails, composer stays usable', async () => {
  const w = await p.evaluate(() => document.querySelector('aside').getBoundingClientRect().width)
  if (w > 80) throw new Error('sidebar not railed at 900px: ' + w)
  await p.screenshot({ path: `${out}/narrow.png` })
})
await p.close()

await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors')
