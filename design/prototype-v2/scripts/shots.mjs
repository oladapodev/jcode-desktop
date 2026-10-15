// Screenshot every screen of the prototype and collect console errors.
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const exe = process.env.CHROME || `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
const url = pathToFileURL(resolve('dist/index.html')).href
const out = process.argv[2] || '/tmp/shots'
const shots = [
  ['chat-live', '', 3200],
  ['chat-done', '', 17000],
  ['code', '#code', 2500],
  ['review', '#review', 2200],
  ['browser', '#browser', 2200],
  ['terminal', '#terminal', 3200],
  ['home', '#home', 1200],
  ['agents', '#agents', 1600],
  ['machines', '#machines', 1500],
  ['palette', '#palette', 1200],
  ['settings-appearance', '#settings/appearance', 1200],
  ['code-paper', '#code', 2500, 'paper'],
  ['chat-paper', '', 17000, 'paper'],
  ['agents-paper', '#agents', 1600, 'paper'],
  ['rail', '#rail', 2500],
]
const only = process.env.ONLY?.split(',')
const browser = await chromium.launch({ executablePath: exe })
const errors = []
for (const [name, hash, wait, theme] of shots) {
  if (only && !only.includes(name)) continue
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`))
  await page.goto(url + (theme ? `?theme=${theme}` : '') + hash)
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/${name}.png` })
  await page.close()
}
await browser.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
