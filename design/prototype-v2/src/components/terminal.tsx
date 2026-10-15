import { useEffect, useRef, useState } from 'react'
import { init, Terminal, FitAddon } from 'ghostty-web'
import { useApp } from '@/lib/store'

let ready: Promise<void> | null = null
const boot = () => (ready ??= init())

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
function themeFromCss() {
  return {
    background: css('--code') || '#0e0c0b', foreground: css('--bone'), cursor: css('--brass'), cursorAccent: css('--code'),
    selectionBackground: css('--seam-2'), black: css('--slab-2'), brightBlack: css('--ash'),
    red: css('--rose'), green: css('--sage'), yellow: css('--brass'), blue: css('--sky'), magenta: css('--lilac'), cyan: css('--sky'), white: css('--dust'),
    brightRed: css('--rose'), brightGreen: css('--sage'), brightYellow: css('--ember'), brightBlue: css('--sky'), brightMagenta: css('--lilac'), brightCyan: css('--sky'), brightWhite: css('--bone'),
  }
}

const E = '\x1b['
const c = { dim: `${E}2m`, r: `${E}0m`, g: `${E}32m`, y: `${E}33m`, b: `${E}34m`, m: `${E}35m`, cy: `${E}36m`, bold: `${E}1m`, red: `${E}31m` }
const PROMPT = `${c.y}❯${c.r} `
const script = [
  `${c.dim}~/Desktop/tasued${c.r} ${c.m}master${c.r} ${c.dim}via 🦀 1.89${c.r}\r\n`,
  `${PROMPT}cargo test -p render korope\r\n`,
  `   ${c.g}${c.bold}Compiling${c.r} render v0.4.1 (~/Desktop/tasued/render)\r\n`,
  `    ${c.g}${c.bold}Finished${c.r} \`test\` profile in 38.2s\r\n`,
  `     ${c.g}${c.bold}Running${c.r} tests/korope.rs\r\n\r\n`,
  `running 14 tests\r\n`,
  `test geometry::no_stray_panels ... ${c.g}ok${c.r}\r\n`,
  `test geometry::roof_joints ... ${c.g}ok${c.r}\r\n`,
  `test geometry::roof_height_matches_reference ... ${c.g}ok${c.r}\r\n`,
  `test paint::livery_is_faded ... ${c.g}ok${c.r}\r\n\r\n`,
  `test result: ${c.g}ok${c.r}. 14 passed; 0 failed; finished in 0.41s\r\n\r\n`,
  `${c.dim}~/Desktop/tasued${c.r} ${c.m}master${c.r} ${c.y}!3${c.r}\r\n`,
  PROMPT,
]

/** A real libghostty (WASM) terminal. Typing echoes locally; Enter runs a fake shell. */
export function GhosttyTerminal() {
  const host = useRef<HTMLDivElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const theme = useApp((s) => s.theme)
  useEffect(() => {
    let term: Terminal | null = null
    let disposed = false
    let ro: ResizeObserver | null = null
    const timers: number[] = []
    boot().then(() => {
      if (disposed || !host.current) return
      term = new Terminal({ fontSize: 13, fontFamily: 'JetBrains Mono Variable, JetBrains Mono, monospace', cursorBlink: true, cursorStyle: 'bar', theme: themeFromCss() })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(host.current)
      fit.fit()
      let last = `${host.current.clientWidth}x${host.current.clientHeight}`
      let t: number | undefined
      ro = new ResizeObserver(() => {
        const el = host.current; if (!el) return
        const now = `${el.clientWidth}x${el.clientHeight}`
        if (now === last || el.clientWidth < 40) return
        last = now
        clearTimeout(t); t = window.setTimeout(() => { try { fit.fit() } catch { /* hidden */ } }, 120)
      })
      ro.observe(host.current)
      script.forEach((l, i) => timers.push(window.setTimeout(() => term?.write(l), 350 + i * 110)))
      let line = ''
      term.onData((d: string) => {
        if (!term) return
        if (d === '\r') {
          const cmd = line.trim(); line = ''
          term.write('\r\n')
          if (cmd === 'clear') term.write(`${E}2J${E}H`)
          else if (cmd === 'ls') term.write(`${c.b}assets${c.r}  Cargo.toml  ${c.b}reference${c.r}  README.md  ${c.b}src${c.r}\r\n`)
          else if (cmd === 'git status') term.write(`On branch ${c.m}master${c.r}\r\nChanges not staged for commit:\r\n  ${c.red}modified:   src/scene/korope.rs${c.r}\r\n  ${c.red}modified:   src/scene/danfo_roof.rs${c.r}\r\n`)
          else if (cmd) term.write(`${c.dim}(prototype shell) ran: ${cmd}${c.r}\r\n`)
          term.write(PROMPT)
        } else if (d === '\x7f') { if (line) { line = line.slice(0, -1); term.write('\b \b') } }
        else if (d >= ' ') { line += d; term.write(d) }
      })
    }).catch((e) => setErr(String(e)))
    return () => { disposed = true; timers.forEach(clearTimeout); ro?.disconnect(); term?.dispose() }
  }, [theme])
  return (
    <div className="flex h-full min-h-0 flex-col bg-code">
      {err ? <div className="p-4 font-mono text-sec text-rose">Terminal failed to start: {err}</div> : <div ref={host} className="min-h-0 flex-1 px-3 pt-2" />}
    </div>
  )
}
