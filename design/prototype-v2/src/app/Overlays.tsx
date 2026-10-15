import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Command } from 'cmdk'
import * as Icons from 'lucide-react'
import { Search, SquarePen, Network, Server, Radio, Palette as PaletteIcon, KeyRound, SquareTerminal, GitFork, Plus, Settings2, CornerDownLeft, FileCode2, MessagesSquare, FileDiff, Globe, FolderTree, Maximize2 } from 'lucide-react'
import { useApp, getMachine, type PaneKind, type Preset } from '@/lib/store'
import { files } from '@/lib/repo'
import { openPane, applyPreset } from './Workspace'
import { machines, kindMeta, slashCommands } from '@/lib/data'
import { StatusDot, Kbd, Dialog } from '@/components/ui'
import { MachineMark } from '@/components/marks'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

/* ------------------------------ Command palette ------------------------------ */
export function Palette() {
  const s = useApp()
  const run = (fn: () => void) => { s.set({ palette: false }); setTimeout(fn, 10) }
  const pane = (k: PaneKind, path?: string) => { s.set({ view: 'workspace' }); setTimeout(() => { const d = useApp.getState().dock; if (d) openPane(d, k, path ? { path, direction: 'right' } : { direction: 'right' }) }, 30) }
  const preset = (p: Preset) => { s.set({ view: 'workspace', preset: p }); setTimeout(() => { const d = useApp.getState().dock; if (d) applyPreset(d, p) }, 30) }
  const item = 'flex h-10 cursor-default items-center gap-3 rounded-[10px] px-2.5 text-ui text-dust data-[selected=true]:bg-slab-2 data-[selected=true]:text-bone'
  const group = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ash'
  const Ico = ({ children }: { children: React.ReactNode }) => <span className="grid size-7 place-items-center rounded-[8px] border border-seam bg-slab text-dust">{children}</span>
  return (
    <Dialog open={s.palette} onOpenChange={(v) => s.set({ palette: v })} title="Search" className="top-[12vh] w-[640px] p-0">
      <Command loop className="flex flex-col" filter={(value, search) => {
        const v = value.toLowerCase(), q = search.toLowerCase().trim()
        if (!q) return 1
        const name = v.replace(/^(file|session|machine|layout|settings) /, '')
        const base = name.split('/').pop() ?? name
        if (base.startsWith(q)) return v.startsWith('file') ? 1 : 0.95
        if (name.split(/[\s/._-]/).some((w) => w.startsWith(q))) return v.startsWith('file') ? 0.9 : 0.8
        if (v.includes(q)) return 0.5
        let i = 0; for (const ch of v) if (ch === q[i]) i++
        return i === q.length ? 0.15 : 0
      }}>
        <div className="flex items-center gap-3 border-b border-seam px-4">
          <Search size={17} className="text-ash" />
          <Command.Input autoFocus placeholder="Search sessions, actions, machines and settings" className="h-[54px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-ash" />
          <Kbd>Esc</Kbd>
        </div>
        <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
          <Command.Empty className="px-4 py-10 text-center text-sec text-ash">Nothing matches. Try a session name or a command like “fork”.</Command.Empty>
          <Command.Group heading="Files" className={group}>
            {Object.keys(files).map((p) => (
              <Command.Item key={p} value={`file ${p}`} onSelect={() => run(() => pane('editor', p))} className={item}>
                <Ico><FileCode2 size={14} /></Ico><span className="font-mono text-[12.5px] text-bone">{p.split('/').pop()}</span><span className="truncate font-mono text-[11.5px] text-ash">{p}</span>
              </Command.Item>
            ))}
          </Command.Group>
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
          <Command.Group heading="Layout" className={group}>
            {([['chat', MessagesSquare, 'Chat layout'], ['code', FileCode2, 'Code layout: files and editor in the middle'], ['review', FileDiff, 'Review layout: diff in the middle'], ['browser', Globe, 'Browser layout'], ['terminal', SquareTerminal, 'Terminal layout']] as const).map(([p, I, l]) => (
              <Command.Item key={p} value={`layout ${l}`} onSelect={() => run(() => preset(p))} className={item}><Ico><I size={14} /></Ico>{l}</Command.Item>
            ))}
            <Command.Item value="focus maximize pane" onSelect={() => run(() => { const d = useApp.getState().dock; if (d?.activePanel) d.hasMaximizedGroup() ? d.exitMaximizedGroup() : d.maximizeGroup(d.activePanel) })} className={item}><Ico><Maximize2 size={14} /></Ico>Focus the active pane<span className="ml-auto flex gap-0.5"><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>M</Kbd></span></Command.Item>
            <Command.Item value="open files pane" onSelect={() => run(() => pane('files'))} className={item}><Ico><FolderTree size={14} /></Ico>Open files</Command.Item>
          </Command.Group>
          <Command.Group heading="Actions" className={group}>
            {[
              [SquarePen, 'New session', () => s.go('home'), 'Ctrl N'],
              [Network, 'Start a swarm', () => s.go('agents'), ''],
              [SquareTerminal, 'Open terminal', () => pane('terminal'), 'Ctrl `'],
              [GitFork, 'Fork this session', () => toast('Forked into a new session'), ''],
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

