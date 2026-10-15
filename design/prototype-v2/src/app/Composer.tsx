import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Icons from 'lucide-react'
import { Plus, ArrowUp, Square, Mic, Check, ChevronDown, Zap, ListChecks, MessageSquare, Image as ImageIcon, Paperclip, FolderClosed, Globe, AtSign, Sparkles, X, Gauge } from 'lucide-react'
import { useApp, getModel, getMachine } from '@/lib/store'
import { models, slashCommands, kindMeta } from '@/lib/data'
import { Logo } from '@/components/logos'
import { Popover, PopoverTrigger, PopoverContent, Row, Kbd, Tip, Hr } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'
import type { PaneKind } from '@/lib/store'

const pane = (k: PaneKind) => {
  const d = useApp.getState().dock
  useApp.getState().set({ view: 'workspace' })
  if (d) import('./Workspace').then((w) => w.openPane(d, k, { direction: 'right' }))
}

const modes = {
  agent: { label: 'Agent', icon: Zap, desc: 'Edits files and runs commands' },
  plan: { label: 'Plan', icon: ListChecks, desc: 'Proposes a plan, waits for your OK' },
  ask: { label: 'Ask', icon: MessageSquare, desc: 'Answers only, changes nothing' },
} as const
const efforts = [
  { id: 'low', label: 'Low', desc: 'Quick edits', bars: 1 },
  { id: 'medium', label: 'Medium', desc: 'Most tasks', bars: 2 },
  { id: 'high', label: 'High', desc: 'Hard bugs, design', bars: 3 },
  { id: 'max', label: 'Max', desc: 'Slow, most thorough', bars: 4 },
] as const

export function Composer({ variant = 'dock', running = true, onStop }: { variant?: 'dock' | 'hero'; running?: boolean; onStop?: () => void }) {
  const { model, effort, mode, set, machine, go } = useApp()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [recording, setRecording] = useState(false)
  const [sel, setSel] = useState(0)
  const ta = useRef<HTMLTextAreaElement>(null)
  const m = getModel(model)
  const mc = getMachine(machine)
  const ModeIcon = modes[mode].icon

  const trigger = text.match(/(^|\s)([/@])(\w*)$/)
  const flat = useMemo(() => {
    if (!trigger) return []
    const q = trigger[3].toLowerCase()
    if (trigger[2] === '/') return slashCommands.flatMap((g) => g.items.filter((i) => i.cmd.startsWith(q) || i.desc.toLowerCase().includes(q)).map((i) => ({ ...i, group: g.group })))
    return ['src/scene/korope.rs', 'src/scene/danfo_roof.rs', 'src/main.rs', 'assets/provenance.toml', 'reference/transport-korope/', 'Cargo.toml']
      .filter((f) => f.toLowerCase().includes(q)).map((f) => ({ cmd: f, desc: '', icon: f.endsWith('/') ? 'Folder' : 'FileCode2', group: 'Files' }))
  }, [trigger?.[0]])
  useEffect(() => setSel(0), [flat.length])

  useEffect(() => {
    const el = ta.current; if (!el) return
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])

  const pick = (cmd: string) => {
    if (trigger?.[2] === '@') { setText(text.replace(/@\w*$/, `@${cmd} `)); return }
    setText('')
    const map: Record<string, () => void> = {
      settings: () => go('settings', 'general'), login: () => go('settings', 'models'), machines: () => go('machines'),
      swarm: () => go('agents'), terminal: () => pane('terminal'), diff: () => pane('changes'),
      usage: () => pane('usage'), plan: () => set({ mode: 'plan' }),
      fork: () => toast('Forked into a new session', { description: 'The original keeps running.' }),
    }
    if (map[cmd]) map[cmd]()
    else setText(`/${cmd} `)
    ta.current?.focus()
  }
  const send = () => {
    if (!text.trim() && !attachments.length) return
    toast(running ? 'Queued for the next step' : 'Sent', { description: text.slice(0, 80) || `${attachments.length} attachment(s)` })
    setText(''); setAttachments([])
  }

  const hero = variant === 'hero'
  return (
    <div className={cn('relative', hero ? 'w-full' : 'mx-auto w-full max-w-[740px] px-4 pb-3')}>
      {/* Slash / mention menu */}
      <AnimatePresence>
        {flat.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            className={cn('absolute bottom-full z-40 mb-2 max-h-[340px] overflow-y-auto rounded-[14px] border border-seam-2 bg-soot p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/.6)]', hero ? 'inset-x-0' : 'inset-x-6')}>
            {flat.map((it, i) => {
              const Ic = (Icons as unknown as Record<string, Icons.LucideIcon>)[it.icon] ?? Sparkles
              const header = i === 0 || flat[i - 1].group !== it.group
              return (
                <div key={it.cmd}>
                  {header && <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-ash">{it.group}</div>}
                  <button onMouseDown={(e) => { e.preventDefault(); pick(it.cmd) }} onMouseEnter={() => setSel(i)}
                    className={cn('flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left', sel === i && 'bg-slab-2')}>
                    <span className={cn('grid size-7 place-items-center rounded-[8px] border border-seam bg-slab', sel === i ? 'text-brass' : 'text-dust')}><Ic size={14} /></span>
                    <span className={cn('text-ui', trigger?.[2] === '@' ? 'font-mono text-[12.5px]' : 'font-medium')}>{trigger?.[2] === '/' && '/'}{it.cmd}</span>
                    <span className="truncate text-sec text-ash">{it.desc}</span>
                    {sel === i && <Kbd className="ml-auto">↵</Kbd>}
                  </button>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        'group/c relative rounded-[20px] bg-slab-2 transition-[box-shadow] duration-200',
        'shadow-[0_1px_2px_rgb(0_0_0/.12),0_12px_32px_-14px_rgb(0_0_0/.45)] ring-1 ring-seam',
        'focus-within:ring-brass/40 focus-within:shadow-[0_0_0_4px_rgb(var(--glow)/.08),0_12px_32px_-14px_rgb(0_0_0/.45)]',
      )}>
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-2 px-3 pt-3">
                {attachments.map((a, i) => (
                  <motion.span key={a + i} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="group/a flex items-center gap-2 rounded-[10px] border border-seam-2 bg-slab-2 py-1 pl-1 pr-2 text-sec">
                    <span className="size-7 rounded-[7px] bg-[linear-gradient(135deg,#3f78b5,#a9cdee)]" />
                    <span>{a}</span><span className="text-ash">240 KB</span>
                    <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="text-ash hover:text-bone"><X size={13} /></button>
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {recording ? (
            <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-[56px] items-center gap-3 px-4">
              <span className="size-2 rounded-full bg-rose breathe" />
              <Waveform />
              <span className="ml-auto text-sec text-dust">Listening. Release to send.</span>
            </motion.div>
          ) : (
            <motion.textarea key="ta" ref={ta} value={text} onChange={(e) => setText(e.target.value)} rows={hero ? 2 : 1}
              placeholder={hero ? 'Describe a task, paste an error, or drop a screenshot' : running ? 'Steer the agent, or queue a follow-up' : 'Reply'}
              onKeyDown={(e) => {
                if (flat.length) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % flat.length); return }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + flat.length) % flat.length); return }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(flat[sel].cmd); return }
                  if (e.key === 'Escape') { setText(text.replace(/[/@]\w*$/, '')); return }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              className={cn('block w-full resize-none bg-transparent px-4 text-prose leading-[1.55] text-bone outline-none placeholder:text-ash', hero ? 'min-h-[76px] pt-4' : 'min-h-[52px] pt-[15px]')} />
          )}
        </AnimatePresence>

        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <Popover>
            <Tip label="Attach"><PopoverTrigger asChild>
              <button className="grid size-8 place-items-center rounded-full text-dust transition-colors hover:bg-lift hover:text-bone"><Plus size={17} /></button>
            </PopoverTrigger></Tip>
            <PopoverContent side="top" className="w-[250px]">
              <Row icon={<ImageIcon size={15} />} title="Screenshot or image" right={<span className="flex gap-0.5"><Kbd>Ctrl</Kbd><Kbd>V</Kbd></span>} onClick={() => setAttachments([...attachments, 'korope-ref.png'])} />
              <Row icon={<Paperclip size={15} />} title="File" right={<Kbd>@</Kbd>} onClick={() => { setText(text + '@'); ta.current?.focus() }} />
              <Row icon={<FolderClosed size={15} />} title="Folder" />
              <Row icon={<Globe size={15} />} title="Web page" />
              <Hr className="my-1" />
              <Row icon={<Sparkles size={15} />} title="Use a skill" hint="compose, frontend-design, 100 more" />
            </PopoverContent>
          </Popover>

          {/* Mode */}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn('flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sec font-medium transition-colors hover:bg-lift',
                mode === 'agent' ? 'text-dust hover:text-bone' : 'bg-brass/12 text-brass hover:bg-brass/16')}>
                <ModeIcon size={14} /><span className="hidden @[400px]:inline">{modes[mode].label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-[280px]">
              {(Object.keys(modes) as (keyof typeof modes)[]).map((k) => {
                const M = modes[k]
                return <Row key={k} icon={<M.icon size={15} />} title={M.label} hint={M.desc} active={mode === k} onClick={() => set({ mode: k })}
                  right={mode === k ? <Check size={15} className="text-brass" /> : undefined} />
              })}
              <div className="px-2 pb-1 pt-2 text-meta text-ash">Switch with <Kbd>Shift</Kbd> <Kbd>Tab</Kbd></div>
            </PopoverContent>
          </Popover>

          {/* Model */}
          <ModelPicker trigger={
            <button className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sec font-medium text-dust transition-colors hover:bg-lift hover:text-bone">
              <Logo name={m.provider} size={14} tinted /><span className="hidden whitespace-nowrap @[460px]:inline">{m.name}</span><ChevronDown size={13} className="text-ash" />
            </button>} />

          {/* Effort */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sec font-medium text-dust transition-colors hover:bg-lift hover:text-bone">
                <EffortBars n={efforts.find((e) => e.id === effort)!.bars} /><span className="hidden @[520px]:inline">{efforts.find((e) => e.id === effort)!.label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-[240px]">
              <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-ash">How hard it thinks</div>
              {efforts.map((e) => (
                <Row key={e.id} icon={<EffortBars n={e.bars} />} title={e.label} hint={e.desc} active={effort === e.id} onClick={() => set({ effort: e.id })}
                  right={effort === e.id ? <Check size={15} className="text-brass" /> : undefined} />
              ))}
            </PopoverContent>
          </Popover>

          <div className="flex-1" />
          {!hero && <ContextRing value={0.62} />}
          <Tip label="Hold to talk" keys="Ctrl Shift V">
            <button onMouseDown={() => setRecording(true)} onMouseUp={() => { setRecording(false); toast('Voice sent to the agent', { description: '"Make the roof a bit taller"' }) }} onMouseLeave={() => recording && setRecording(false)}
              className={cn('grid size-8 place-items-center rounded-full transition-colors', recording ? 'bg-rose/15 text-rose' : 'text-dust hover:bg-lift hover:text-bone')}>
              <Mic size={16} />
            </button>
          </Tip>
          <AnimatePresence mode="popLayout" initial={false}>
            {running && !text ? (
              <motion.button key="stop" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                onClick={onStop} className="grid size-8 place-items-center rounded-full bg-bone text-ink transition-transform hover:scale-105" title="Stop">
                <Square size={11} fill="currentColor" />
              </motion.button>
            ) : (
              <motion.button key="send" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                onClick={send} disabled={!text.trim() && !attachments.length}
                className="grid size-8 place-items-center rounded-full bg-brass text-brass-ink shadow-[inset_0_1px_0_rgb(255_255_255/.3)] transition-[transform,opacity] hover:scale-105 disabled:opacity-35 disabled:hover:scale-100">
                <ArrowUp size={16} strokeWidth={2.4} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!hero && (
        <div className="mt-1.5 hidden items-center justify-between px-2 text-meta text-ash @[520px]:flex">
          <button onClick={() => go('machines')} className="flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 hover:text-dust">
            <MachineMark m={mc} size={16} className="rounded-[5px] border-0 bg-transparent" />
            Running on <span className={cn('font-medium', kindMeta[mc.kind].color)}>{mc.name}</span>
            <span data-secret className="font-mono text-[11px]">~/Desktop/tasued</span>
          </button>
          <span className="flex items-center gap-1"><AtSign size={11} /> files <span className="mx-1 text-seam-2">|</span> / commands</span>
        </div>
      )}
    </div>
  )
}

export function ModelPicker({ trigger }: { trigger: React.ReactNode }) {
  const { model, set, go } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => {
    const f = models.filter((m) => (m.name + m.via).toLowerCase().includes(q.toLowerCase()))
    const by: Record<string, typeof models> = {}
    f.forEach((m) => { (by[m.via] ||= []).push(m) })
    return Object.entries(by)
  }, [q])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="top" className="w-[340px] p-0">
        <div className="flex items-center gap-2 border-b border-seam px-3 py-2.5">
          <Icons.Search size={14} className="text-ash" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models" className="flex-1 bg-transparent text-ui outline-none placeholder:text-ash" />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {groups.map(([via, list]) => (
            <div key={via}>
              <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-medium text-ash">{via}</div>
              {list.map((m) => (
                <Row key={m.id} active={m.id === model} onClick={() => { set({ model: m.id }); setOpen(false) }}
                  icon={<span className="grid size-7 place-items-center rounded-[8px] border border-seam bg-slab-2"><Logo name={m.provider} size={14} tinted /></span>}
                  title={<span className="flex items-center gap-2">{m.name}{m.note && <span className="text-[11px] text-ash">{m.note}</span>}</span>}
                  hint={<span className="flex items-center gap-3"><Pips label="Speed" n={m.speed} /><Pips label="Smarts" n={m.smarts} /><span>{m.ctx} context</span></span>}
                  right={m.id === model ? <Check size={15} className="text-brass" /> : undefined} />
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-seam p-1.5">
          <Row icon={<Icons.KeyRound size={15} />} title="Connect another provider" tone="muted" onClick={() => { setOpen(false); go('settings', 'models') }} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Pips({ n, label }: { n: number; label: string }) {
  return <span className="flex items-center gap-1">{label}<span className="flex gap-[2px]">{[1, 2, 3].map((i) => <span key={i} className={cn('h-[6px] w-[3px] rounded-[1px]', i <= n ? 'bg-dust' : 'bg-seam-2')} />)}</span></span>
}
export function EffortBars({ n }: { n: number }) {
  return <span className="flex h-[12px] items-end gap-[2px]">{[1, 2, 3, 4].map((i) => <span key={i} className={cn('w-[3px] rounded-[1px]', i <= n ? 'bg-current' : 'bg-seam-2')} style={{ height: 3 + i * 2.2 }} />)}</span>
}
function ContextRing({ value }: { value: number }) {
  const r = 7, c = 2 * Math.PI * r
  return (
    <Tip label={`${Math.round(value * 100)}% of context used. Compacts automatically at 90%.`}>
      <button onClick={() => pane('usage')} className="mr-0.5 hidden h-8 items-center gap-1.5 rounded-full px-2 text-meta text-ash hover:bg-lift hover:text-dust @[560px]:flex">
        <svg width="16" height="16" viewBox="0 0 18 18" className="-rotate-90"><circle cx="9" cy="9" r={r} fill="none" stroke="var(--seam-2)" strokeWidth="2.4" />
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--dust)" strokeWidth="2.4" strokeDasharray={`${c * value} ${c}`} /></svg>
        {Math.round(value * 100)}%
      </button>
    </Tip>
  )
}
function Waveform() {
  return (
    <span className="flex h-6 items-center gap-[3px]">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-rose/80"
          animate={{ height: [4, 6 + Math.abs(Math.sin(i * 1.7)) * 16, 4] }}
          transition={{ duration: 0.7 + (i % 5) * 0.08, repeat: Infinity, ease: 'easeInOut', delay: i * 0.03 }} />
      ))}
    </span>
  )
}
export { Gauge }
