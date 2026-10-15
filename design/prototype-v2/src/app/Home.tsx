import { motion } from 'motion/react'
import { Bug, Network, ScanEye, Moon, GitBranch, FolderClosed, ChevronDown, ArrowUpRight, Plus, Check } from 'lucide-react'
import { useApp, getMachine } from '@/lib/store'
import { projects, kindMeta } from '@/lib/data'
import { Composer } from './Composer'
import { MachineList } from './Sidebar'
import { JMark, MachineMark } from '@/components/marks'
import { Popover, PopoverTrigger, PopoverContent, Row, StatusDot, Hr } from '@/components/ui'
import { cn } from '@/lib/cn'

const starts = [
  { icon: Bug, title: 'Fix a failing test', desc: 'Run the suite, find the cause, patch it', prompt: 'Run the tests and fix whatever fails' },
  { icon: Network, title: 'Split work across agents', desc: 'A swarm takes the big task in parallel', prompt: '/swarm ' },
  { icon: ScanEye, title: 'Review my changes', desc: 'A second opinion on the current diff', prompt: '/review' },
  { icon: Moon, title: 'Work while I sleep', desc: 'Runs on gcp-home, reports in the morning', prompt: '/overnight ' },
]

export function HomeView() {
  const { machine, set, sessions, openSession } = useApp()
  const m = getMachine(machine)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const live = sessions.filter((s) => s.status !== 'idle').slice(0, 3)
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {/* soft light from above, the only decorative gradient in the app */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--glow)/.09),transparent)]" />
      <div className="@container relative mx-auto flex max-w-[720px] flex-col px-6 pb-16 pt-[9vh] md:px-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <JMark size={34} className="mb-5" />
          <h1 className="m-0 text-[30px] font-semibold leading-tight tracking-[-0.025em]">{greet}, dev.</h1>
          <p className="mb-7 mt-1.5 text-[15px] text-dust">Two agents are working and one needs your answer.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <Composer variant="hero" running={false} />
          {/* context: where the new session will start */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sec">
            <Popover>
              <PopoverTrigger asChild><Chip><FolderClosed size={13} className="text-brass" />tasued<ChevronDown size={12} className="text-ash" /></Chip></PopoverTrigger>
              <PopoverContent className="w-[240px]">
                {projects.map((p) => <Row key={p.id} title={p.name} hint={`${p.branch}${p.dirty ? `, ${p.dirty} uncommitted` : ''}`} icon={<FolderClosed size={15} />} right={p.id === 'tasued' ? <Check size={15} className="text-brass" /> : undefined} />)}
                <Hr className="my-1" /><Row icon={<Plus size={15} />} title="Open another folder" tone="muted" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild><Chip><MachineMark m={m} size={18} className="rounded-[5px] border-0 bg-transparent" /><span className={kindMeta[m.kind].color}>{m.name}</span><ChevronDown size={12} className="text-ash" /></Chip></PopoverTrigger>
              <PopoverContent className="w-[300px]"><MachineList value={machine} onPick={(id) => set({ machine: id })} /></PopoverContent>
            </Popover>
            <Chip><GitBranch size={13} className="text-dust" />master</Chip>
            <Chip className="text-ash"><Plus size={13} />New worktree</Chip>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="mt-10 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {starts.map((s) => (
            <button key={s.title} className="group flex items-start gap-3 rounded-[14px] bg-soot p-3.5 text-left transition-colors hover:bg-slab">
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-slab-2 text-dust transition-colors group-hover:text-brass"><s.icon size={15} /></span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">{s.title}</span>
                <span className="block text-sec text-ash">{s.desc}</span>
              </span>
            </button>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-10">
          <h2 className="mb-2 text-[13px] font-semibold text-dust">Pick up where you left off</h2>
          <div className="overflow-hidden rounded-[14px] bg-soot">
            {live.map((s, i) => {
              const mm = getMachine(s.machine)
              return (
                <button key={s.id} onClick={() => openSession(s.id)}
                  className={cn('group flex w-full items-center gap-3 bg-soot px-3.5 py-3 text-left transition-colors hover:bg-slab', i > 0 && 'border-t border-seam')}>
                  <StatusDot status={s.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{s.title}</span>
                    <span className="block text-sec text-ash">
                      {s.status === 'waiting' ? <span className="text-ember">Waiting for your answer</span> : s.status === 'running' ? 'Working now' : 'Finished'}
                      <span className="mx-1.5 text-seam-2">/</span>{s.project}
                    </span>
                  </span>
                  <span className={cn('flex items-center gap-1.5 text-sec', kindMeta[mm.kind].color)}><MachineMark m={mm} size={20} className="border-0 bg-transparent" />{mm.name}</span>
                  <ArrowUpRight size={14} className="text-ash opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Chip({ children, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className={cn('flex h-[30px] items-center gap-1.5 rounded-full border border-seam bg-soot px-3 text-dust transition-colors hover:border-seam-2 hover:text-bone', className)}>
      {children}
    </button>
  )
}
