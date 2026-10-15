import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Brain, Globe, FileText, FilePen, SquareTerminal, Check, ChevronRight, Copy, GitFork, Undo2, RotateCcw,
  ThumbsUp, Network, ImageIcon, CircleHelp, Bot, ArrowDown, ArrowUpRight,
} from 'lucide-react'
import { run, type Step } from '@/lib/data'
import { files } from '@/lib/repo'
import { useApp, getModel } from '@/lib/store'
import { Logo } from '@/components/logos'
import { CodeBlock } from '@/components/code'
import { Button, Tip, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { openPane } from './Workspace'
import { toast } from 'sonner'

/* Playback of the scripted run. Typing is handled inside <Prose>, so only that
   one paragraph re-renders while text streams, not the whole transcript. */
function usePlayback(runKey: number) {
  const [progress, setProgress] = useState(0)
  useEffect(() => setProgress(0), [runKey])
  useEffect(() => {
    if (progress >= run.length) return
    const step = run[progress]
    if (step.kind === 'say') return // Prose advances us when it finishes typing
    const ms = 'ms' in step ? step.ms : 420
    const t = setTimeout(() => setProgress((p) => p + 1), ms)
    return () => clearTimeout(t)
  }, [progress])
  return { progress, next: () => setProgress((p) => p + 1), done: progress >= run.length - 1 }
}

const toolIcon = { search: Globe, read: FileText, edit: FilePen, bash: SquareTerminal, browser: Globe, agent: Bot }

/* Stick to bottom only while the user is already near the bottom. */
function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  useEffect(() => {
    const el = ref.current!
    const on = () => setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    if (el && atBottom) el.scrollTop = el.scrollHeight
  })
  return { ref, atBottom, jump: () => ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }), dep }
}

export function Transcript() {
  const runKey = useApp((s) => s.runKey)
  const model = useApp((s) => s.model)
  const { progress, next, done } = usePlayback(runKey)
  useEffect(() => { useApp.getState().set({ runDone: done }) }, [done])
  const { ref, atBottom, jump } = useStickToBottom(progress)
  const m = getModel(model)
  const visible = run.slice(0, Math.min(progress + 1, run.length))
  const threadSteps = visible.filter((s) => s.kind === 'think' || s.kind === 'tool')
  const elapsed = Math.round(run.slice(0, progress).reduce((a, s) => a + ('ms' in s ? s.ms : 400), 0) / 1000)

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} className="h-full overflow-y-auto [overflow-anchor:none]">
        <div className="mx-auto flex max-w-[700px] flex-col gap-8 px-6 pb-8 pt-6 @container">
          <button className="-mb-3 self-center rounded-full px-3 py-1 text-meta text-ash transition-colors hover:bg-slab-2 hover:text-dust">6 earlier turns, 1 hour ago</button>

          <UserMsg>
            Search for the exact bus models that are used and see if there's something online you can use as a starting point. For the danfo I saw one, but the korope is the actual vehicle model. This is very good, it looks almost like the real deal, it just needs tiny details and polish.
          </UserMsg>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 text-sec">
              <span className="grid size-6 place-items-center rounded-full bg-slab-2"><Logo name={m.provider} size={13} tinted /></span>
              <span className="font-medium text-bone">{m.name}</span>
              <span className="text-ash">{done ? `worked for ${elapsed}s` : <span className="shimmer-text">working, {elapsed}s</span>}</span>
            </div>

            <RunThread steps={threadSteps} active={progress} />

            {visible.map((s, i) => {
              if (s.kind === 'images') return <RefImages key={i} />
              if (s.kind === 'say') return <Prose key={`${runKey}-${i}`} text={s.text} streaming={i === progress} onDone={next} />
              if (s.kind === 'diff') return <ChangeSummary key={i} />
              if (s.kind === 'ask') return <AskCard key={i} step={s} />
              return null
            })}

            {done && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="-ml-1.5 flex items-center gap-0.5 text-ash">
                <Tip label="Copy"><IconButton size="sm"><Copy size={14} /></IconButton></Tip>
                <Tip label="Fork from here"><IconButton size="sm"><GitFork size={14} /></IconButton></Tip>
                <Tip label="Rewind to here"><IconButton size="sm"><Undo2 size={14} /></IconButton></Tip>
                <Tip label="Replay this run"><IconButton size="sm" onClick={() => useApp.getState().set({ runKey: runKey + 1 })}><RotateCcw size={14} /></IconButton></Tip>
                <Tip label="Good response"><IconButton size="sm"><ThumbsUp size={14} /></IconButton></Tip>
                <span className="ml-2 text-meta">1.8k tokens, 14s</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {!atBottom && (
          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} onClick={jump}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-bone px-3 py-1.5 text-meta font-medium text-ink shadow-[0_8px_24px_-6px_rgb(0_0_0/.5)]">
            <ArrowDown size={12} />Latest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

const UserMsg = memo(function UserMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-slab-2 px-4 py-2.5 text-prose leading-[1.6] text-bone">{children}</div>
    </div>
  )
})

/* ------------------------------ Run thread ------------------------------ */
const RunThread = memo(function RunThread({ steps, active }: { steps: Step[]; active: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const indices = run.map((s, i) => (s.kind === 'think' || s.kind === 'tool' ? i : -1)).filter((i) => i >= 0)
  const finished = indices.every((i) => i < active)
  useEffect(() => { if (finished) { const t = setTimeout(() => setCollapsed(true), 900); return () => clearTimeout(t) } setCollapsed(false) }, [finished])

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} className="group -ml-1 flex items-center gap-2 self-start rounded-[8px] px-1 py-0.5 text-sec text-ash hover:text-dust">
        <span className="flex -space-x-1">{[Globe, FileText, FilePen, SquareTerminal].map((I, i) => <span key={i} className="grid size-5 place-items-center rounded-full bg-slab-2 ring-2 ring-soot"><I size={10} /></span>)}</span>
        Searched, read 6 photos, edited 2 files, ran tests <span className="text-sage">14 passed</span>
        <ChevronRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    )
  }
  return (
    <div className="relative -ml-1">
      <div className="absolute bottom-3 left-[13px] top-3 w-px bg-seam" />
      <AnimatePresence initial={false}>
        {steps.map((s, k) => {
          const idx = indices[k]
          const isLive = idx === active
          const Icon = s.kind === 'think' ? Brain : toolIcon[(s as Extract<Step, { kind: 'tool' }>).tool]
          const open = openIdx === k
          const hasBody = s.kind === 'think' || (s.kind === 'tool' && !!s.body)
          return (
            <motion.div key={k} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <button onClick={() => hasBody && setOpenIdx(open ? null : k)}
                className={cn('group relative flex w-full items-center gap-3 rounded-[8px] py-1 pr-2 text-left', hasBody && 'hover:bg-slab-2/60')}>
                <span className={cn('relative z-10 grid size-[27px] shrink-0 place-items-center rounded-full transition-colors duration-300',
                  isLive ? 'bg-brass/15 text-brass' : 'bg-soot text-ash')}>
                  {isLive && <span className="breathe absolute inset-[7px] rounded-full" />}
                  {!isLive && s.kind === 'tool' && s.ok ? <Check size={13} className="text-sage" /> : <Icon size={13} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {s.kind === 'think' ? <span className={isLive ? 'shimmer-text' : 'text-dust'}>{isLive ? 'Thinking' : 'Thought for 2s'}</span>
                    : s.kind === 'tool' ? <><span className={isLive ? 'shimmer-text' : 'text-dust'}>{s.title}</span> <span className="font-mono text-[12px] text-ash">{s.arg}</span></> : null}
                </span>
                {s.kind === 'tool' && !isLive && <span className={cn('text-meta', s.ok ? 'text-sage' : 'text-ash', s.result.startsWith('+') && 'font-mono text-[11.5px]')}>{s.result}</span>}
                {hasBody && <ChevronRight size={13} className={cn('text-ash opacity-0 transition-[opacity,transform] group-hover:opacity-100', open && 'rotate-90 opacity-100')} />}
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="mb-2 ml-[39px] mt-1 overflow-hidden rounded-[12px] bg-code">
                      {s.kind === 'think' ? <p className="m-0 px-3.5 py-3 text-[13px] leading-relaxed text-dust">{s.text}</p>
                        : <CodeBlock code={(s as Extract<Step, { kind: 'tool' }>).body!} lang={(s as Extract<Step, { kind: 'tool' }>).tool === 'edit' ? 'rust' : 'txt'} />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
})

/* ------------------------------- Pieces ------------------------------- */
function Prose({ text, streaming, onDone }: { text: string; streaming: boolean; onDone: () => void }) {
  const [n, setN] = useState(streaming ? 0 : text.length)
  useEffect(() => {
    if (!streaming) return
    let i = 0, raf = 0, last = 0
    const tick = (t: number) => {
      if (t - last > 16) { i = Math.min(text.length, i + 3); setN(i); last = t }
      if (i < text.length) raf = requestAnimationFrame(tick); else setTimeout(onDone, 250)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [streaming])
  const shown = text.slice(0, n)
  const parts = shown.split(/(\*\*[^*]+\*\*)/g)
  const live = streaming && n < text.length
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-[64ch] text-prose leading-[1.72] text-bone">
        {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
        {live && <span className="caret" />}
      </p>
      {!live && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          <Snippet path="src/scene/danfo_roof.rs" />
        </motion.div>
      )}
    </div>
  )
}

function Snippet({ path }: { path: string }) {
  const dock = useApp((s) => s.dock)
  const f = files[path]
  return (
    <div className="group overflow-hidden rounded-[14px] bg-code">
      <div className="flex items-center gap-2 px-4 pt-2.5 text-meta text-ash">
        <span className="font-mono">{path}</span>
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Tip label="Copy"><IconButton size="sm" onClick={() => toast('Copied')}><Copy size={13} /></IconButton></Tip>
          <Tip label="Open in editor"><IconButton size="sm" onClick={() => dock && openPane(dock, 'editor', { path, direction: 'right' })}><ArrowUpRight size={13} /></IconButton></Tip>
        </span>
      </div>
      <CodeBlock code={f.text.trimEnd()} lang={f.lang} />
    </div>
  )
}

function RefImages() {
  const imgs = [{ label: 'Front', hue: '205 62% 48%', note: 'DA52 grille' }, { label: 'Side', hue: '208 55% 54%', note: 'High roof' }, { label: 'Rear', hue: '212 48% 44%', note: 'Drip rail' }]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-2">
      {imgs.map((im, i) => (
        <motion.button key={im.label} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}
          className="group relative aspect-[4/3] overflow-hidden rounded-[14px] text-left"
          style={{ background: `radial-gradient(120% 90% at 30% 20%, hsl(${im.hue} / .95), hsl(${im.hue} / .45) 55%, #0b1520)` }}>
          <svg viewBox="0 0 120 90" className="absolute inset-0 h-full w-full opacity-60 transition-transform duration-500 group-hover:scale-[1.04]">
            <rect x="22" y="30" width="76" height="36" rx="6" fill="#fff" opacity=".12" /><rect x="28" y="36" width="20" height="12" rx="2" fill="#fff" opacity=".25" /><rect x="52" y="36" width="20" height="12" rx="2" fill="#fff" opacity=".25" />
            <circle cx="40" cy="68" r="7" fill="#0b0f14" opacity=".7" /><circle cx="82" cy="68" r="7" fill="#0b0f14" opacity=".7" />
          </svg>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6 text-[11.5px] text-white">
            <span className="flex items-center gap-1"><ImageIcon size={11} />{im.label}</span><span className="opacity-70">{im.note}</span>
          </span>
        </motion.button>
      ))}
    </motion.div>
  )
}

function ChangeSummary() {
  const dock = useApp((s) => s.dock)
  const rows = [{ p: 'src/scene/korope.rs', a: 48, r: 12 }, { p: 'src/scene/danfo_roof.rs', a: 21, r: 9 }, { p: 'assets/provenance.toml', a: 6, r: 0 }]
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-[16px] bg-slab-2/70 p-1.5">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="text-[13px] font-medium">3 files changed</span>
        <span className="font-mono text-[12px] text-sage">+75</span><span className="font-mono text-[12px] text-rose">−21</span>
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant="ghost" onClick={() => dock && openPane(dock, 'changes', { direction: 'right' })}>Review</Button>
          <Button size="xs" variant="ghost">Undo</Button>
          <Button size="xs" variant="primary">Keep</Button>
        </div>
      </div>
      {rows.map((f) => (
        <button key={f.p} onClick={() => dock && openPane(dock, 'editor', { path: f.p, direction: 'right' })}
          className="group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-1.5 text-left hover:bg-soot">
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-dust group-hover:text-bone"><span className="text-ash">{f.p.split('/').slice(0, -1).join('/')}/</span>{f.p.split('/').pop()}</span>
          <span className="font-mono text-[11.5px]"><span className="text-sage">+{f.a}</span> <span className="text-rose">−{f.r}</span></span>
          <ArrowUpRight size={13} className="text-ash opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
    </motion.div>
  )
}

function AskCard({ step }: { step: Extract<Step, { kind: 'ask' }> }) {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-[16px] bg-ember/[0.08] p-4">
      <div className="mb-1.5 flex items-center gap-2 text-sec font-medium text-ember"><CircleHelp size={14} />Needs your answer</div>
      <p className="m-0 mb-3.5 text-[14.5px] leading-relaxed text-bone">{step.text}</p>
      <div className="flex flex-wrap gap-2">
        {step.options.map((o, i) => (
          <Button key={o} size="sm" variant={pick === i ? 'primary' : 'secondary'} onClick={() => setPick(i)}>{pick === i && <Check size={13} />}{o}</Button>
        ))}
        <Button size="sm" variant="ghost">Something else</Button>
      </div>
    </motion.div>
  )
}

export function SwarmStrip() {
  const agents = [{ n: 'Geometry', s: 'done' }, { n: 'Textures', s: 'running' }, { n: 'Lighting', s: 'running' }, { n: 'References', s: 'done' }, { n: 'Tests', s: 'waiting' }, { n: 'Review', s: 'idle' }] as const
  return (
    <button onClick={() => useApp.getState().go('agents')} className="flex items-center gap-1.5 rounded-[6px] text-meta text-ash hover:text-dust">
      <Network size={12} />
      <span className="flex -space-x-[3px]">
        {agents.map((a) => <span key={a.n} className={cn('size-[9px] rounded-full ring-2 ring-ink', a.s === 'done' ? 'bg-sage' : a.s === 'running' ? 'bg-brass' : a.s === 'waiting' ? 'bg-ember' : 'bg-seam-2')} />)}
      </span>
      6 agents
    </button>
  )
}
