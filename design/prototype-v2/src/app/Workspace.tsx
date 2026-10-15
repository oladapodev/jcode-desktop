import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type IDockviewPanelHeaderProps, type IDockviewHeaderActionsProps, type DockviewApi,
} from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import {
  MessagesSquare, FileCode2, FolderTree, SquareTerminal, Globe, FileDiff, ListChecks, Gauge, X, Maximize2, Minimize2, Plus,
  ChevronRight, Folder, FolderOpen, RefreshCw, ArrowLeft, ArrowRight, Lock, Columns2, Rows3, Check, Search, PanelLeft,
  GitFork, Radio, MoreHorizontal, Pencil, ArrowRightLeft, Share2, ExternalLink, Archive, Smartphone, Monitor, Tablet,
} from 'lucide-react'
import { useApp, getMachine, type PaneKind, type Preset } from '@/lib/store'
import { plan, kindMeta } from '@/lib/data'
import { files, tree, type TreeNode } from '@/lib/repo'
import { CodeEditor, DiffEditor, SplitDiff } from '@/components/code'
import { GhosttyTerminal } from '@/components/terminal'
import { Transcript, SwarmStrip } from './Transcript'
import { Composer } from './Composer'
import { MachineList } from './Sidebar'
import { IconButton, Tip, Popover, PopoverTrigger, PopoverContent, Menu, MenuTrigger, MenuContent, MenuItem, MenuSep, Button, Meter, StatusDot, Segmented, Keys } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { Logo } from '@/components/logos'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ */
/* Pane registry                                                       */
/* ------------------------------------------------------------------ */
export const paneMeta: Record<PaneKind, { title: string; icon: typeof MessagesSquare }> = {
  chat: { title: 'Chat', icon: MessagesSquare },
  editor: { title: 'Editor', icon: FileCode2 },
  files: { title: 'Files', icon: FolderTree },
  terminal: { title: 'Terminal', icon: SquareTerminal },
  browser: { title: 'Browser', icon: Globe },
  changes: { title: 'Changes', icon: FileDiff },
  plan: { title: 'Plan', icon: ListChecks },
  usage: { title: 'Usage', icon: Gauge },
}

type P = { kind: PaneKind; path?: string }
const components: Record<string, React.FunctionComponent<IDockviewPanelProps<P>>> = {
  chat: () => <ChatPane />,
  editor: (p) => <EditorPane path={p.params.path!} />,
  files: () => <FilesPane />,
  terminal: () => <GhosttyTerminal />,
  browser: () => <BrowserPane />,
  changes: () => <ChangesPane />,
  plan: () => <PlanPane />,
  usage: () => <UsagePane />,
}

/* Tab: icon + title + close, with a status dot for chat. */
function Tab(props: IDockviewPanelHeaderProps<P>) {
  const kind = props.params.kind
  const Icon = paneMeta[kind].icon
  const status = useApp((s) => (kind === 'chat' && !s.runDone ? 'running' : null))
  const dirty = kind === 'editor' && files[props.params.path ?? '']?.status
  return (
    <div className="group flex h-full items-center gap-2 pl-2.5 pr-1.5 font-sans">
      <Icon size={13.5} className="shrink-0 opacity-80" />
      <span className={cn('max-w-[160px] truncate', kind === 'editor' && 'font-mono text-[12px]')}>{props.api.title}</span>
      {status && <StatusDot status="running" className="size-[6px]" />}
      {dirty && <span className={cn('text-[10px] font-semibold', dirty === 'M' ? 'text-ember' : 'text-sage')}>{dirty}</span>}
      <button onClick={(e) => { e.stopPropagation(); props.api.close() }}
        className="grid size-5 place-items-center rounded-[5px] text-ash opacity-0 transition-opacity hover:bg-lift hover:text-bone group-hover:opacity-100">
        <X size={12} />
      </button>
    </div>
  )
}

/* Right side of each tab strip: add pane, maximize. */
function GroupActions(props: IDockviewHeaderActionsProps) {
  const [max, setMax] = useState(props.api.isMaximized())
  useEffect(() => { const d = props.containerApi.onDidMaximizedGroupChange(() => setMax(props.api.isMaximized())); return () => d.dispose() }, [props])
  return (
    <div className="flex h-full items-center gap-0.5 pr-1">
      <Menu>
        <Tip label="Add a pane here"><MenuTrigger asChild><IconButton size="sm"><Plus size={14} /></IconButton></MenuTrigger></Tip>
        <MenuContent align="end">
          {(Object.keys(paneMeta) as PaneKind[]).filter((k) => k !== 'editor').map((k) => {
            const M = paneMeta[k]
            return <MenuItem key={k} onSelect={() => openPane(props.containerApi, k, { group: props.group.id })}><M.icon size={15} />{M.title}</MenuItem>
          })}
        </MenuContent>
      </Menu>
      <Tip label={max ? 'Restore layout' : 'Focus this pane'} keys="Ctrl Shift M">
        <IconButton size="sm" onClick={() => (max ? props.api.exitMaximized() : props.api.maximize())}>{max ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</IconButton>
      </Tip>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Layout presets & pane helpers                                       */
/* ------------------------------------------------------------------ */
let seq = 0
export function openPane(api: DockviewApi, kind: PaneKind, opts: { path?: string; group?: string; direction?: 'right' | 'below' | 'left' } = {}) {
  const id = kind === 'editor' ? `editor:${opts.path}` : kind
  const existing = api.getPanel(id)
  if (existing) { existing.api.setActive(); return existing }
  const title = kind === 'editor' ? opts.path!.split('/').pop()! : paneMeta[kind].title
  const position = opts.group ? { referenceGroup: opts.group } : opts.direction ? { referencePanel: api.activePanel?.id ?? 'chat', direction: opts.direction } : undefined
  return api.addPanel({ id: id || `p${seq++}`, component: kind, tabComponent: 'tab', title, params: { kind, path: opts.path }, position: position as never })
}

export function applyPreset(api: DockviewApi, preset: Preset) {
  api.clear()
  const add = (kind: PaneKind, position?: object, path?: string, extra: object = {}) =>
    api.addPanel({ id: kind === 'editor' ? `editor:${path}` : kind, component: kind, tabComponent: 'tab', title: kind === 'editor' ? path!.split('/').pop()! : paneMeta[kind].title, params: { kind, path }, position: position as never, ...extra })
  if (preset === 'chat') {
    add('chat')
    add('plan', { referencePanel: 'chat', direction: 'right' })
    add('changes', { referencePanel: 'plan', direction: 'within' })
    add('terminal', { referencePanel: 'plan', direction: 'within' })
    api.getPanel('plan')?.api.setActive(); api.getPanel('chat')?.api.setActive()
    sizeAfterLayout(api, { plan: { width: 360 } })
  } else if (preset === 'code') {
    add('files')
    add('editor', { referencePanel: 'files', direction: 'right' }, 'src/scene/korope.rs')
    add('editor', { referencePanel: 'editor:src/scene/korope.rs', direction: 'within' }, 'src/scene/danfo_roof.rs')
    add('chat', { referencePanel: 'editor:src/scene/korope.rs', direction: 'right' })
    add('terminal', { referencePanel: 'editor:src/scene/korope.rs', direction: 'below' })
    api.getPanel('editor:src/scene/korope.rs')?.api.setActive()
    sizeAfterLayout(api, { files: { width: 230 }, chat: { width: 400 }, terminal: { height: 190 } })
  } else if (preset === 'review') {
    add('changes')
    add('chat', { referencePanel: 'changes', direction: 'right' })
    sizeAfterLayout(api, { chat: { width: 400 } })
  } else if (preset === 'browser') {
    add('browser')
    add('chat', { referencePanel: 'browser', direction: 'right' })
    add('terminal', { referencePanel: 'browser', direction: 'below' })
    sizeAfterLayout(api, { chat: { width: 380 }, terminal: { height: 190 } })
  } else if (preset === 'terminal') {
    add('terminal')
    add('chat', { referencePanel: 'terminal', direction: 'right' })
    sizeAfterLayout(api, { chat: { width: 420 } })
  }
}

/* Apply group sizes once the grid has measured itself (sizes passed at add time are ignored). */
function sizeAfterLayout(api: DockviewApi, sizes: Record<string, { width?: number; height?: number }>) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const [id, s] of Object.entries(sizes)) api.getPanel(id)?.group.api.setSize(s)
  }))
}

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */
const presets: { value: Preset; label: string; icon: React.ReactNode }[] = [
  { value: 'chat', label: 'Chat', icon: <MessagesSquare size={13} /> },
  { value: 'code', label: 'Code', icon: <FileCode2 size={13} /> },
  { value: 'review', label: 'Review', icon: <FileDiff size={13} /> },
  { value: 'browser', label: 'Browser', icon: <Globe size={13} /> },
  { value: 'terminal', label: 'Terminal', icon: <SquareTerminal size={13} /> },
]

export function Workspace() {
  const s = useApp()
  const session = s.sessions.find((x) => x.id === s.sessionId)!
  const m = getMachine(session.machine)
  const onReady = (e: DockviewReadyEvent) => {
    useApp.getState().set({ dock: e.api })
    applyPreset(e.api, useApp.getState().preset)
  }
  const choose = (p: Preset) => { s.set({ preset: p }); if (s.dock) applyPreset(s.dock, p) }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 px-3">
        {s.sidebar === 'rail' && <Tip label="Show sidebar" keys="Ctrl B"><IconButton onClick={() => s.set({ sidebar: 'full' })}><PanelLeft size={16} /></IconButton></Tip>}
        <div className="min-w-0 pl-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{session.title}</span>
            <StatusDot status={session.status} />
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-ash">
            <span>{session.project}</span><span className="text-seam-2">/</span><span>master</span>
            {session.agents && <span className="hidden md:contents"><span className="text-seam-2">/</span><SwarmStrip /></span>}
          </div>
        </div>
        <div className="flex-1" />

        <Segmented layoutId="preset" value={s.preset} onChange={choose} className="hidden lg:inline-flex"
          items={presets.map((p) => ({ ...p, label: <span className="hidden xl:inline">{p.label}</span> }))} />

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-[9px] pl-1 pr-2.5 text-sec transition-colors hover:bg-slab-2">
              <MachineMark m={m} size={24} className="border-0 bg-transparent" />
              <span className={cn('hidden font-medium sm:inline', kindMeta[m.kind].color)}>{m.name}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[310px]">
            <div className="px-2 pb-1.5 pt-1 text-sec text-dust">Move this session to another machine. Files sync first, then the agent continues there.</div>
            <MachineList value={session.machine} onPick={(id) => toast(`Moving to ${getMachine(id).name}`, { description: 'Syncing 3 changed files, then resuming.' })} />
          </PopoverContent>
        </Popover>

        <Tip label="Stream mode hides emails, keys and paths">
          <IconButton active={s.stream} onClick={() => s.set({ stream: !s.stream })}><Radio size={16} /></IconButton>
        </Tip>
        <Menu>
          <MenuTrigger asChild><IconButton><MoreHorizontal size={16} /></IconButton></MenuTrigger>
          <MenuContent align="end">
            <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-ash lg:hidden">Layout</div>
            {presets.map((p) => <MenuItem key={p.value} className="lg:hidden" onSelect={() => choose(p.value)}>{p.icon}{p.label}{s.preset === p.value && <Check size={14} className="ml-auto text-brass" />}</MenuItem>)}
            <div className="lg:hidden"><MenuSep /></div>
            <MenuItem onSelect={() => toast('Forked into a new session')}><GitFork size={15} />Fork session</MenuItem>
            <MenuItem><Pencil size={15} />Rename</MenuItem>
            <MenuItem><ArrowRightLeft size={15} />Move to machine</MenuItem>
            <MenuItem><Share2 size={15} />Share transcript</MenuItem>
            <MenuItem><ExternalLink size={15} />Pop out to its own window</MenuItem>
            <MenuSep />
            <MenuItem><Archive size={15} />Archive</MenuItem>
          </MenuContent>
        </Menu>
      </header>
      <div className="relative min-h-0 flex-1 px-2 pb-2">
        <DockviewReact
          className="dock-jcode h-full"
          theme={{ name: 'jcode', className: 'dock-jcode', gap: 8, dndOverlayMounting: 'absolute', dndPanelOverlay: 'group', dndTabIndicator: 'line' }}
          components={components as never}
          tabComponents={{ tab: Tab as never }}
          rightHeaderActionsComponent={GroupActions}
          onReady={onReady}
          disableFloatingGroups={false}
        />
      </div>
      <DockHint />
    </div>
  )
}

function DockHint() {
  const [show, setShow] = useState(true)
  useEffect(() => { const t = setTimeout(() => setShow(false), 7000); return () => clearTimeout(t) }, [])
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ delay: 0.6 }}
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-bone px-4 py-2 text-sec text-ink shadow-[0_12px_40px_-8px_rgb(0_0_0/.5)]">
          Drag any tab to move it. Drop on an edge to split. <span className="opacity-60">Double-click a tab to focus it.</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/* Panes                                                               */
/* ------------------------------------------------------------------ */
function ChatPane() {
  const runDone = useApp((s) => s.runDone)
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Transcript />
      <Composer running={!runDone} onStop={() => toast('Stopped after the current step')} />
    </div>
  )
}

function Bar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex h-10 shrink-0 items-center gap-2 px-3 text-sec text-ash', className)}>{children}</div>
}

function EditorPane({ path }: { path: string }) {
  const f = files[path]
  const [view, setView] = useState<'code' | 'diff'>('code')
  if (!f) return <div className="grid h-full place-items-center text-sec text-ash">This file is not in the prototype.</div>
  const crumbs = path.split('/')
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Bar>
        <span className="flex min-w-0 items-center gap-1 font-mono text-[12px]">
          {crumbs.map((c, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight size={11} className="text-seam-2" />}<span className={i === crumbs.length - 1 ? 'text-bone' : ''}>{c}</span></span>)}
        </span>
        <div className="flex-1" />
        {f.before !== undefined && (
          <Segmented layoutId={`ev-${path}`} size="sm" value={view} onChange={setView}
            items={[{ value: 'code', label: 'Code' }, { value: 'diff', label: <span className="flex items-center gap-1">Changes <span className="size-1.5 rounded-full bg-ember" /></span> }]} />
        )}
        <span className="hidden text-meta md:inline">{{ rust: 'Rust', toml: 'TOML', md: 'Markdown', ts: 'TypeScript' }[f.lang]}</span>
      </Bar>
      <div className="min-h-0 flex-1">
        {view === 'diff' && f.before !== undefined ? <DiffEditor before={f.before} after={f.text} lang={f.lang} /> : <CodeEditor doc={f.text} lang={f.lang} />}
      </div>
    </div>
  )
}

function FilesPane() {
  const dock = useApp((s) => s.dock)
  const [q, setQ] = useState('')
  const open = (path: string) => {
    if (!dock) return
    const editorGroup = dock.panels.find((p) => p.id.startsWith('editor:'))?.group
    const chat = dock.getPanel('chat')
    openPane(dock, 'editor', editorGroup ? { path, group: editorGroup.id } : chat ? { path, group: chat.group.id } : { path })
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-2">
        <div className="flex h-8 items-center gap-2 rounded-[9px] bg-slab-2 px-2.5 text-sec text-ash">
          <Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to file" className="min-w-0 flex-1 bg-transparent text-bone outline-none placeholder:text-ash" />
          <Keys k="Ctrl P" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {tree.map((n) => <TreeItem key={n.path} n={n} depth={0} onOpen={open} q={q.toLowerCase()} />)}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 text-meta text-ash"><span className="size-1.5 rounded-full bg-ember" />3 changed <span className="ml-auto font-mono text-[11px]">master</span></div>
    </div>
  )
}
function TreeItem({ n, depth, onOpen, q }: { n: TreeNode; depth: number; onOpen: (p: string) => void; q: string }) {
  const [open, setOpen] = useState(depth < 2)
  const st = files[n.path]?.status
  if (q && !n.dir && !n.path.toLowerCase().includes(q)) return null
  return (
    <>
      <button onClick={() => (n.dir ? setOpen(!open) : onOpen(n.path))}
        className="group flex h-[28px] w-full items-center gap-1.5 rounded-[7px] pr-2 text-left text-[13px] text-dust hover:bg-slab-2 hover:text-bone"
        style={{ paddingLeft: 6 + depth * 14 }}>
        {n.dir ? <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }}><ChevronRight size={12} className="text-ash" /></motion.span> : <span className="w-3" />}
        {n.dir ? (open ? <FolderOpen size={14} className="text-brass/80" /> : <Folder size={14} className="text-brass/80" />) : <FileCode2 size={14} className="text-ash group-hover:text-dust" />}
        <span className={cn('truncate', st && 'text-bone')}>{n.name}</span>
        {st && <span className={cn('ml-auto text-[10.5px] font-semibold', st === 'M' ? 'text-ember' : 'text-sage')}>{st}</span>}
      </button>
      {n.dir && open && n.children?.map((c) => <TreeItem key={c.path} n={c} depth={depth + 1} onOpen={onOpen} q={q} />)}
    </>
  )
}

function BrowserPane() {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'phone'>('desktop')
  const [loading, setLoading] = useState(false)
  const w = { desktop: '100%', tablet: '768px', phone: '390px' }[device]
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 px-2">
        <IconButton size="sm"><ArrowLeft size={14} /></IconButton>
        <IconButton size="sm"><ArrowRight size={14} /></IconButton>
        <IconButton size="sm" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 700) }}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></IconButton>
        <div className="mx-1 flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-slab-2 px-2.5 font-mono text-[12px] text-dust">
          <Lock size={11} className="text-sage" /><span className="truncate">localhost:5173/viewer/korope</span>
        </div>
        <Segmented layoutId="device" size="sm" value={device} onChange={setDevice} className="hidden md:inline-flex"
          items={[{ value: 'desktop', label: <Monitor size={12} /> }, { value: 'tablet', label: <Tablet size={12} /> }, { value: 'phone', label: <Smartphone size={12} /> }]} />
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-ink/60 p-3">
        <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="mx-auto h-full overflow-hidden rounded-[10px] bg-[radial-gradient(80%_70%_at_50%_30%,#2b4466,#0d1520)]" style={{ maxWidth: w }}>
          <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
            <svg viewBox="0 0 200 110" className="w-[min(70%,420px)]">
              <rect x="30" y="30" width="140" height="56" rx="10" fill="#4b8bd0" /><rect x="40" y="20" width="110" height="20" rx="6" fill="#5a9be0" />
              <rect x="44" y="40" width="30" height="20" rx="3" fill="#cfe4fa" opacity=".8" /><rect x="80" y="40" width="30" height="20" rx="3" fill="#cfe4fa" opacity=".8" /><rect x="116" y="40" width="30" height="20" rx="3" fill="#cfe4fa" opacity=".8" />
              <circle cx="60" cy="88" r="11" fill="#111" /><circle cx="140" cy="88" r="11" fill="#111" />
            </svg>
            <div className="text-[13px] opacity-80">Korope viewer, live from cargo run</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

const changed = Object.entries(files).filter(([, f]) => f.status)
function ChangesPane() {
  const [sel, setSel] = useState(changed[0][0])
  const [mode, setMode] = useState<'unified' | 'split'>('unified')
  const f = files[sel]
  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[230px] shrink-0 flex-col border-r border-seam">
        <Bar><span className="font-medium text-bone">3 files</span><span className="font-mono text-[11.5px]"><span className="text-sage">+75</span> <span className="text-rose">−21</span></span></Bar>
        <div className="flex-1 overflow-y-auto px-1.5">
          {changed.map(([p, x]) => (
            <button key={p} onClick={() => setSel(p)}
              className={cn('flex w-full flex-col items-start rounded-[8px] px-2.5 py-1.5 text-left', sel === p ? 'bg-slab-2' : 'hover:bg-slab')}>
              <span className={cn('flex w-full items-center gap-2 font-mono text-[12px]', sel === p ? 'text-bone' : 'text-dust')}>{p.split('/').pop()}<span className={cn('ml-auto font-sans text-[10.5px] font-semibold', x.status === 'M' ? 'text-ember' : 'text-sage')}>{x.status}</span></span>
              <span className="truncate font-mono text-[10.5px] text-ash">{p.split('/').slice(0, -1).join('/')}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 p-2">
          <Button size="sm" variant="ghost" className="flex-1">Undo all</Button>
          <Button size="sm" variant="primary" className="flex-1" onClick={() => toast('Committed 3 files', { description: 'feat(korope): DA52 high roof and welded danfo seam' })}>Commit</Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Bar>
          <span className="truncate font-mono text-[12px] text-bone">{sel}</span>
          <div className="flex-1" />
          <Segmented layoutId="diffmode" size="sm" value={mode} onChange={setMode} items={[{ value: 'unified', label: <span className="flex items-center gap-1"><Rows3 size={11} />Unified</span> }, { value: 'split', label: <span className="flex items-center gap-1"><Columns2 size={11} />Split</span> }]} />
        </Bar>
        <div className="min-h-0 flex-1">
          {mode === 'unified' ? <DiffEditor before={f.before ?? ''} after={f.text} lang={f.lang} /> : <SplitDiff before={f.before ?? ''} after={f.text} lang={f.lang} />}
        </div>
      </div>
    </div>
  )
}

function PlanPane() {
  const done = plan.filter((p) => p.done).length
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-2 flex items-baseline justify-between"><span className="text-[13px] font-semibold">Plan</span><span className="text-meta text-ash">{done} of {plan.length}</span></div>
      <Meter value={done / plan.length} className="mb-4" />
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {plan.map((p, i) => {
          const live = !p.done && (i === 0 || plan[i - 1].done)
          return (
            <li key={i} className={cn('flex items-start gap-2.5 rounded-[9px] px-2 py-2', live && 'bg-brass/[0.08]')}>
              <span className={cn('mt-[1px] grid size-[18px] shrink-0 place-items-center rounded-full',
                p.done ? 'bg-sage/20 text-sage' : live ? 'bg-brass/20 text-brass' : 'bg-slab-2')}>
                {p.done ? <Check size={11} strokeWidth={3} /> : live ? <span className="breathe size-[6px] rounded-full bg-brass" /> : null}
              </span>
              <span className={cn('text-[13px] leading-snug', p.done ? 'text-ash line-through decoration-seam-2' : live ? 'text-bone' : 'text-dust')}>{p.text}</span>
            </li>
          )
        })}
      </ol>
      <div className="mb-2 mt-6 text-[13px] font-semibold">Background</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 rounded-[10px] bg-slab px-3 py-2.5"><span className="size-3.5 animate-spin rounded-full border-2 border-seam-2 border-t-brass" /><span className="flex-1 font-mono text-[12px]">cargo build --release</span><span className="text-meta text-ash">42s</span></div>
        <div className="flex items-center gap-3 rounded-[10px] bg-slab px-3 py-2.5"><Check size={14} className="text-sage" /><span className="flex-1 font-mono text-[12px] text-dust">fetch reference assets</span><span className="text-meta text-ash">3m</span></div>
      </div>
    </div>
  )
}

function UsagePane() {
  const rows = [
    { logo: 'openai' as const, name: 'ChatGPT Pro', sub: 'Resets in 2h 14m', v: 0.48 },
    { logo: 'claude' as const, name: 'Claude Max', sub: 'Weekly, resets Monday', v: 0.71 },
    { logo: 'openrouter' as const, name: 'OpenRouter', sub: '$18.40 of $50', v: 0.37 },
  ]
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-1.5 flex justify-between text-sec"><span>Context</span><span className="text-ash">124k of 200k</span></div>
      <Meter value={0.62} className="mb-5" />
      {rows.map((r) => (
        <div key={r.name} className="mb-3">
          <div className="mb-1.5 flex items-center gap-2 text-sec"><Logo name={r.logo} size={14} tinted />{r.name}<span className="ml-auto text-ash">{Math.round(r.v * 100)}%</span></div>
          <Meter value={r.v} tone={r.v > 0.65 ? 'ember' : 'brass'} /><div className="mt-1 text-meta text-ash">{r.sub}</div>
        </div>
      ))}
      <Button size="sm" className="mt-2 w-full" onClick={() => toast('Compacting context')}><RefreshCw size={13} />Compact context now</Button>
    </div>
  )
}

export function useDockShortcut() {
  const ref = useRef(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const d = useApp.getState().dock
      if (!d) return
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        if (d.hasMaximizedGroup()) d.exitMaximizedGroup(); else d.activePanel && d.maximizeGroup(d.activePanel)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) { e.preventDefault(); openPane(d, 'files', { direction: 'left' }) }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); openPane(d, 'terminal', { direction: 'below' }) }
    }
    if (!ref.current) { window.addEventListener('keydown', k, true); ref.current = true }
    return () => { window.removeEventListener('keydown', k, true); ref.current = false }
  }, [])
}
