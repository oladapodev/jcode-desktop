import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Brain, Globe, FileText, FilePen, SquareTerminal, Check, ChevronRight, Copy, GitFork, Undo2, RotateCcw,
  ThumbsUp, FileDiff, ArrowUpRight, Network, ImageIcon, CircleHelp, Bot,
} from 'lucide-react'
import { run, type Step } from '@/lib/data'
import { useApp, getModel } from '@/lib/store'
import { Logo } from '@/components/logos'
import { Button, Tip, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'

/* Plays the scripted run step by step. `progress` = index of the step currently active. */
function usePlayback(runKey: number) {
  const [progress, setProgress] = useState(0)
  const [typed, setTyped] = useState(0)
  useEffect(() => { setProgress(0); setTyped(0) }, [runKey])
  useEffect(() => {
    if (progress >= run.length) return
    const step = run[progress]
    if (step.kind === 'say') {
      if (typed < step.text.length) {
        const t = setTimeout(() => setTyped((n) => Math.min(step.text.length, n + 3 + Math.floor(Math.random() * 4))), 18)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => { setProgress((p) => p + 1); setTyped(0) }, 300)
      return () => clearTimeout(t)
    }
    const ms = 'ms' in step ? step.ms : 500
    const t = setTimeout(() => setProgress((p) => p + 1), ms)
    return () => clearTimeout(t)
  }, [progress, typed])
  return { progress, typed, done: progress >= run.length - 1 }
}

const toolIcon = { search: Globe, read: FileText, edit: FilePen, bash: SquareTerminal, browser: Globe, agent: Bot }

export function Transcript() {
  const { runKey, model, openInspector } = useApp()
  const { progress, typed, done } = usePlayback(runKey)
  useEffect(() => { useApp.getState().set({ runDone: done }) }, [done])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' }) }, [progress, typed])
  const m = getModel(model)
  const visible = run.slice(0, Math.min(progress + 1, run.length))
  const threadSteps = visible.filter((s) => s.kind === 'think' || s.kind === 'tool')
  const elapsed = Math.round(run.slice(0, progress).reduce((a, s) => a + ('ms' in s ? s.ms : 400), 0) / 1000)

  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[720px] flex-col gap-7 px-8 pb-10 pt-8">
        {/* Earlier turn, collapsed into a quiet summary */}
        <EarlierTurns />

        <UserMsg>
          Search for the exact bus models that are used and see if there's something online you can use as a starting point. For the danfo I saw one, but the korope is the actual vehicle model. This is very good, it looks almost like the real deal, it just needs tiny details and polish.
        </UserMsg>

        {/* Agent turn */}
        <div className="flex gap-3.5">
          <div className="flex flex-col items-center pt-0.5">
            <span className="grid size-7 place-items-center rounded-[9px] border border-seam-2 bg-slab-2">
              <Logo name={m.provider} size={15} tinted />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-sec">
              <span className="font-medium text-bone">{m.name}</span>
              <span className="text-ash">{done ? `worked for ${elapsed}s` : <span className="shimmer-text">working {elapsed}s</span>}</span>
            </div>

            {/* The run thread (signature element) */}
            <RunThread steps={threadSteps} active={progress} />

            <div className="mt-4 flex flex-col gap-4">
              {visible.map((s, i) => {
                if (s.kind === 'images') return <RefImages key={i} />
                if (s.kind === 'say') return <Prose key={i} text={i === progress ? s.text.slice(0, typed) : s.text} streaming={i === progress} />
                if (s.kind === 'diff') return <DiffCard key={i} onOpen={() => openInspector('changes')} />
                if (s.kind === 'ask') return <AskCard key={i} step={s} />
                return null
              })}
            </div>

            {done && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-3 flex items-center gap-0.5 text-ash">
                <Tip label="Copy"><IconButton size="sm"><Copy size={14} /></IconButton></Tip>
                <Tip label="Fork from here"><IconButton size="sm"><GitFork size={14} /></IconButton></Tip>
                <Tip label="Rewind to here"><IconButton size="sm"><Undo2 size={14} /></IconButton></Tip>
                <Tip label="Replay this run"><IconButton size="sm" onClick={() => useApp.getState().set({ runKey: runKey + 1 })}><RotateCcw size={14} /></IconButton></Tip>
                <Tip label="Good response"><IconButton size="sm"><ThumbsUp size={14} /></IconButton></Tip>
                <span className="ml-2 text-meta">1.8k tokens in 14s, 62% of context used</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EarlierTurns() {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(!open)} className="group -mb-2 flex items-center gap-3 self-start text-sec text-ash hover:text-dust">
      <span className="flex -space-x-1">
        {[0, 1, 2].map((i) => <span key={i} className="size-[18px] rounded-full border-2 border-ink bg-slab-2" />)}
      </span>
      {open ? 'Hide' : 'Show'} 6 earlier turns
      <span className="text-ash/70">from 1 hour ago</span>
    </button>
  )
}

function UserMsg({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="max-w-[86%] rounded-[18px] rounded-br-[6px] border border-seam bg-slab-2 px-4 py-2.5 text-prose leading-[1.6] text-bone shadow-[0_1px_0_rgb(255_255_255/.03)_inset]">
        {children}
      </div>
    </motion.div>
  )
}

/* ------------------------------ Run thread ------------------------------ */
function RunThread({ steps, active }: { steps: Step[]; active: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  // index in `run` for each thread step
  const indices = run.map((s, i) => (s.kind === 'think' || s.kind === 'tool' ? i : -1)).filter((i) => i >= 0)
  const total = indices.length
  const doneCount = indices.filter((i) => i < active).length
  return (
    <div className="relative rounded-[14px] border border-seam bg-soot/60 py-1.5">
      {/* rail */}
      <div className="absolute bottom-4 left-[23px] top-4 w-[2px] rounded-full bg-seam" />
      <motion.div className="absolute left-[23px] top-4 w-[2px] rounded-full bg-gradient-to-b from-brass to-brass/40"
        animate={{ height: `calc(${(doneCount / Math.max(1, total)) * 100}% - ${doneCount === total ? 32 : 16}px)` }}
        transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
      <AnimatePresence initial={false}>
        {steps.map((s, k) => {
          const idx = indices[k]
          const isLive = idx === active
          const Icon = s.kind === 'think' ? Brain : toolIcon[(s as Extract<Step, { kind: 'tool' }>).tool]
          const open = openIdx === k
          const hasBody = s.kind === 'think' || (s.kind === 'tool' && !!s.body)
          return (
            <motion.div key={k} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <button onClick={() => hasBody && setOpenIdx(open ? null : k)}
                className={cn('group relative flex w-full items-center gap-3 px-3 py-[7px] text-left', hasBody && 'hover:bg-slab/70')}>
                <span className={cn('relative z-10 grid size-[24px] shrink-0 place-items-center rounded-full border transition-colors duration-300',
                  isLive ? 'breathe border-brass/70 bg-brass/15 text-brass' : 'border-seam-2 bg-slab-2 text-dust')}>
                  {!isLive && idx < active ? (s.kind === 'tool' && s.ok ? <Check size={12} className="text-sage" /> : <Icon size={12} />) : <Icon size={12} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {s.kind === 'think' ? (
                    <span className={isLive ? 'shimmer-text' : 'text-dust'}>{isLive ? 'Thinking' : 'Thought for 2s'}</span>
                  ) : s.kind === 'tool' ? (
                    <>
                      <span className={isLive ? 'shimmer-text' : 'text-bone'}>{s.title}</span>{' '}
                      <span className="font-mono text-[12px] text-ash">{s.arg}</span>
                    </>
                  ) : null}
                </span>
                {s.kind === 'tool' && !isLive && (
                  <span className={cn('text-meta', s.ok ? 'text-sage' : s.result.startsWith('+') ? 'font-mono text-[11.5px] text-dust' : 'text-ash')}>{s.result}</span>
                )}
                {hasBody && (
                  <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-ash opacity-0 transition-opacity group-hover:opacity-100"><ChevronRight size={13} /></motion.span>
                )}
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mb-2 ml-[48px] mr-3 rounded-[10px] border border-seam bg-code px-3 py-2.5">
                      {s.kind === 'think' ? (
                        <p className="m-0 text-[13px] italic leading-relaxed text-dust">{s.text}</p>
                      ) : (
                        <pre className="m-0 whitespace-pre-wrap font-mono text-[12px] leading-[1.65] text-dust">
                          {(s as Extract<Step, { kind: 'tool' }>).body!.split('\n').map((l, j) => (
                            <div key={j} className={cn(l.startsWith('+') && 'text-sage', l.startsWith('-') && 'text-rose', l.includes(' ok') && 'text-sage')}>{l}</div>
                          ))}
                        </pre>
                      )}
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
}

/* ------------------------------- Pieces ------------------------------- */
function Prose({ text, streaming }: { text: string; streaming?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className="m-0 max-w-[64ch] text-prose leading-[1.7] text-bone/95">
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold text-bone">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
      {streaming && <span className="caret" />}
    </p>
  )
}

function RefImages() {
  const imgs = [
    { label: 'Front', hue: '205 62% 48%', note: 'DA52 grille' },
    { label: 'Side', hue: '208 55% 54%', note: 'High roof' },
    { label: 'Rear', hue: '212 48% 44%', note: 'Drip rail' },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-2">
      {imgs.map((im, i) => (
        <motion.button key={im.label} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
          className="group relative aspect-[4/3] overflow-hidden rounded-[12px] border border-seam text-left"
          style={{ background: `radial-gradient(120% 90% at 30% 20%, hsl(${im.hue} / .95), hsl(${im.hue} / .45) 55%, #0b1520)` }}>
          <svg viewBox="0 0 120 90" className="absolute inset-0 h-full w-full opacity-60 transition-transform duration-500 group-hover:scale-[1.04]">
            <rect x="22" y="30" width="76" height="36" rx="6" fill="#fff" opacity=".12" />
            <rect x="28" y="36" width="20" height="12" rx="2" fill="#fff" opacity=".25" />
            <rect x="52" y="36" width="20" height="12" rx="2" fill="#fff" opacity=".25" />
            <circle cx="40" cy="68" r="7" fill="#0b0f14" opacity=".7" /><circle cx="82" cy="68" r="7" fill="#0b0f14" opacity=".7" />
          </svg>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-[11.5px] text-white">
            <span className="flex items-center gap-1"><ImageIcon size={11} />{im.label}</span><span className="opacity-70">{im.note}</span>
          </span>
        </motion.button>
      ))}
    </motion.div>
  )
}

function DiffCard({ onOpen }: { onOpen: () => void }) {
  const files = [
    { path: 'src/scene/korope.rs', a: 48, r: 12 },
    { path: 'src/scene/danfo_roof.rs', a: 21, r: 9 },
    { path: 'assets/provenance.toml', a: 6, r: 0 },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[14px] border border-seam bg-slab">
      <div className="flex items-center gap-2 border-b border-seam px-3.5 py-2.5">
        <FileDiff size={14} className="text-dust" />
        <span className="text-[13px] font-medium">3 files changed</span>
        <span className="font-mono text-[12px] text-sage">+75</span><span className="font-mono text-[12px] text-rose">−21</span>
        <div className="ml-auto flex gap-1.5">
          <Button size="xs" variant="ghost" onClick={onOpen}>Review</Button>
          <Button size="xs" variant="secondary">Undo all</Button>
          <Button size="xs" variant="primary">Keep</Button>
        </div>
      </div>
      {files.map((f) => (
        <button key={f.path} onClick={onOpen} className="group flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-slab-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-dust group-hover:text-bone">
            <span className="text-ash">{f.path.split('/').slice(0, -1).join('/')}/</span>{f.path.split('/').pop()}
          </span>
          <DiffBar a={f.a} r={f.r} />
          <span className="w-16 text-right font-mono text-[11.5px]"><span className="text-sage">+{f.a}</span> <span className="text-rose">−{f.r}</span></span>
          <ArrowUpRight size={13} className="text-ash opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
    </motion.div>
  )
}
function DiffBar({ a, r }: { a: number; r: number }) {
  const total = a + r, n = 5
  const g = Math.round((a / total) * n)
  return <span className="flex gap-[2px]">{Array.from({ length: n }).map((_, i) => <span key={i} className={cn('size-[7px] rounded-[2px]', i < g ? 'bg-sage/80' : 'bg-rose/70')} />)}</span>
}

function AskCard({ step }: { step: Extract<Step, { kind: 'ask' }> }) {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="rounded-[14px] border border-ember/30 bg-ember/[0.06] p-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-ember"><CircleHelp size={14} /> Needs your answer</div>
      <p className="m-0 mb-3 text-[14px] leading-relaxed text-bone">{step.text}</p>
      <div className="flex flex-wrap gap-2">
        {step.options.map((o, i) => (
          <Button key={o} size="sm" variant={pick === i ? 'primary' : 'secondary'} onClick={() => setPick(i)}>
            {pick === i && <Check size={13} />}{o}
          </Button>
        ))}
        <Button size="sm" variant="ghost">Something else…</Button>
      </div>
    </motion.div>
  )
}

export function SwarmStrip() {
  const agents = [
    { n: 'Geometry', s: 'done' }, { n: 'Textures', s: 'running' }, { n: 'Lighting', s: 'running' },
    { n: 'References', s: 'done' }, { n: 'Tests', s: 'waiting' }, { n: 'Review', s: 'idle' },
  ] as const
  return (
    <div className="flex items-center gap-2 text-meta text-ash">
      <Network size={13} />
      <span className="flex -space-x-1">
        {agents.map((a) => (
          <Tip key={a.n} label={`${a.n} agent`}>
            <span className={cn('size-[16px] rounded-full border-2 border-ink',
              a.s === 'done' ? 'bg-sage' : a.s === 'running' ? 'bg-brass' : a.s === 'waiting' ? 'bg-ember' : 'bg-seam-2')} />
          </Tip>
        ))}
      </span>
      6 agents
    </div>
  )
}
