import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Command } from 'cmdk'
import * as Icons from 'lucide-react'
import { Search, SquarePen, Network, Server, Radio, Palette as PaletteIcon, KeyRound, Columns2, SquareTerminal, GitFork, Plus, Settings2, CornerDownLeft } from 'lucide-react'
import { useApp, getMachine } from '@/lib/store'
import { machines, kindMeta, slashCommands } from '@/lib/data'
import { StatusDot, Kbd, Dialog } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

/* ------------------------------ Command palette ------------------------------ */
export function Palette() {
  const s = useApp()
  const run = (fn: () => void) => { s.set({ palette: false }); setTimeout(fn, 10) }
  const item = 'flex h-10 cursor-default items-center gap-3 rounded-[10px] px-2.5 text-ui text-dust data-[selected=true]:bg-slab-2 data-[selected=true]:text-bone'
  const group = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ash'
  const Ico = ({ children }: { children: React.ReactNode }) => <span className="grid size-7 place-items-center rounded-[8px] border border-seam bg-slab text-dust">{children}</span>
  return (
    <Dialog open={s.palette} onOpenChange={(v) => s.set({ palette: v })} title="Search" className="top-[12vh] w-[640px] p-0">
      <Command loop className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-seam px-4">
          <Search size={17} className="text-ash" />
          <Command.Input autoFocus placeholder="Search sessions, actions, machines and settings" className="h-[54px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-ash" />
          <Kbd>Esc</Kbd>
        </div>
        <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
          <Command.Empty className="px-4 py-10 text-center text-sec text-ash">Nothing matches. Try a session name or a command like “fork”.</Command.Empty>
          <Command.Group heading="Sessions" className={group}>
            {s.sessions.map((x) => {
              const m = getMachine(x.machine)
              return (
                <Command.Item key={x.id} value={`session ${x.title} ${x.project}`} onSelect={() => run(() => s.openSession(x.id))} className={item}>
                  <span className="grid size-7 place-items-center"><StatusDot status={x.status} /></span>
                  <span className="flex-1 truncate text-bone">{x.title}</span>
                  <span className="text-sec text-ash">{x.project}</span>
                  <span className={cn('text-sec', kindMeta[m.kind].color)}>{m.name}</span>
                </Command.Item>
              )
            })}
          </Command.Group>
          <Command.Group heading="Actions" className={group}>
            {[
              [SquarePen, 'New session', () => s.go('home'), 'Ctrl N'],
              [Network, 'Start a swarm', () => s.go('agents'), ''],
              [SquareTerminal, 'Open terminal', () => s.openInspector('terminal'), ''],
              [GitFork, 'Fork this session', () => toast('Forked into a new session'), ''],
              [Columns2, 'Switch to canvas layout', () => s.set({ layout: 'canvas', view: 'chat' }), ''],
              [Radio, s.stream ? 'Turn off stream mode' : 'Turn on stream mode', () => s.set({ stream: !s.stream }), ''],
            ].map(([I, label, fn, k]) => {
              const Icon = I as typeof Search
              return (
                <Command.Item key={label as string} value={label as string} onSelect={() => run(fn as () => void)} className={item}>
                  <Ico><Icon size={14} /></Ico><span className="flex-1">{label as string}</span>{k && <span className="flex gap-0.5">{(k as string).split(' ').map((x) => <Kbd key={x}>{x}</Kbd>)}</span>}
                </Command.Item>
              )
            })}
          </Command.Group>
          <Command.Group heading="Run new sessions on" className={group}>
            {machines.map((m) => (
              <Command.Item key={m.id} value={`machine ${m.name} ${kindMeta[m.kind].label}`} onSelect={() => run(() => { s.set({ machine: m.id }); toast(`New sessions will run on ${m.name}`) })} className={item}>
                <MachineMark m={m} size={26} /><span className="flex-1">{m.name}</span><span className={cn('text-sec', kindMeta[m.kind].color)}>{kindMeta[m.kind].label}</span>
              </Command.Item>
            ))}
            <Command.Item value="add machine" onSelect={() => run(() => { s.go('machines'); s.set({ addMachine: true }) })} className={item}><Ico><Plus size={14} /></Ico>Add a machine</Command.Item>
          </Command.Group>
          <Command.Group heading="Commands" className={group}>
            {slashCommands.flatMap((g) => g.items).map((c) => {
              const I = (Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Settings2
              return (
                <Command.Item key={c.cmd} value={`/${c.cmd} ${c.desc}`} onSelect={() => run(() => toast(`/${c.cmd}`, { description: c.desc }))} className={item}>
                  <Ico><I size={14} /></Ico><span className="font-medium text-bone">/{c.cmd}</span><span className="truncate text-sec text-ash">{c.desc}</span>
                </Command.Item>
              )
            })}
          </Command.Group>
          <Command.Group heading="Settings" className={group}>
            {[[PaletteIcon, 'Theme and fonts', 'appearance'], [KeyRound, 'Models and logins', 'models'], [Server, 'Machine defaults', 'machines'], [Radio, 'Stream mode', 'stream']].map(([I, l, p]) => {
              const Icon = I as typeof Search
              return <Command.Item key={l as string} value={`settings ${l}`} onSelect={() => run(() => s.go('settings', p as string))} className={item}><Ico><Icon size={14} /></Ico>{l as string}</Command.Item>
            })}
          </Command.Group>
        </Command.List>
        <div className="flex items-center gap-4 border-t border-seam px-4 py-2.5 text-meta text-ash">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>move</span>
          <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft size={10} /></Kbd>open</span>
          <span className="ml-auto">Type / for commands</span>
        </div>
      </Command>
    </Dialog>
  )
}

/* --------------------------------- Canvas --------------------------------- */
export function CanvasView() {
  const { sessions, set, openSession } = useApp()
  const [focus, setFocus] = useState(0)
  const panels = [...sessions.slice(0, 2), { id: 'term', title: 'Terminal', status: 'idle' as const, project: 'tasued', machine: 'local', model: '', updated: '' }, ...sessions.slice(2, 4)]
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!e.altKey) return
      if (e.key === 'ArrowRight') setFocus((f) => Math.min(panels.length - 1, f + 1))
      if (e.key === 'ArrowLeft') setFocus((f) => Math.max(0, f - 1))
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [panels.length])
  const W = 420, G = 18
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--seam)_1px,transparent_0)] [background-size:22px_22px] opacity-70" />
      <div className="relative flex h-[52px] shrink-0 items-center gap-3 border-b border-seam px-4">
        <span className="text-[14px] font-semibold">Canvas</span><span className="text-sec text-ash">{panels.length} panels</span>
        <span className="ml-auto flex items-center gap-1.5 text-meta text-ash"><Kbd>Alt</Kbd><Kbd>←</Kbd><Kbd>→</Kbd>move between panels</span>
        <button onClick={() => set({ layout: 'focus' })} className="rounded-[8px] border border-seam bg-slab px-2.5 py-1 text-sec text-dust hover:text-bone">Back to focus</button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div className="absolute bottom-6 top-6 flex" style={{ gap: G, left: '50%' }}
          animate={{ x: -(focus * (W + G) + W / 2) }} transition={{ type: 'spring', stiffness: 200, damping: 30 }}>
          {panels.map((p, i) => (
            <motion.div key={p.id} onClick={() => setFocus(i)} onDoubleClick={() => p.id !== 'term' && openSession(p.id)}
              animate={{ scale: i === focus ? 1 : 0.94, opacity: Math.abs(i - focus) > 1 ? 0.45 : i === focus ? 1 : 0.75 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className={cn('flex h-full shrink-0 flex-col overflow-hidden rounded-[18px] border bg-soot',
                i === focus ? 'border-brass/40 shadow-[0_0_0_3px_rgb(var(--glow)/.08),0_30px_80px_-20px_rgb(0_0_0/.7)]' : 'border-seam')}
              style={{ width: W }}>
              <div className="flex h-11 items-center gap-2.5 border-b border-seam px-3.5">
                {p.id === 'term' ? <SquareTerminal size={14} className="text-dust" /> : <StatusDot status={p.status} />}
                <span className="truncate text-[13px] font-semibold">{p.title}</span>
                <span className="ml-auto text-meta text-ash">{p.project}</span>
              </div>
              {p.id === 'term' ? (
                <div className="flex-1 bg-code p-3.5 font-mono text-[12.5px] leading-[1.7] text-dust">
                  <div><span className="text-brass">❯</span> <span className="text-bone">cargo watch -x test</span></div>
                  <div className="text-ash">[Running 'cargo test']</div><div>test result: <span className="text-sage">ok</span>. 14 passed</div>
                  <div className="mt-2"><span className="text-brass">❯</span> <span className="caret" /></div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-3 p-4 text-[13px]">
                  <div className="self-end rounded-[14px] rounded-br-[5px] bg-slab-2 px-3 py-2 text-bone">Keep going with the polish.</div>
                  <div className="rounded-[12px] border border-seam bg-ink/40 p-2">
                    {['Read reference photos', 'Edited korope.rs', 'Ran tests'].map((t, j) => (
                      <div key={t} className="flex items-center gap-2 px-1 py-1 text-dust"><span className={cn('size-1.5 rounded-full', j < 2 || p.status !== 'running' ? 'bg-sage' : 'breathe bg-brass')} />{t}</div>
                    ))}
                  </div>
                  <p className="m-0 leading-relaxed text-dust">{p.status === 'waiting' ? 'Which license should the reference photos use?' : p.status === 'done' ? 'Plan is ready. Fork the desktop app, polish the UI, then add the hub.' : 'Welding the danfo roof seam to the pillar…'}</p>
                </div>
              )}
              <div className="border-t border-seam p-2.5"><div className="rounded-[12px] border border-seam bg-slab px-3 py-2 text-sec text-ash">Message {p.title}</div></div>
            </motion.div>
          ))}
        </motion.div>
      </div>
      {/* minimap */}
      <div className="relative flex shrink-0 items-center justify-center gap-1.5 pb-4">
        {panels.map((p, i) => (
          <button key={p.id} onClick={() => setFocus(i)}
            className={cn('h-[22px] rounded-[6px] border transition-all', i === focus ? 'w-12 border-brass/60 bg-brass/20' : 'w-8 border-seam bg-slab hover:border-seam-2')} />
        ))}
      </div>
    </div>
  )
}
