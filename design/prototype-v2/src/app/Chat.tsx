import { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  PanelLeft, PanelRight, GitFork, Radio, MoreHorizontal, ListChecks, FileDiff, SquareTerminal, FolderTree, Globe, Gauge,
  Check, ChevronRight, FileCode2, Folder, RefreshCw, ExternalLink, Pencil, Archive, ArrowRightLeft, Share2, Columns2, Rows3, X,
} from 'lucide-react'
import { useApp, getMachine, type InspectorTab } from '@/lib/store'
import { plan, kindMeta } from '@/lib/data'
import { Transcript, SwarmStrip } from './Transcript'
import { Composer } from './Composer'
import { MachineList } from './Sidebar'
import { IconButton, Tip, Segmented, Popover, PopoverTrigger, PopoverContent, Menu, MenuTrigger, MenuContent, MenuItem, MenuSep, Button, Meter, Badge, StatusDot } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { Logo } from '@/components/logos'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

export function ChatView() {
  const s = useApp()
  const session = s.sessions.find((x) => x.id === s.sessionId)!
  const m = getMachine(session.machine)
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-seam px-3">
          <Tip label={s.sidebar ? 'Hide sidebar' : 'Show sidebar'} keys="Ctrl B">
            <IconButton onClick={() => s.set({ sidebar: !s.sidebar })}><PanelLeft size={16} /></IconButton>
          </Tip>
          <div className="mx-1 h-5 w-px bg-seam" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{session.title}</span>
              <StatusDot status={session.status} />
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-ash">
              <span>{session.project}</span><span className="text-seam-2">/</span><span>master</span>
              {session.agents && <><span className="text-seam-2">/</span><SwarmStrip /></>}
            </div>
          </div>
          <div className="flex-1" />

          {/* Where it runs */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-8 items-center gap-2 rounded-[9px] border border-seam bg-slab pl-1 pr-2.5 text-sec transition-colors hover:border-seam-2 hover:bg-slab-2">
                <MachineMark m={m} size={24} className="border-0" />
                <span className={cn('font-medium', kindMeta[m.kind].color)}>{m.name}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[310px]">
              <div className="px-2 pb-1.5 pt-1 text-sec text-dust">Move this session to another machine. Files sync first, then the agent continues there.</div>
              <MachineList value={session.machine} onPick={(id) => toast(`Moving to ${getMachine(id).name}`, { description: 'Syncing 3 changed files, then resuming.' })} />
            </PopoverContent>
          </Popover>

          <Segmented layoutId="layout-seg" value={s.layout} onChange={(v) => s.set({ layout: v })} size="md"
            items={[{ value: 'focus', label: 'Focus', icon: <Rows3 size={13} /> }, { value: 'canvas', label: 'Canvas', icon: <Columns2 size={13} /> }]} />

          <Tip label="Stream mode hides emails, keys and paths">
            <IconButton active={s.stream} onClick={() => { s.set({ stream: !s.stream }); toast(s.stream ? 'Stream mode off' : 'Stream mode on', { description: s.stream ? undefined : 'Emails, keys and file paths are blurred.' }) }}><Radio size={16} /></IconButton>
          </Tip>
          <Menu>
            <MenuTrigger asChild><IconButton><MoreHorizontal size={16} /></IconButton></MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={() => toast('Forked into a new session')}><GitFork size={15} />Fork session</MenuItem>
              <MenuItem><Pencil size={15} />Rename</MenuItem>
              <MenuItem><ArrowRightLeft size={15} />Move to machine</MenuItem>
              <MenuItem><Share2 size={15} />Share transcript</MenuItem>
              <MenuItem><ExternalLink size={15} />Pop out to its own window</MenuItem>
              <MenuSep />
              <MenuItem><Archive size={15} />Archive</MenuItem>
            </MenuContent>
          </Menu>
          <Tip label={s.inspector ? 'Hide inspector' : 'Show inspector'} keys="Ctrl I">
            <IconButton active={s.inspector} onClick={() => s.set({ inspector: !s.inspector })}><PanelRight size={16} /></IconButton>
          </Tip>
        </header>

        <Transcript />
        <Composer running={!s.runDone} onStop={() => toast('Stopped after the current step')} />
      </div>
      <Inspector />
    </div>
  )
}

/* -------------------------------- Inspector -------------------------------- */
const tabs: { id: InspectorTab; label: string; icon: typeof ListChecks; count?: number }[] = [
  { id: 'plan', label: 'Plan', icon: ListChecks },
  { id: 'changes', label: 'Changes', icon: FileDiff, count: 3 },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'preview', label: 'Preview', icon: Globe },
  { id: 'usage', label: 'Usage', icon: Gauge },
]

function Inspector() {
  const { inspector, inspectorTab, inspectorWidth, set } = useApp()
  const drag = useRef<{ x: number; w: number } | null>(null)
  return (
    <AnimatePresence initial={false}>
      {inspector && (
        <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: inspectorWidth, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 40 }}
          className="relative flex shrink-0 flex-col overflow-hidden border-l border-seam bg-soot">
          {/* resize handle */}
          <div
            onPointerDown={(e) => { drag.current = { x: e.clientX, w: inspectorWidth }; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
            onPointerMove={(e) => { if (drag.current) set({ inspectorWidth: Math.max(320, Math.min(640, drag.current.w - (e.clientX - drag.current.x))) }) }}
            onPointerUp={() => (drag.current = null)}
            className="group absolute bottom-0 left-0 top-0 z-10 w-1.5 cursor-col-resize">
            <span className="absolute inset-y-0 left-0 w-px bg-transparent transition-colors group-hover:bg-brass/60" />
          </div>
          <div className="flex h-[52px] shrink-0 items-center gap-0.5 border-b border-seam px-2" style={{ minWidth: inspectorWidth }}>
            {tabs.map((t) => {
              const active = inspectorTab === t.id
              return (
                <Tip key={t.id} label={t.label}>
                  <button onClick={() => set({ inspectorTab: t.id })}
                    className={cn('relative flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-sec transition-colors', active ? 'text-bone' : 'text-ash hover:text-dust')}>
                    {active && <motion.span layoutId="insp-tab" className="absolute inset-0 rounded-[8px] bg-slab-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <t.icon size={15} className="relative" />
                    {active && <span className="relative font-medium">{t.label}</span>}
                    {t.count && <span className="relative rounded-full bg-brass/15 px-1.5 text-[10.5px] font-semibold text-brass">{t.count}</span>}
                  </button>
                </Tip>
              )
            })}
            <div className="flex-1" />
            <IconButton size="sm" onClick={() => set({ inspector: false })}><X size={14} /></IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" style={{ minWidth: inspectorWidth }}>
            <AnimatePresence mode="wait">
              <motion.div key={inspectorTab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16 }} className="p-4">
                {inspectorTab === 'plan' && <PlanPane />}
                {inspectorTab === 'changes' && <ChangesPane />}
                {inspectorTab === 'terminal' && <TerminalPane />}
                {inspectorTab === 'files' && <FilesPane />}
                {inspectorTab === 'preview' && <PreviewPane />}
                {inspectorTab === 'usage' && <UsagePane />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function PaneTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-between"><h3 className="m-0 text-[13px] font-semibold">{children}</h3>{right}</div>
}

function PlanPane() {
  const done = plan.filter((p) => p.done).length
  return (
    <>
      <PaneTitle right={<span className="text-meta text-ash">{done} of {plan.length}</span>}>Plan</PaneTitle>
      <Meter value={done / plan.length} className="mb-4" />
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {plan.map((p, i) => {
          const live = !p.done && (i === 0 || plan[i - 1].done)
          return (
            <li key={i} className={cn('flex items-start gap-2.5 rounded-[9px] px-2 py-2', live && 'bg-brass/[0.07]')}>
              <span className={cn('mt-[1px] grid size-[18px] shrink-0 place-items-center rounded-full border',
                p.done ? 'border-sage/60 bg-sage/15 text-sage' : live ? 'breathe border-brass/70 text-brass' : 'border-seam-2 text-transparent')}>
                {p.done ? <Check size={11} strokeWidth={3} /> : live ? <span className="size-[6px] rounded-full bg-brass" /> : null}
              </span>
              <span className={cn('text-[13px] leading-snug', p.done ? 'text-ash line-through decoration-seam-2' : live ? 'text-bone' : 'text-dust')}>{p.text}</span>
            </li>
          )
        })}
      </ol>
      <h3 className="mb-2 mt-6 text-[13px] font-semibold">Running in the background</h3>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-[10px] border border-seam bg-slab px-3 py-2.5">
          <span className="size-3.5 animate-spin rounded-full border-2 border-seam-2 border-t-brass" />
          <span className="flex-1 font-mono text-[12px]">cargo build --release</span><span className="text-meta text-ash">42s</span>
        </div>
        <div className="flex items-center gap-3 rounded-[10px] border border-seam bg-slab px-3 py-2.5">
          <Check size={14} className="text-sage" /><span className="flex-1 font-mono text-[12px] text-dust">fetch reference assets</span><span className="text-meta text-ash">3m ago</span>
        </div>
      </div>
    </>
  )
}

function ChangesPane() {
  return (
    <>
      <PaneTitle right={<div className="flex gap-1.5"><Button size="xs" variant="ghost">Undo all</Button><Button size="xs" variant="primary">Commit</Button></div>}>3 changed files</PaneTitle>
      {['korope.rs', 'danfo_roof.rs', 'provenance.toml'].map((f, i) => (
        <div key={f} className={cn('flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px]', i === 0 && 'bg-slab-2')}>
          <FileCode2 size={14} className="text-dust" /><span className="font-mono">{f}</span>
          <span className="ml-auto font-mono text-[11.5px]"><span className="text-sage">+{[48, 21, 6][i]}</span> <span className="text-rose">−{[12, 9, 0][i]}</span></span>
        </div>
      ))}
      <div className="mt-3 overflow-hidden rounded-[12px] border border-seam bg-code font-mono text-[12px] leading-[1.7]">
        <div className="flex items-center justify-between border-b border-seam bg-slab px-3 py-1.5 font-sans text-meta text-ash"><span>src/scene/korope.rs</span><span>line 88</span></div>
        {[
          [' ', '88', 'fn korope_body() -> Mesh {'],
          ['-', '89', '    let roof = Roof::flat(1.42);'],
          ['+', '89', '    let roof = Roof::high(1.58)'],
          ['+', '90', '        .with_drip_rail();'],
          ['+', '91', '    let grille = Grille::da52();'],
          [' ', '92', '    Mesh::join([cab(), roof, grille])'],
          [' ', '93', '}'],
        ].map(([k, n, l], i) => (
          <div key={i} className={cn('flex', k === '+' && 'bg-sage/[0.09]', k === '-' && 'bg-rose/[0.09]')}>
            <span className="w-9 shrink-0 select-none pr-2 text-right text-ash/70">{n}</span>
            <span className={cn('w-4 shrink-0 select-none', k === '+' ? 'text-sage' : k === '-' ? 'text-rose' : 'text-ash')}>{k}</span>
            <span className={cn('whitespace-pre', k === ' ' ? 'text-dust' : 'text-bone')}>{l}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function TerminalPane() {
  return (
    <>
      <PaneTitle right={<span className="flex items-center gap-1.5 text-meta text-ash"><span className="size-1.5 rounded-full bg-sage" />libghostty</span>}>
        <span className="flex items-center gap-2">zsh <Badge>~/Desktop/tasued</Badge></span>
      </PaneTitle>
      <div className="min-h-[360px] rounded-[12px] border border-seam bg-code p-3.5 font-mono text-[12.5px] leading-[1.7] text-dust">
        <div><span className="text-brass">❯</span> <span className="text-bone">cargo test -p render korope</span></div>
        <div>   <span className="text-sage">Compiling</span> render v0.4.1</div>
        <div>    <span className="text-sage">Finished</span> test in 38.2s</div>
        <div>test geometry::no_stray_panels ... <span className="text-sage">ok</span></div>
        <div>test geometry::roof_joints ... <span className="text-sage">ok</span></div>
        <div className="mt-2"><span className="text-bone">test result:</span> <span className="text-sage">ok</span>. 14 passed</div>
        <div className="mt-2"><span className="text-brass">❯</span> <span className="caret" /></div>
      </div>
    </>
  )
}

function FilesPane() {
  const tree: [number, string, boolean, string?][] = [
    [0, 'src', true], [1, 'scene', true], [2, 'korope.rs', false, 'M'], [2, 'danfo_roof.rs', false, 'M'], [2, 'lighting.rs', false],
    [1, 'main.rs', false], [0, 'assets', true], [1, 'provenance.toml', false, 'A'], [0, 'reference', true], [0, 'Cargo.toml', false],
  ]
  return (
    <>
      <input placeholder="Filter files" className="mb-3 h-8 w-full rounded-[9px] border border-seam bg-slab px-3 text-sec outline-none placeholder:text-ash focus:border-seam-2" />
      {tree.map(([d, n, dir, st], i) => (
        <div key={i} className="flex h-7 items-center gap-1.5 rounded-[7px] pr-2 text-[13px] text-dust hover:bg-slab-2 hover:text-bone" style={{ paddingLeft: 6 + d * 16 }}>
          {dir ? <ChevronRight size={12} className="rotate-90 text-ash" /> : <span className="w-3" />}
          {dir ? <Folder size={14} className="text-brass/80" /> : <FileCode2 size={14} />}
          <span className={cn(st && 'text-bone')}>{n}</span>
          {st && <span className={cn('ml-auto text-[11px] font-semibold', st === 'M' ? 'text-ember' : 'text-sage')}>{st}</span>}
        </div>
      ))}
    </>
  )
}

function PreviewPane() {
  return (
    <>
      <div className="overflow-hidden rounded-[12px] border border-seam">
        <div className="flex items-center gap-2 border-b border-seam bg-slab px-2.5 py-1.5">
          <span className="flex gap-1">{['#ec8579', '#e0b46c', '#9cc49a'].map((c) => <span key={c} className="size-2 rounded-full" style={{ background: c }} />)}</span>
          <span className="flex h-6 flex-1 items-center gap-1.5 rounded-[6px] bg-ink px-2 font-mono text-[11px] text-ash">localhost:5173</span>
          <RefreshCw size={13} className="text-ash" />
        </div>
        <div className="relative grid h-[260px] place-items-center bg-[radial-gradient(80%_70%_at_50%_30%,#2b4466,#0d1520)]">
          <svg viewBox="0 0 200 110" className="w-[70%]">
            <rect x="30" y="30" width="140" height="56" rx="10" fill="#4b8bd0" />
            <rect x="40" y="22" width="110" height="18" rx="6" fill="#5a9be0" />
            <rect x="44" y="40" width="30" height="20" rx="3" fill="#cfe4fa" opacity=".8" /><rect x="80" y="40" width="30" height="20" rx="3" fill="#cfe4fa" opacity=".8" /><rect x="116" y="40" width="30" height="20" rx="3" fill="#cfe4fa" opacity=".8" />
            <circle cx="60" cy="88" r="11" fill="#111" /><circle cx="140" cy="88" r="11" fill="#111" />
          </svg>
          <span className="absolute bottom-3 left-3 rounded-[6px] bg-black/50 px-2 py-0.5 text-meta text-white">Korope viewer</span>
        </div>
      </div>
      <p className="mt-3 text-sec leading-relaxed text-ash">Also shows documents, PDFs, Mermaid diagrams and HTML the agent opens.</p>
    </>
  )
}

function UsagePane() {
  return (
    <>
      <PaneTitle>This session</PaneTitle>
      <UsageRow label="Context" value="124k of 200k" v={0.62} />
      <UsageRow label="Tokens" value="1.8M in, 96k out" v={0.4} tone="sky" />
      <h3 className="mb-3 mt-6 text-[13px] font-semibold">Subscription limits</h3>
      <div className="flex flex-col gap-3">
        <LimitRow logo="openai" name="ChatGPT Pro" sub="5-hour window, resets in 2h 14m" v={0.48} />
        <LimitRow logo="claude" name="Claude Max" sub="Weekly, resets Monday" v={0.71} tone="ember" />
        <LimitRow logo="openrouter" name="OpenRouter" sub="$18.40 of $50 credit" v={0.37} tone="sky" />
      </div>
      <Button size="sm" className="mt-5 w-full" onClick={() => toast('Compacting context', { description: 'Summarizing 6 earlier turns.' })}><RefreshCw size={13} />Compact context now</Button>
    </>
  )
}
function UsageRow({ label, value, v, tone }: { label: string; value: string; v: number; tone?: 'sky' }) {
  return <div className="mb-3"><div className="mb-1.5 flex justify-between text-sec"><span>{label}</span><span className="text-ash">{value}</span></div><Meter value={v} tone={tone} /></div>
}
function LimitRow({ logo, name, sub, v, tone }: { logo: 'openai' | 'claude' | 'openrouter'; name: string; sub: string; v: number; tone?: 'ember' | 'sky' }) {
  return (
    <div className="rounded-[12px] border border-seam bg-slab p-3">
      <div className="mb-2 flex items-center gap-2.5"><Logo name={logo} size={16} tinted /><span className="text-[13px] font-medium">{name}</span><span className="ml-auto text-sec text-dust">{Math.round(v * 100)}%</span></div>
      <Meter value={v} tone={tone} /><div className="mt-1.5 text-meta text-ash">{sub}</div>
    </div>
  )
}
