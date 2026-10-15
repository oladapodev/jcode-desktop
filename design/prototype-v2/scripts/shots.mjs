// Screenshot every screen of the prototype and collect console errors.
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const exe = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
const url = pathToFileURL(resolve('dist/index.html')).href
const out = process.argv[2] || '/tmp/shots'
const shots = [
  ['chat-early', '', 2500],
  ['chat-done', '', 16000],
  ['home', '#home', 1200],
  ['inspector-changes', '#inspector/changes', 16000],
  ['inspector-usage', '#inspector/usage', 2000],
  ['machines', '#machines', 1500],
  ['add-machine', '#add-machine', 1200],
  ['agents', '#agents', 1600],
  ['apps', '#apps', 1200],
  ['canvas', '#canvas', 1500],
  ['palette', '#palette', 1200],
  ['settings-appearance', '#settings/appearance', 1200],
  ['settings-models', '#settings/models', 1200],
  ['settings-account', '#settings/account', 1200],
  ['settings-stream', '#settings/stream', 1200],
  ['theme-paper', '#theme/paper', 2500],
  ['theme-midnight', '#theme/midnight', 2500],
]
const only = process.env.ONLY?.split(',')
const browser = await chromium.launch({ executablePath: exe })
const errors = []
for (const [name, hash, wait] of shots) {
  if (only && !only.includes(name)) continue
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`))
  await page.goto(url + hash)
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/${name}.png` })
  await page.close()
}
await browser.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
