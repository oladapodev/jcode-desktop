import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  SquarePen, Search, Network, Server, LayoutGrid, Settings2, ChevronRight, GitBranch, Plus, FolderOpen,
  FolderGit2, Clock3, ChevronsUpDown, Check, Cloud, LogOut, Sparkles, Radio, Home,
} from 'lucide-react'
import { useApp, getMachine } from '@/lib/store'
import { projects as seedProjects, machines, kindMeta } from '@/lib/data'
import { Kbd, Tip, StatusDot, Popover, PopoverTrigger, PopoverContent, Row, Hr, Badge } from '@/components/ui'
import { JMark, MachineMark } from '@/components/marks'
import { cn } from '@/lib/cn'

export function Sidebar() {
  const { view, go, sessionId, sessions, openSession, set, machine, stream } = useApp()
  const [projects, setProjects] = useState(seedProjects)
  const running = sessions.filter((s) => s.status === 'running' || s.status === 'waiting').length
  const nav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'agents', label: 'Agents', icon: Network, badge: running },
    { id: 'machines', label: 'Machines', icon: Server },
    { id: 'apps', label: 'Apps & tools', icon: LayoutGrid },
  ] as const

  return (
    <aside className="relative flex h-full w-full flex-col bg-soot">
      {/* Workspace header (also the window drag region) */}
      <div className="flex h-[52px] items-center gap-2.5 px-3.5">
        <JMark size={22} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight tracking-[-0.01em]">Jcode</div>
          <div className="flex items-center gap-1 text-[11px] leading-tight text-ash">
            <span className="size-[5px] rounded-full bg-sage" /> Synced across 3 devices
          </div>
        </div>
        {stream && (
          <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1 rounded-[6px] bg-rose px-1.5 py-[2px] text-[10px] font-bold tracking-wide text-white">
            <Radio size={10} /> LIVE
          </motion.span>
        )}
      </div>

      {/* Primary actions */}
      <div className="flex gap-1.5 px-2.5 pb-2">
        <button
          onClick={() => go('home')}
          className="group flex h-9 flex-1 items-center gap-2 rounded-[10px] border border-seam-2 bg-slab px-2.5 text-ui font-medium shadow-[inset_0_1px_0_rgb(255_255_255/.04),0_1px_2px_rgb(0_0_0/.25)] transition-colors hover:bg-slab-2"
        >
          <SquarePen size={15} className="text-brass" />
          New session
          <span className="ml-auto opacity-70 transition-opacity group-hover:opacity-100"><Kbd>Ctrl</Kbd> <Kbd>N</Kbd></span>
        </button>
        <Tip label="Search everything" keys="Ctrl K">
          <button onClick={() => set({ palette: true })}
            className="grid size-9 place-items-center rounded-[10px] border border-seam bg-slab text-dust transition-colors hover:bg-slab-2 hover:text-bone">
            <Search size={15} />
          </button>
        </Tip>
      </div>

      {/* Nav with sliding active pill */}
      <nav className="flex flex-col gap-px px-2.5">
        {nav.map((n) => {
          const active = view === n.id
          return (
            <button key={n.id} onClick={() => go(n.id)}
              className={cn('relative flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-ui transition-colors', active ? 'text-bone' : 'text-dust hover:text-bone')}>
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-[8px] bg-slab-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <n.icon size={15} className={cn('relative', active && 'text-brass')} />
              <span className="relative">{n.label}</span>
              {'badge' in n && n.badge > 0 && (
                <span className="relative ml-auto flex items-center gap-1.5 text-meta text-ash">
                  <StatusDot status="running" />{n.badge} live
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Projects */}
      <div className="mt-4 flex items-center justify-between px-5 pb-1">
        <span className="text-meta font-medium text-ash">Projects</span>
        <Popover>
          <Tip label="Add project"><PopoverTrigger asChild>
            <button className="grid size-5 place-items-center rounded-[5px] text-ash hover:bg-slab-2 hover:text-bone"><Plus size={13} /></button>
          </PopoverTrigger></Tip>
          <PopoverContent className="w-[240px]">
            <Row icon={<FolderOpen size={15} />} title="Open a folder" hint="From this laptop" />
            <Row icon={<FolderGit2 size={15} />} title="Clone a repository" hint="GitHub, GitLab or a URL" />
            <Row icon={<Cloud size={15} />} title="Open on a machine" hint="Browse gcp-home or a sandbox" />
          </PopoverContent>
        </Popover>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {projects.map((p, i) => {
          const list = sessions.filter((s) => s.project === p.id)
          return (
            <div key={p.id} className="mb-0.5">
              <button
                onClick={() => setProjects(projects.map((x, j) => (j === i ? { ...x, open: !x.open } : x)))}
                className="group flex h-[30px] w-full items-center gap-1.5 rounded-[8px] px-1.5 text-ui text-dust hover:bg-slab hover:text-bone"
              >
                <motion.span animate={{ rotate: p.open ? 90 : 0 }} transition={{ duration: 0.18 }} className="text-ash"><ChevronRight size={13} /></motion.span>
                <span className="font-medium text-bone/90">{p.name}</span>
                <span className="ml-auto flex items-center gap-1 text-[11px] text-ash opacity-0 transition-opacity group-hover:opacity-100">
                  <GitBranch size={11} />{p.branch}{p.dirty > 0 && <span className="text-ember">{p.dirty}</span>}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {p.open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    {list.map((s) => {
                      const active = s.id === sessionId && view === 'chat'
                      const m = getMachine(s.machine)
                      return (
                        <button key={s.id} onClick={() => openSession(s.id)}
                          className={cn('group relative ml-[13px] flex h-[30px] w-[calc(100%-13px)] items-center gap-2 rounded-[8px] pl-3 pr-2 text-left text-[13px]',
                            active ? 'bg-slab-2 text-bone' : 'text-dust hover:bg-slab hover:text-bone')}>
                          <span className={cn('absolute left-0 top-1 bottom-1 w-px', active ? 'bg-brass' : 'bg-seam')} />
                          <StatusDot status={s.status} />
                          <span className={cn('min-w-0 flex-1 truncate', s.unread && 'font-medium text-bone')}>{s.title}</span>
                          {m.kind !== 'local' && <span className={cn('size-[5px] rounded-full', kindMeta[m.kind].ring)} title={m.name} />}
                          {s.agents ? <span className="flex items-center gap-0.5 text-[11px] text-ash"><Network size={11} />{s.agents}</span>
                            : <span className="text-[11px] text-ash">{s.updated}</span>}
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
        <button onClick={() => set({ palette: true })} className="mt-2 flex h-[30px] w-full items-center gap-2 rounded-[8px] px-2 text-[13px] text-ash hover:bg-slab hover:text-dust">
          <Clock3 size={14} /> All past sessions
        </button>
      </div>

      {/* Footer: where new work runs, then account */}
      <div className="border-t border-seam p-2.5">
        <MachineSwitcher />
        <AccountRow />
      </div>
      {/* reference to machine to keep re-render on change */}
      <span className="hidden">{machine}</span>
    </aside>
  )
}

function MachineSwitcher() {
  const { machine, set, go } = useApp()
  const m = getMachine(machine)
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-[10px] border border-seam bg-slab p-2 text-left transition-colors hover:border-seam-2 hover:bg-slab-2">
          <MachineMark m={m} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] leading-tight text-ash">New sessions run on</span>
            <span className="block truncate text-ui font-medium leading-tight">{m.name}</span>
          </span>
          <ChevronsUpDown size={14} className="text-ash" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[300px]">
        <MachineList value={machine} onPick={(id) => { set({ machine: id }); setOpen(false) }} />
        <Hr className="my-1.5" />
        <Row icon={<Plus size={15} />} title="Add a machine" onClick={() => { setOpen(false); set({ addMachine: true }) }} />
        <Row icon={<Server size={15} />} title="Manage machines" onClick={() => { setOpen(false); go('machines') }} />
      </PopoverContent>
    </Popover>
  )
}

export function MachineList({ value, onPick }: { value: string; onPick: (id: string) => void }) {
  return (
    <div>
      {(['local', 'vm', 'sandbox', 'ssh'] as const).map((k) => {
        const list = machines.filter((m) => m.kind === k)
        if (!list.length) return null
        return (
          <div key={k}>
            <div className={cn('px-2 pb-0.5 pt-1.5 text-[11px] font-medium', kindMeta[k].color)}>{kindMeta[k].label}</div>
            {list.map((m) => (
              <Row key={m.id} onClick={() => onPick(m.id)} active={m.id === value}
                icon={<MachineMark m={m} size={26} />}
                title={m.name}
                hint={m.status === 'on-demand' ? 'Starts when you need it' : m.status === 'sleeping' ? 'Asleep, wakes on connect' : `${m.cpu}, ${Math.round(m.load * 100)}% busy${m.latency ? `, ${m.latency} ms` : ''}`}
                right={m.id === value ? <Check size={15} className="text-brass" /> : undefined}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function AccountRow() {
  const { go } = useApp()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="mt-1.5 flex w-full items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-slab">
          <span className="grid size-7 place-items-center rounded-full bg-[conic-gradient(from_200deg,#e0b46c,#b77f3b,#6d4b25,#e0b46c)] text-[12px] font-bold text-brass-ink">D</span>
          <span className="min-w-0 flex-1">
            <span className="block text-ui font-medium leading-tight">dev</span>
            <span data-secret className="block truncate text-[11px] leading-tight text-ash">dev@example.com</span>
          </span>
          <Badge tone="brass">Pro</Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[250px]">
        <Row icon={<Settings2 size={15} />} title="Settings" right={<span className="flex gap-0.5"><Kbd>Ctrl</Kbd><Kbd>,</Kbd></span>} onClick={() => go('settings', 'general')} />
        <Row icon={<Sparkles size={15} />} title="Models and logins" onClick={() => go('settings', 'models')} />
        <Row icon={<Cloud size={15} />} title="Account and sync" onClick={() => go('settings', 'account')} />
        <Hr className="my-1.5" />
        <Row icon={<LogOut size={15} />} title="Sign out" tone="muted" />
      </PopoverContent>
    </Popover>
  )
}
