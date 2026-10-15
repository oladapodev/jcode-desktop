import { motion } from 'motion/react'
import { Network, Moon, Zap, Clock3, ScanEye, Plus, Pause, Check, CircleHelp, ArrowUpRight, Search, Brain } from 'lucide-react'
import { useApp, getMachine, getModel } from '@/lib/store'
import { kindMeta } from '@/lib/data'
import { PageHead } from './Machines'
import { Logo, LogoTile, type LogoName } from '@/components/logos'
import { Button, Switch, Badge, StatusDot, Meter } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { cn } from '@/lib/cn'

/* --------------------------------- Agents --------------------------------- */
export function AgentsView() {
  const { sessions, openSession } = useApp()
  const live = sessions.filter((s) => s.status === 'running' || s.status === 'waiting')
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[980px] px-10 pb-16 pt-10">
        <PageHead title="Agents" desc="Everything running right now, on every machine."
          actions={<Button variant="primary"><Network size={15} />New swarm</Button>} />

        <SwarmGraph />

        <h2 className="mb-3 mt-10 text-[14px] font-semibold">Live sessions</h2>
        <div className="grid grid-cols-2 gap-3">
          {live.map((s, i) => {
            const m = getMachine(s.machine), md = getModel(s.model)
            const p = s.status === 'running' ? 0.6 : 0.4
            return (
              <motion.button key={s.id} onClick={() => openSession(s.id)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="group flex flex-col gap-3.5 rounded-[16px] border border-seam bg-soot p-4 text-left transition-colors hover:border-seam-2 hover:bg-slab">
                <div className="flex items-start gap-3">
                  <StatusDot status={s.status} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{s.title}</div>
                    <div className="text-sec text-ash">{s.project}</div>
                  </div>
                  <ArrowUpRight size={15} className="text-ash opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                {s.status === 'waiting' ? (
                  <div className="flex items-center gap-2 rounded-[10px] border border-ember/25 bg-ember/[0.06] px-3 py-2 text-sec text-ember"><CircleHelp size={14} />{s.id === 'ship' ? 'Wants approval to run the database migration' : 'Asked which license the photos should use'}</div>
                ) : (
                  <div><div className="mb-1.5 flex justify-between text-meta text-ash"><span>3 of 5 steps</span><span>12 min</span></div><Meter value={p} /></div>
                )}
                <div className="flex items-center gap-3 text-meta text-ash">
                  <span className="flex items-center gap-1.5"><Logo name={md.provider} size={13} tinted />{md.name}</span>
                  <span className={cn('flex items-center gap-1.5', kindMeta[m.kind].color)}><MachineMark m={m} size={16} className="border-0 bg-transparent" />{m.name}</span>
                  {s.agents && <span className="ml-auto flex items-center gap-1"><Network size={12} />{s.agents} agents</span>}
                </div>
              </motion.button>
            )
          })}
        </div>

        <h2 className="mb-3 mt-10 text-[14px] font-semibold">Automations</h2>
        <div className="overflow-hidden rounded-[16px] border border-seam bg-soot">
          {[
            { icon: Moon, t: 'Overnight runs', d: 'Keep improving on gcp-home until 7am, then send a summary', on: false },
            { icon: Zap, t: 'Auto-continue', d: 'Keep going while the plan still has unfinished steps', on: true },
            { icon: Brain, t: 'Ambient mode', d: 'Watch the repo and pick up small fixes on its own', on: true },
            { icon: ScanEye, t: 'Auto review', d: 'A second agent reviews each finished task before you see it', on: false },
            { icon: Clock3, t: 'Scheduled tasks', d: 'Dependency updates every Monday at 9:00', on: true },
          ].map((a, i) => (
            <div key={a.t} className={cn('flex items-center gap-4 px-4 py-3.5', i > 0 && 'border-t border-seam')}>
              <span className="grid size-9 place-items-center rounded-[10px] border border-seam-2 bg-slab-2 text-dust"><a.icon size={16} /></span>
              <div className="flex-1"><div className="text-[13.5px] font-medium">{a.t}</div><div className="text-sec text-ash">{a.d}</div></div>
              <Switch defaultChecked={a.on} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SwarmGraph() {
  const kids = [
    { n: 'References', s: 'done', x: 8 }, { n: 'Geometry', s: 'done', x: 25 }, { n: 'Textures', s: 'running', x: 42 },
    { n: 'Lighting', s: 'running', x: 58 }, { n: 'Tests', s: 'waiting', x: 75 }, { n: 'Review', s: 'idle', x: 92 },
  ] as const
  const col = { done: 'var(--sage)', running: 'var(--brass)', waiting: 'var(--ember)', idle: 'var(--seam-2)' }
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-seam bg-soot px-6 pb-6 pt-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--seam)_1px,transparent_0)] [background-size:18px_18px] opacity-50" />
      <div className="relative mb-5 flex items-center gap-3">
        <span className="text-[14px] font-semibold">Realistic Korope render</span>
        <Badge tone="brass"><Network size={10} />6 agents</Badge>
        <span className="text-sec text-ash">coordinator on This laptop</span>
        <div className="ml-auto flex gap-1.5"><Button size="sm" variant="ghost"><Pause size={13} />Pause all</Button><Button size="sm"><Plus size={13} />Add agent</Button></div>
      </div>
      <div className="relative h-[180px]">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {kids.map((k, i) => (
            <motion.path key={k.n} d={`M50 24 C 50 50, ${k.x} 42, ${k.x} 66`} fill="none" stroke={col[k.s]} strokeOpacity={k.s === 'idle' ? 0.6 : 0.75}
              vectorEffect="non-scaling-stroke" strokeWidth={1.5} strokeDasharray={k.s === 'running' ? '4 4' : undefined}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }} />
          ))}
        </svg>
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-[12px] border border-brass/40 bg-slab-2 px-3 py-2 shadow-[0_0_30px_-6px_rgb(var(--glow)/.4)]">
            <span className="grid size-6 place-items-center rounded-[7px] bg-brass/15 text-brass"><Network size={13} /></span>
            <span className="text-[13px] font-semibold">Coordinator</span><Logo name="openai" size={13} />
          </div>
        </div>
        {kids.map((k, i) => (
          <motion.div key={k.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
            className="absolute bottom-0 -translate-x-1/2" style={{ left: `${k.x}%` }}>
            <div className="flex w-[108px] flex-col items-center gap-1 rounded-[11px] border border-seam bg-slab px-2 py-2 text-center">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                {k.s === 'done' ? <Check size={12} className="text-sage" /> : <StatusDot status={k.s} />}{k.n}
              </span>
              <span className="text-[11px] text-ash">{k.s === 'done' ? 'finished' : k.s === 'running' ? 'working' : k.s === 'waiting' ? 'needs you' : 'queued'}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
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
      <div className="mx-auto max-w-[980px] px-10 pb-16 pt-10">
        <PageHead title="Apps and tools" desc="Services your agents can use. Connect once, available on every machine."
          actions={<div className="flex h-9 w-[260px] items-center gap-2 rounded-[10px] border border-seam bg-soot px-3 text-sec text-ash"><Search size={14} />Search apps and MCP servers</div>} />
        <div className="grid grid-cols-3 gap-3">
          {apps.map((a, i) => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex flex-col gap-4 rounded-[16px] border border-seam bg-soot p-4">
              <div className="flex items-start justify-between"><LogoTile name={a.logo} size={40} />
                {a.on ? <Badge tone="sage"><Check size={10} strokeWidth={3} />Connected</Badge> : <Button size="xs">Connect</Button>}</div>
              <div><div className="text-[14px] font-semibold">{a.name}</div><div className="text-sec text-ash">{a.desc}</div></div>
            </motion.div>
          ))}
        </div>

        <h2 className="mb-3 mt-10 text-[14px] font-semibold">MCP servers</h2>
        <div className="overflow-hidden rounded-[16px] border border-seam bg-soot">
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
