import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Network, Moon, Zap, Clock3, ScanEye, Plus, Pause, Play, Check, CircleHelp, ArrowUpRight, Search, Brain, X, Send,
  ShieldAlert, GitPullRequest, Square, RotateCcw, Globe, FileText, FilePen, SquareTerminal, Coins, Timer, ArrowRightLeft,
} from 'lucide-react'
import { useApp, getMachine, getModel } from '@/lib/store'
import { kindMeta } from '@/lib/data'
import { PageHead } from './Machines'
import { Logo, LogoTile, type LogoName } from '@/components/logos'
import { Button, Switch, Badge, StatusDot, Meter, IconButton, Tip, Segmented, type Status } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ */
/* Agents control room                                                 */
/* ------------------------------------------------------------------ */
type Agent = {
  id: string; name: string; role: string; status: Status; session: string; model: string; machine: string
  task: string; progress: number; tokens: string; cost: string; time: string
  activity: { icon: typeof Globe; text: string; t: string }[]
}
const agents: Agent[] = [
  { id: 'a1', name: 'Coordinator', role: 'Plans and hands out work', status: 'running', session: 'korope', model: 'gpt-6-astra', machine: 'local', task: 'Merging texture and lighting results', progress: 0.62, tokens: '412k', cost: '$1.84', time: '12m',
    activity: [{ icon: Brain, text: 'Split the render polish into 5 tasks', t: '12m' }, { icon: Network, text: 'Assigned Textures and Lighting in parallel', t: '9m' }, { icon: FileText, text: 'Reading Geometry agent report', t: 'now' }] },
  { id: 'a2', name: 'Textures', role: 'Livery, decals, wear', status: 'running', session: 'korope', model: 'gpt-5.6-luna', machine: 'daytona', task: 'Baking faded blue livery onto the body', progress: 0.45, tokens: '188k', cost: '$0.31', time: '8m',
    activity: [{ icon: Globe, text: 'Searched Lagos korope paint references', t: '8m' }, { icon: FilePen, text: 'Edited paint/livery.rs', t: '3m' }, { icon: SquareTerminal, text: 'Running cargo run --example bake', t: 'now' }] },
  { id: 'a3', name: 'Lighting', role: 'Sun, shadows, haze', status: 'running', session: 'korope', model: 'claude-sonnet', machine: 'gcp', task: 'Matching late afternoon Lagos haze', progress: 0.3, tokens: '96k', cost: '$0.52', time: '6m',
    activity: [{ icon: FileText, text: 'Read scene/lighting.rs', t: '6m' }, { icon: FilePen, text: 'Tuned fog density to 0.018', t: 'now' }] },
  { id: 'a4', name: 'Tests', role: 'Geometry and paint checks', status: 'waiting', session: 'korope', model: 'gpt-5.6-luna', machine: 'local', task: 'Wants to delete 2 outdated snapshot files', progress: 0.8, tokens: '54k', cost: '$0.09', time: '4m',
    activity: [{ icon: SquareTerminal, text: 'cargo test: 14 passed, 2 snapshots stale', t: '4m' }, { icon: ShieldAlert, text: 'Asked to delete tests/snapshots/korope_*.png', t: '1m' }] },
  { id: 'a5', name: 'Booking API', role: 'grace backend', status: 'waiting', session: 'ship', model: 'gpt-6-astra', machine: 'gcp', task: 'Wants approval to run the database migration', progress: 0.55, tokens: '620k', cost: '$2.10', time: '1h',
    activity: [{ icon: FilePen, text: 'Wrote migration 0042_add_rooms', t: '20m' }, { icon: ShieldAlert, text: 'Asked before running it on staging', t: '6m' }] },
  { id: 'a6', name: 'Geometry', role: 'Body and roof', status: 'done', session: 'korope', model: 'claude-opus', machine: 'local', task: 'High roof, drip rail and welded seam', progress: 1, tokens: '230k', cost: '$1.12', time: 'done 3m ago',
    activity: [{ icon: FilePen, text: 'Edited korope.rs and danfo_roof.rs', t: '9m' }, { icon: Check, text: 'Opened PR #41', t: '3m' }] },
  { id: 'a7', name: 'Review', role: 'Second opinion', status: 'idle', session: 'korope', model: 'claude-opus', machine: 'local', task: 'Queued until Textures and Lighting finish', progress: 0, tokens: '0', cost: '$0', time: 'queued',
    activity: [] },
]

const inbox = [
  { id: 'i1', agent: 'a4', kind: 'approve', title: 'Delete 2 stale snapshot files?', detail: 'tests/snapshots/korope_front.png, korope_side.png', risk: 'Deletes files' },
  { id: 'i2', agent: 'a5', kind: 'approve', title: 'Run migration 0042_add_rooms on staging?', detail: 'Adds rooms table and 2 indexes. Reversible.', risk: 'Touches a database' },
  { id: 'i3', agent: 'a6', kind: 'review', title: 'PR #41 is ready for review', detail: 'feat(korope): DA52 high roof and welded danfo seam, +75 −21', risk: '' },
  { id: 'i4', agent: 'a1', kind: 'question', title: 'Faded livery or factory finish?', detail: 'Affects the Textures agent', risk: '' },
]

export function AgentsView() {
  const { sessions, openSession } = useApp()
  const [sel, setSel] = useState('a2')
  const [filter, setFilter] = useState<'all' | 'running' | 'waiting' | 'done'>('all')
  const [handled, setHandled] = useState<string[]>([])
  const [paused, setPaused] = useState<string[]>([])
  const list = agents.filter((a) => filter === 'all' || a.status === filter || (filter === 'done' && a.status === 'idle'))
  const a = agents.find((x) => x.id === sel)!
  const pending = inbox.filter((i) => !handled.includes(i.id))
  const live = agents.filter((x) => x.status === 'running').length
  const liveSessions = sessions.filter((x) => x.status === 'running' || x.status === 'waiting')
  const togglePause = (id: string) => setPaused(paused.includes(id) ? paused.filter((p) => p !== id) : [...paused, id])

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[940px] px-6 pb-16 pt-8 md:px-10">
          <PageHead title="Agents" desc={`${live} working, ${pending.length} waiting on you, across 3 machines.`}
            actions={<div className="flex gap-2"><Button variant="ghost" onClick={() => { setPaused(agents.map((x) => x.id)); toast('All agents paused') }}><Pause size={14} />Pause all</Button><Button variant="primary"><Network size={14} />New swarm</Button></div>} />

          {/* Totals */}
          <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { icon: Zap, label: 'Working', value: String(live), tone: 'text-brass' },
              { icon: CircleHelp, label: 'Needs you', value: String(pending.length), tone: 'text-ember' },
              { icon: Coins, label: 'Spent today', value: '$6.98', tone: 'text-dust' },
              { icon: Timer, label: 'Saved you', value: '~3.5h', tone: 'text-sage' },
            ].map((x) => (
              <div key={x.label} className="rounded-[14px] bg-soot px-4 py-3">
                <div className="flex items-center gap-1.5 text-meta text-ash"><x.icon size={12} className={x.tone} />{x.label}</div>
                <div className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">{x.value}</div>
              </div>
            ))}
          </div>

          {/* Swarm map: illustrative AND interactive. Click a node to inspect and steer it. */}
          <SwarmMap sel={sel} onSel={setSel} paused={paused} onPause={togglePause} pausedAll={paused.length >= agents.length} />

          {/* Needs you */}
          <AnimatePresence initial={false}>
            {pending.length > 0 && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="mt-8">
                <div className="mb-3 flex items-center gap-2"><h2 className="m-0 text-[14px] font-semibold">Needs you</h2><Badge tone="ember">{pending.length}</Badge></div>
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {pending.map((i) => {
                      const ag = agents.find((x) => x.id === i.agent)!
                      return (
                        <motion.div key={i.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, height: 0, transition: { duration: 0.22 } }}
                          className="flex flex-wrap items-center gap-3 rounded-[14px] bg-soot px-4 py-3">
                          <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', i.kind === 'approve' ? 'bg-ember/15 text-ember' : i.kind === 'review' ? 'bg-sky/15 text-sky' : 'bg-brass/15 text-brass')}>
                            {i.kind === 'approve' ? <ShieldAlert size={15} /> : i.kind === 'review' ? <GitPullRequest size={15} /> : <CircleHelp size={15} />}
                          </span>
                          <div className="min-w-[200px] flex-1">
                            <div className="text-[13.5px] font-medium">{i.title}</div>
                            <div className="truncate text-sec text-ash"><button onClick={() => setSel(ag.id)} className="font-medium text-dust hover:text-bone">{ag.name}</button>, {i.detail}</div>
                          </div>
                          {i.risk && <Badge tone="ember">{i.risk}</Badge>}
                          <div className="flex gap-1.5">
                            {i.kind === 'approve' && <><Button size="sm" variant="ghost" onClick={() => { setHandled([...handled, i.id]); toast('Declined', { description: `${ag.name} will find another way.` }) }}>Decline</Button>
                              <Button size="sm" variant="primary" onClick={() => { setHandled([...handled, i.id]); toast('Approved', { description: `${ag.name} is continuing.` }) }}><Check size={13} />Approve</Button></>}
                            {i.kind === 'review' && <><Button size="sm" variant="ghost">Open diff</Button><Button size="sm" variant="primary" onClick={() => { setHandled([...handled, i.id]); toast('PR #41 merged') }}>Merge</Button></>}
                            {i.kind === 'question' && <><Button size="sm" onClick={() => setHandled([...handled, i.id])}>Faded</Button><Button size="sm" onClick={() => setHandled([...handled, i.id])}>Factory</Button></>}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Live session cards (kept from the earlier design, now with live step + inline answer) */}
          <h2 className="mb-3 mt-8 text-[14px] font-semibold">Live sessions</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {liveSessions.map((x, i) => {
              const m = getMachine(x.machine), md = getModel(x.model)
              return (
                <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="group flex flex-col gap-3.5 rounded-[16px] bg-soot p-4 transition-colors hover:bg-slab">
                  <button onClick={() => openSession(x.id)} className="flex items-start gap-3 text-left">
                    <StatusDot status={x.status} className="mt-1.5" />
                    <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold">{x.title}</div><div className="text-sec text-ash">{x.project}</div></div>
                    <ArrowUpRight size={15} className="text-ash opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  {x.status === 'waiting' ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-[11px] bg-ember/[0.08] px-3 py-2 text-sec text-ember">
                      <CircleHelp size={14} /><span className="flex-1">{x.id === 'ship' ? 'Wants approval to run the database migration' : 'Asked which license the photos should use'}</span>
                      <Button size="xs" variant="primary" onClick={() => toast('Answer sent')}>{x.id === 'ship' ? 'Approve' : 'Own work'}</Button>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-meta"><span className="flex items-center gap-1.5 text-dust"><span className="breathe size-[5px] rounded-full bg-brass" />Baking faded livery</span><span className="text-ash">3 of 5 steps, 12 min</span></div>
                      <Meter value={0.6} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-meta text-ash">
                    <span className="flex items-center gap-1.5"><Logo name={md.provider} size={13} tinted />{md.name}</span>
                    <span className={cn('flex items-center gap-1.5', kindMeta[m.kind].color)}><MachineMark m={m} size={16} className="border-0 bg-transparent" />{m.name}</span>
                    {x.agents && <span className="ml-auto flex items-center gap-1"><Network size={12} />{x.agents} agents</span>}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Compact table of every agent */}
          <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-[14px] font-semibold">All agents</h2>
            <Segmented layoutId="agent-filter" size="sm" value={filter} onChange={setFilter}
              items={[{ value: 'all', label: 'All' }, { value: 'running', label: 'Working' }, { value: 'waiting', label: 'Needs you' }, { value: 'done', label: 'Done' }]} />
          </div>
          <div className="overflow-hidden rounded-[16px] bg-soot">
            {list.map((x, i) => {
              const m = getMachine(x.machine), md = getModel(x.model)
              const isPaused = paused.includes(x.id)
              return (
                <button key={x.id} onClick={() => setSel(x.id)}
                  className={cn('group flex w-full items-center gap-4 px-4 py-2.5 text-left transition-colors', i > 0 && 'border-t border-seam/60', sel === x.id ? 'bg-slab-2' : 'hover:bg-slab')}>
                  <StatusDot status={isPaused ? 'idle' : x.status} />
                  <div className="w-[130px] shrink-0 truncate text-[13.5px] font-medium">{x.name}</div>
                  <div className={cn('hidden min-w-0 flex-1 truncate text-sec md:block', x.status === 'waiting' ? 'text-ember' : 'text-dust')}>{isPaused ? 'Paused' : x.task}</div>
                  <span className="hidden items-center gap-1.5 text-meta text-ash lg:flex"><Logo name={md.provider} size={13} tinted />{md.name}</span>
                  <span className={cn('flex w-[110px] items-center gap-1.5 text-meta', kindMeta[m.kind].color)}><MachineMark m={m} size={18} className="border-0 bg-transparent" /><span className="truncate">{m.name}</span></span>
                  <span className="w-[54px] text-right text-meta text-ash">{x.time}</span>
                </button>
              )
            })}
          </div>

          {/* Automations */}
          <h2 className="mb-3 mt-8 text-[14px] font-semibold">Automations</h2>
          <div className="overflow-hidden rounded-[16px] bg-soot">
            {[
              { icon: Moon, t: 'Overnight runs', d: 'Keep improving on gcp-home until 7am, then send a summary', on: false },
              { icon: Zap, t: 'Auto-continue', d: 'Keep going while the plan still has unfinished steps', on: true },
              { icon: Brain, t: 'Ambient mode', d: 'Watch the repo and pick up small fixes on its own', on: true },
              { icon: ScanEye, t: 'Auto review', d: 'A second agent reviews each finished task before you see it', on: false },
              { icon: Clock3, t: 'Scheduled tasks', d: 'Dependency updates every Monday at 9:00', on: true },
            ].map((x, i) => (
              <div key={x.t} className={cn('flex items-center gap-4 px-4 py-3.5', i > 0 && 'border-t border-seam/60')}>
                <span className="grid size-9 place-items-center rounded-[10px] bg-slab-2 text-dust"><x.icon size={16} /></span>
                <div className="flex-1"><div className="text-[13.5px] font-medium">{x.t}</div><div className="text-sec text-ash">{x.d}</div></div>
                <Switch defaultChecked={x.on} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <AgentDetail a={a} paused={paused.includes(a.id)} onPause={() => togglePause(a.id)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Swarm map                                                           */
/* ------------------------------------------------------------------ */
const swarmKids = ['a6', 'a2', 'a3', 'a4', 'a7'] // children of the coordinator, left to right
const statusVar: Record<Status, string> = { done: 'var(--sage)', running: 'var(--brass)', waiting: 'var(--ember)', idle: 'var(--seam-2)', error: 'var(--rose)' }
const statusWord: Record<Status, string> = { done: 'finished', running: 'working', waiting: 'needs you', idle: 'queued', error: 'failed' }

function SwarmMap({ sel, onSel, paused, onPause, pausedAll }: { sel: string; onSel: (id: string) => void; paused: string[]; onPause: (id: string) => void; pausedAll: boolean }) {
  const coord = agents.find((x) => x.id === 'a1')!
  const kids = swarmKids.map((id) => agents.find((x) => x.id === id)!)
  const xs = kids.map((_, i) => 10 + (i * 80) / (kids.length - 1))
  const st = (x: Agent): Status => (paused.includes(x.id) ? 'idle' : x.status)
  return (
    <section className="relative overflow-hidden rounded-[18px] bg-soot px-5 pb-5 pt-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--seam)_1px,transparent_0)] [background-size:18px_18px] opacity-50" />
      <div className="relative mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[14px] font-semibold">Realistic Korope render</span>
        <Badge tone="brass"><Network size={10} />{kids.length + 1} agents</Badge>
        <span className="text-sec text-ash">coordinator on This laptop</span>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => toast(pausedAll ? 'Swarm resumed' : 'Swarm paused')}>{pausedAll ? <Play size={13} /> : <Pause size={13} />}{pausedAll ? 'Resume' : 'Pause all'}</Button>
          <Button size="sm"><Plus size={13} />Add agent</Button>
        </div>
      </div>
      <div className="relative h-[196px]">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {kids.map((k, i) => {
            const s = st(k), active = sel === k.id
            return (
              <path key={k.id} d={`M50 26 C 50 54, ${xs[i]} 44, ${xs[i]} 66`} fill="none" stroke={statusVar[s]}
                strokeOpacity={active ? 1 : s === 'idle' ? 0.5 : 0.7} vectorEffect="non-scaling-stroke" strokeWidth={active ? 2.25 : 1.5}
                strokeDasharray={s === 'running' ? '4 4' : undefined} className={s === 'running' ? 'swarm-flow' : undefined} />
            )
          })}
        </svg>
        {/* coordinator */}
        <button onClick={() => onSel(coord.id)} className="absolute left-1/2 top-0 -translate-x-1/2">
          <div className={cn('flex items-center gap-2 rounded-[12px] bg-slab-2 px-3 py-2 transition-shadow',
            sel === coord.id ? 'shadow-[0_0_0_1.5px_var(--brass),0_0_30px_-6px_rgb(var(--glow)/.5)]' : 'shadow-[0_0_0_1px_rgb(var(--glow)/.35),0_0_30px_-8px_rgb(var(--glow)/.35)]')}>
            <span className="grid size-6 place-items-center rounded-[7px] bg-brass/15 text-brass"><Network size={13} /></span>
            <span className="text-[13px] font-semibold">Coordinator</span><Logo name="openai" size={13} />
            <StatusDot status={st(coord)} />
          </div>
        </button>
        {/* children */}
        {kids.map((k, i) => {
          const s = st(k), active = sel === k.id, m = getMachine(k.machine)
          return (
            <motion.div key={k.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
              className="group absolute bottom-0 -translate-x-1/2" style={{ left: `${xs[i]}%` }}>
              <button onClick={() => onSel(k.id)}
                className={cn('flex w-[124px] flex-col items-center gap-1 rounded-[12px] px-2 py-2 text-center transition-[background,box-shadow]',
                  active ? 'bg-slab-2 shadow-[0_0_0_1.5px_var(--brass)]' : 'bg-slab hover:bg-slab-2')}>
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                  {s === 'done' ? <Check size={12} className="text-sage" /> : <StatusDot status={s} />}{k.name}
                </span>
                <span className="text-[11px]" style={{ color: s === 'idle' ? 'var(--ash)' : statusVar[s] }}>{paused.includes(k.id) ? 'paused' : statusWord[k.status]}</span>
                {k.status === 'running' && !paused.includes(k.id) && <span className="mt-0.5 h-[3px] w-[80%] overflow-hidden rounded-full bg-seam"><span className="block h-full rounded-full bg-brass" style={{ width: `${k.progress * 100}%` }} /></span>}
                <span className={cn('flex items-center gap-1 text-[10.5px]', kindMeta[m.kind].color)}><MachineMark m={m} size={14} className="border-0 bg-transparent" />{m.name}</span>
              </button>
              {/* quick actions appear on hover */}
              <div className="pointer-events-none absolute -top-3 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-[8px] bg-lift p-0.5 opacity-0 shadow-[0_6px_16px_-4px_rgb(0_0_0/.5)] transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                {k.status === 'running' && <Tip label={paused.includes(k.id) ? 'Resume' : 'Pause'}><button onClick={() => onPause(k.id)} className="grid size-6 place-items-center rounded-[6px] text-dust hover:bg-slab-2 hover:text-bone">{paused.includes(k.id) ? <Play size={11} /> : <Pause size={11} />}</button></Tip>}
                <Tip label="Message"><button onClick={() => onSel(k.id)} className="grid size-6 place-items-center rounded-[6px] text-dust hover:bg-slab-2 hover:text-bone"><Send size={11} /></button></Tip>
                <Tip label="Open session"><button onClick={() => useApp.getState().openSession(k.session)} className="grid size-6 place-items-center rounded-[6px] text-dust hover:bg-slab-2 hover:text-bone"><ArrowUpRight size={11} /></button></Tip>
              </div>
            </motion.div>
          )
        })}
      </div>
      <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1 text-meta text-ash">
        {(['running', 'waiting', 'done', 'idle'] as Status[]).map((s) => <span key={s} className="flex items-center gap-1.5"><span className="size-[7px] rounded-full" style={{ background: statusVar[s] }} />{statusWord[s]}</span>)}
        <span className="ml-auto">Click an agent to inspect it. Hover for quick actions.</span>
      </div>
    </section>
  )
}

function AgentDetail({ a, paused, onPause }: { a: Agent; paused: boolean; onPause: () => void }) {
  const { openSession } = useApp()
  const m = getMachine(a.machine), md = getModel(a.model)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => { if (a.status !== 'running' || paused) return; const t = setInterval(() => setTick((x) => x + 1), 1800); return () => clearInterval(t) }, [a.id, a.status, paused])
  const liveLines = ['Writing paint/livery.rs', 'Sampling 6 reference photos', 'Rendering preview frame 12/30', 'Comparing against reference']
  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-seam bg-soot lg:flex xl:w-[360px]">
      <AnimatePresence mode="wait">
        <motion.div key={a.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }} className="flex min-h-0 flex-1 flex-col">
          <div className="px-5 pb-4 pt-6">
            <div className="flex items-center gap-2"><StatusDot status={paused ? 'idle' : a.status} /><span className="text-[17px] font-semibold tracking-[-0.01em]">{a.name}</span></div>
            <div className="mt-0.5 text-sec text-ash">{a.role}</div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Button size="sm" variant="primary" onClick={() => openSession(a.session)}><ArrowUpRight size={13} />Open session</Button>
              {a.status === 'running' && <Button size="sm" onClick={onPause}>{paused ? <><Play size={13} />Resume</> : <><Pause size={13} />Pause</>}</Button>}
              <Tip label="Move to another machine"><IconButton size="sm"><ArrowRightLeft size={14} /></IconButton></Tip>
              <Tip label="Restart"><IconButton size="sm"><RotateCcw size={14} /></IconButton></Tip>
              <Tip label="Stop"><IconButton size="sm" className="hover:text-rose"><Square size={13} /></IconButton></Tip>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px bg-seam/60 text-center">
            {[['Tokens', a.tokens], ['Cost', a.cost], ['Time', a.time.replace(' ago', '')]].map(([k, v]) => (
              <div key={k} className="bg-soot px-2 py-3"><div className="text-meta text-ash">{k}</div><div className="text-[14px] font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 px-5 py-4 text-sec">
            <div className="flex items-center justify-between"><span className="text-ash">Model</span><span className="flex items-center gap-1.5"><Logo name={md.provider} size={13} tinted />{md.name}</span></div>
            <div className="flex items-center justify-between"><span className="text-ash">Runs on</span><span className={cn('flex items-center gap-1.5', kindMeta[m.kind].color)}><MachineMark m={m} size={18} className="border-0 bg-transparent" />{m.name}</span></div>
            {a.status !== 'idle' && <div><div className="mb-1.5 flex justify-between"><span className="text-ash">Progress</span><span>{Math.round(a.progress * 100)}%</span></div><Meter value={a.progress} tone={a.status === 'waiting' ? 'ember' : a.status === 'done' ? 'sage' : 'brass'} /></div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            <div className="mb-2 text-[13px] font-semibold">Activity</div>
            {a.status === 'running' && !paused && (
              <div className="mb-1 flex items-center gap-3 rounded-[10px] bg-brass/[0.08] px-3 py-2 text-sec">
                <span className="breathe size-[6px] rounded-full bg-brass" />
                <AnimatePresence mode="wait"><motion.span key={tick} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className="text-bone">{liveLines[tick % liveLines.length]}</motion.span></AnimatePresence>
              </div>
            )}
            {a.activity.length === 0 && <div className="py-4 text-sec text-ash">Nothing yet. This agent starts when its dependencies finish.</div>}
            {[...a.activity].reverse().map((x, i) => (
              <div key={i} className="flex items-start gap-3 py-2 text-sec">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slab-2 text-dust"><x.icon size={12} /></span>
                <span className="flex-1 text-dust">{x.text}</span><span className="text-meta text-ash">{x.t}</span>
              </div>
            ))}
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-[14px] bg-slab-2 py-1.5 pl-3.5 pr-1.5">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && msg) { toast(`Sent to ${a.name}`, { description: msg }); setMsg('') } }}
                placeholder={`Message ${a.name}`} className="min-w-0 flex-1 bg-transparent text-ui outline-none placeholder:text-ash" />
              <button disabled={!msg} onClick={() => { toast(`Sent to ${a.name}`, { description: msg }); setMsg('') }} className="grid size-7 place-items-center rounded-full bg-brass text-brass-ink disabled:opacity-30"><Send size={13} /></button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}


/* ---------------------------------- Apps ---------------------------------- */
export function AppsView() {
  const apps: { logo: LogoName; name: string; desc: string; on: boolean }[] = [
    { logo: 'github', name: 'GitHub', desc: 'Pull requests, issues and reviews', on: true },
    { logo: 'gmail', name: 'Gmail', desc: 'Read and draft email', on: true },
    { logo: 'calendar', name: 'Google Calendar', desc: 'See and create events', on: false },
    { logo: 'sheets', name: 'Google Sheets', desc: 'Read and edit spreadsheets', on: false },
    { logo: 'figma', name: 'Figma', desc: 'Designs, components and variables', on: true },
    { logo: 'cloudflare', name: 'Cloudflare', desc: 'Workers, storage and deploys', on: true },
  ]
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[980px] px-6 pb-16 pt-8 md:px-10 md:pt-10">
        <PageHead title="Apps and tools" desc="Services your agents can use. Connect once, available on every machine."
          actions={<div className="hidden h-9 w-[260px] items-center gap-2 rounded-[10px] bg-soot px-3 text-sec text-ash md:flex"><Search size={14} />Search apps and MCP servers</div>} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((a, i) => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex flex-col gap-4 rounded-[16px] bg-soot p-4">
              <div className="flex items-start justify-between"><LogoTile name={a.logo} size={40} />
                {a.on ? <Badge tone="sage"><Check size={10} strokeWidth={3} />Connected</Badge> : <Button size="xs">Connect</Button>}</div>
              <div><div className="text-[14px] font-semibold">{a.name}</div><div className="text-sec text-ash">{a.desc}</div></div>
            </motion.div>
          ))}
        </div>

        <h2 className="mb-3 mt-10 text-[14px] font-semibold">MCP servers</h2>
        <div className="overflow-hidden rounded-[16px] bg-soot">
          {[
            { logo: 'figma' as LogoName, n: 'figma', d: '24 tools over HTTP', s: 'ok' },
            { logo: 'cloudflare' as LogoName, n: 'cloudflare', d: '31 tools, signed in with OAuth', s: 'ok' },
            { logo: 'postgres' as LogoName, n: 'postgres-local', d: 'Could not start: port 5432 is in use', s: 'err' },
          ].map((m, i) => (
            <div key={m.n} className={cn('flex items-center gap-4 px-4 py-3', i > 0 && 'border-t border-seam')}>
              <LogoTile name={m.logo} size={32} />
              <div className="flex-1"><div className="font-mono text-[13px]">{m.n}</div><div className={cn('text-sec', m.s === 'err' ? 'text-rose' : 'text-ash')}>{m.d}</div></div>
              {m.s === 'err' ? <Button size="sm">Retry</Button> : <Switch defaultChecked />}
            </div>
          ))}
          <button className="flex w-full items-center gap-3 border-t border-seam px-4 py-3 text-sec text-dust hover:bg-slab hover:text-bone"><Plus size={15} />Add an MCP server</button>
        </div>

        <h2 className="mb-3 mt-10 text-[14px] font-semibold">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {['compose', 'frontend-design', 'cloudflare', 'verification', 'hyperframes', 'shadcn', 'nextjs', 'workers-best-practices'].map((s, i) => (
            <span key={s} className={cn('rounded-full border px-3 py-1 text-sec', i === 0 ? 'border-brass/35 bg-brass/10 text-brass' : 'border-seam bg-soot text-dust')}>{s}</span>
          ))}
          <span className="rounded-full border border-dashed border-seam-2 px-3 py-1 text-sec text-ash">94 more</span>
        </div>
      </div>
    </div>
  )
}
