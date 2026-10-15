// Drive real interactions and screenshot the results.
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const exe = `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
const url = pathToFileURL(resolve('dist/index.html')).href
const out = process.argv[2] || '/tmp/ix'
const b = await chromium.launch({ executablePath: exe })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
const check = async (name, fn) => { try { await fn(); console.log('ok  ', name) } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]) } }

await p.goto(url); await p.waitForTimeout(800)
await check('slash menu opens on /', async () => {
  await p.locator('textarea').first().fill('/'); await p.waitForTimeout(300)
  await p.getByText('Branch this conversation').waitFor({ timeout: 2000 })
  await p.screenshot({ path: `${out}/slash.png` })
})
await check('slash filter + arrow + enter runs /terminal', async () => {
  await p.locator('textarea').first().fill('/term'); await p.waitForTimeout(200)
  await p.keyboard.press('Enter'); await p.waitForTimeout(500)
  await p.getByText('cargo test -p render korope').first().waitFor({ timeout: 2000 })
})
await check('@ mention lists files', async () => {
  await p.locator('textarea').first().fill('fix @kor'); await p.waitForTimeout(300)
  await p.getByText('src/scene/korope.rs').first().waitFor({ timeout: 2000 })
  await p.screenshot({ path: `${out}/mention.png` })
  await p.keyboard.press('Escape'); await p.locator('textarea').first().fill('')
})
await check('model picker opens and switches to Claude Opus', async () => {
  await p.getByRole('button', { name: /GPT-6 Astra/ }).last().click(); await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/model.png` })
  await p.getByText('Claude Opus').first().click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: /Claude Opus/ }).last().waitFor({ timeout: 2000 })
})
await check('effort popover', async () => {
  await p.getByRole('button', { name: /Medium/ }).last().click(); await p.waitForTimeout(300)
  await p.getByText('How hard it thinks').waitFor({ timeout: 2000 }); await p.screenshot({ path: `${out}/effort.png` })
  await p.getByText('Hard bugs, design').click()
})
await check('machine switcher in sidebar', async () => {
  await p.getByText('New sessions run on').click(); await p.waitForTimeout(400)
  await p.screenshot({ path: `${out}/machine-switch.png` })
  await p.getByText('gcp-home').last().click(); await p.waitForTimeout(300)
})
await check('Ctrl K palette filters', async () => {
  await p.keyboard.press('Control+k'); await p.waitForTimeout(400)
  await p.keyboard.type('stream'); await p.waitForTimeout(200)
  await p.screenshot({ path: `${out}/palette-filter.png` })
  await p.keyboard.press('Enter'); await p.waitForTimeout(500)
  await p.getByText('LIVE').first().waitFor({ timeout: 2000 })
  await p.screenshot({ path: `${out}/stream-on.png` })
})
await check('add machine 3-step flow', async () => {
  await p.getByRole('button', { name: 'Machines' }).first().click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Add machine/ }).first().click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Continue/ }).click(); await p.waitForTimeout(300)
  await p.screenshot({ path: `${out}/add-2.png` })
  await p.getByRole('button', { name: /Create machine/ }).click(); await p.waitForTimeout(2600)
  await p.screenshot({ path: `${out}/add-3.png` })
  await p.getByRole('button', { name: 'Done' }).click()
})
await check('theme switch to paper via settings', async () => {
  await p.keyboard.press('Control+Comma'); await p.waitForTimeout(300)
  await p.getByRole('button', { name: /Appearance/ }).click(); await p.waitForTimeout(300)
  await p.getByRole('button', { name: /Paper/ }).click(); await p.waitForTimeout(400)
  const t = await p.evaluate(() => document.documentElement.dataset.theme)
  if (t !== 'paper') throw new Error('theme=' + t)
  await p.screenshot({ path: `${out}/paper-settings.png` })
})
await check('canvas alt-arrow moves focus', async () => {
  await p.evaluate(() => (location.hash = ''))
  await p.goto(url + '#canvas'); await p.waitForTimeout(800)
  await p.keyboard.press('Alt+ArrowRight'); await p.keyboard.press('Alt+ArrowRight'); await p.waitForTimeout(900)
  await p.screenshot({ path: `${out}/canvas-moved.png` })
})
await check('Ctrl B hides sidebar', async () => {
  await p.goto(url); await p.waitForTimeout(500)
  await p.keyboard.press('Control+b'); await p.waitForTimeout(600)
  const w = await p.evaluate(() => document.querySelector('aside')?.getBoundingClientRect().width ?? 0)
  if (w > 10) throw new Error('sidebar width ' + w)
})
await b.close()
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors')
