import { useState } from 'react'
import { motion } from 'motion/react'
import { Plus, Terminal, MoreHorizontal, Power, Cpu, MemoryStick, Activity, KeyRound, ShieldCheck, RefreshCw, Laptop, Smartphone, Globe2, Box, Cloud, Server, Check, ArrowRight } from 'lucide-react'
import { useApp } from '@/lib/store'
import { machines, kindMeta, type Machine } from '@/lib/data'
import { MachineMark } from '@/components/marks'
import { Logo, LogoTile } from '@/components/logos'
import { Button, Badge, Dialog, Switch, Tip, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toast } from 'sonner'

export function PageHead({ title, desc, actions }: { title: string; desc: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em]">{title}</h1>
        <p className="m-0 mt-1 max-w-[60ch] text-[14px] text-dust">{desc}</p>
      </div>
      {actions}
    </div>
  )
}

export function MachinesView() {
  const { machine, set } = useApp()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[980px] px-6 pb-16 pt-8 md:px-10 md:pt-10">
        <PageHead title="Machines" desc="Where your agents run. Logins, settings and sessions follow you to each one."
          actions={<Button variant="primary" onClick={() => set({ addMachine: true })}><Plus size={15} />Add machine</Button>} />

        {/* Topology: devices you use → hub → machines that work */}
        <Topology />

        <div className="mt-10 flex flex-col gap-2.5">
          {machines.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <MachineRow m={m} isDefault={m.id === machine} onDefault={() => { set({ machine: m.id }); toast(`New sessions will run on ${m.name}`) }} />
            </motion.div>
          ))}
        </div>
      </div>
      <AddMachineDialog />
    </div>
  )
}

function MachineRow({ m, isDefault, onDefault }: { m: Machine; isDefault: boolean; onDefault: () => void }) {
  const statusText = { online: 'Online', sleeping: 'Asleep', 'on-demand': 'On demand', offline: 'Offline' }[m.status]
  const statusTone = { online: 'sage', sleeping: 'ember', 'on-demand': 'lilac', offline: 'default' }[m.status] as 'sage'
  return (
    <div className={cn('group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] bg-soot p-4 transition-colors hover:bg-slab md:flex-nowrap',
      isDefault ? 'ring-1 ring-brass/35' : '')}>
      <MachineMark m={m} size={42} className="rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="truncate text-[15px] font-semibold">{m.name}</span>
          <span className={cn('text-[11.5px] font-medium', kindMeta[m.kind].color)}>{kindMeta[m.kind].label}</span>
          {isDefault && <Badge tone="brass"><Check size={10} strokeWidth={3} />Default</Badge>}
        </div>
        <div data-secret className="mt-0.5 truncate text-sec text-ash">{m.detail}{m.region && <span>, {m.region}</span>}</div>
      </div>

      <div className="hidden w-[180px] shrink-0 items-center gap-4 text-sec text-dust lg:flex">
        <Tip label="CPU"><span className="flex items-center gap-1.5"><Cpu size={13} className="text-ash" />{m.cpu}</span></Tip>
        <Tip label="Memory"><span className="flex items-center gap-1.5"><MemoryStick size={13} className="text-ash" />{m.mem}</span></Tip>
      </div>
      <div className="w-[120px]">
        {m.status === 'online' ? (
          <div>
            <div className="mb-1 flex items-center justify-between text-meta text-ash"><span className="flex items-center gap-1"><Activity size={11} />{Math.round(m.load * 100)}% busy</span>{m.latency && <span>{m.latency} ms</span>}</div>
            <div className="flex h-[18px] items-end gap-[2px]">
              {Array.from({ length: 24 }).map((_, i) => {
                const h = 3 + Math.abs(Math.sin(i * 0.9 + m.load * 9)) * 13 * (0.4 + m.load)
                return <span key={i} className={cn('w-[3px] rounded-[1px]', kindMeta[m.kind].ring)} style={{ height: h, opacity: 0.25 + (i / 24) * 0.75 }} />
              })}
            </div>
          </div>
        ) : <Badge tone={statusTone}>{statusText}</Badge>}
      </div>
      <div className="flex w-[70px] justify-end text-sec text-dust">{m.sessions > 0 ? `${m.sessions} session${m.sessions > 1 ? 's' : ''}` : <span className="text-ash">idle</span>}</div>

      <div className="flex items-center gap-1">
        {!isDefault && <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={onDefault}>Make default</Button>}
        <Tip label="Open a terminal there"><IconButton size="sm"><Terminal size={15} /></IconButton></Tip>
        {m.status === 'sleeping' && <Tip label="Wake"><IconButton size="sm"><Power size={15} /></IconButton></Tip>}
        <IconButton size="sm"><MoreHorizontal size={15} /></IconButton>
      </div>
    </div>
  )
}

function Topology() {
  const clients = [
    { icon: Laptop, label: 'Desktop app', sub: 'this laptop' },
    { icon: Globe2, label: 'Web', sub: 'any browser' },
    { icon: Smartphone, label: 'Android', sub: 'paired' },
  ]
  return (
    <div className="relative overflow-hidden rounded-[18px] bg-soot p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--seam)_1px,transparent_0)] [background-size:18px_18px] opacity-60" />
      <div className="relative grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_1.3fr]">
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 rounded-[11px] bg-slab px-3 py-2">
              <c.icon size={15} className="text-dust" /><span className="text-[13px] font-medium">{c.label}</span><span className="ml-auto text-meta text-ash">{c.sub}</span>
            </div>
          ))}
        </div>
        <Flow />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-14 place-items-center rounded-[16px] border border-seam-2 bg-slab-2 shadow-[0_0_40px_-8px_rgb(var(--glow)/.35)]"><Logo name="cloudflare" size={28} /></span>
          <span className="text-[13px] font-semibold">Your hub</span>
          <span className="max-w-[160px] text-meta text-ash">Routes devices to machines and keeps logins in an encrypted vault</span>
        </div>
        <Flow />
        <div className="flex flex-col gap-2">
          {machines.slice(0, 4).map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 rounded-[11px] bg-slab px-2.5 py-1.5">
              <MachineMark m={m} size={24} /><span className="text-[13px] font-medium">{m.name}</span>
              <span className={cn('ml-auto text-meta', kindMeta[m.kind].color)}>{kindMeta[m.kind].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function Flow() {
  return (
    <div className="relative h-px w-14 bg-seam-2">
      <motion.span className="absolute -top-[2px] size-[5px] rounded-full bg-brass shadow-[0_0_8px_rgb(var(--glow)/.8)]"
        animate={{ left: ['0%', '100%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  )
}

function AddMachineDialog() {
  const { addMachine, set } = useApp()
  const [kind, setKind] = useState<'ssh' | 'vm' | 'sandbox'>('vm')
  const [step, setStep] = useState(0)
  const kinds = [
    { id: 'vm', icon: Cloud, title: 'Cloud VM', desc: 'Always on. Keeps working while your laptop sleeps.', logos: ['gcloud', 'aws'] as const },
    { id: 'sandbox', icon: Box, title: 'Sandbox', desc: 'Throwaway box per task. Safe for risky runs.', logos: ['cloudflare'] as const },
    { id: 'ssh', icon: Server, title: 'Any server', desc: 'Connect over SSH to a machine you already have.', logos: [] as const },
  ] as const
  const close = (v: boolean) => { set({ addMachine: v }); if (!v) setStep(0) }
  return (
    <Dialog open={addMachine} onOpenChange={close} title="Add a machine" className="w-[620px]">
      <div className="border-b border-seam px-6 pb-4 pt-5">
        <div className="text-[17px] font-semibold">Add a machine</div>
        <div className="mt-0.5 text-sec text-ash">Jcode installs itself there and brings your logins along.</div>
        <div className="mt-4 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-brass' : 'bg-seam-2')} />)}</div>
      </div>
      <div className="min-h-[280px] px-6 py-5">
        {step === 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {kinds.map((k) => (
              <button key={k.id} onClick={() => setKind(k.id)}
                className={cn('flex flex-col gap-3 rounded-[14px] border p-4 text-left transition-[border-color,background,box-shadow]',
                  kind === k.id ? 'border-brass/55 bg-brass/[0.06] shadow-[0_0_0_3px_rgb(var(--glow)/.08)]' : 'border-seam bg-slab hover:border-seam-2')}>
                <span className="flex items-center justify-between">
                  <k.icon size={18} className={kind === k.id ? 'text-brass' : 'text-dust'} />
                  <span className="flex gap-1">{k.logos.map((l) => <Logo key={l} name={l} size={14} />)}</span>
                </span>
                <span><span className="block text-[14px] font-semibold">{k.title}</span><span className="mt-1 block text-sec leading-snug text-ash">{k.desc}</span></span>
              </button>
            ))}
          </div>
        )}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            {kind === 'vm' && <>
              <Field label="Provider"><div className="flex gap-2">{(['gcloud', 'aws'] as const).map((l, i) => (
                <button key={l} className={cn('flex flex-1 items-center gap-2.5 rounded-[11px] border px-3 py-2.5 text-[13px] font-medium', i === 0 ? 'border-brass/50 bg-brass/[0.06]' : 'border-seam bg-slab')}>
                  <Logo name={l} size={18} />{l === 'gcloud' ? 'Google Cloud' : 'AWS'}</button>))}</div></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Region"><Select v="europe-west2, London" /></Field>
                <Field label="Size"><Select v="8 vCPU, 32 GB" /></Field>
              </div>
              <Toggle label="Sleep after 30 idle minutes" desc="Wakes automatically when you connect" on />
            </>}
            {kind === 'sandbox' && <>
              <Field label="Provider"><div className="flex gap-2">
                <button className="flex flex-1 items-center gap-2.5 rounded-[11px] border border-brass/50 bg-brass/[0.06] px-3 py-2.5 text-[13px] font-medium"><Box size={16} className="text-lilac" />Daytona</button>
                <button className="flex flex-1 items-center gap-2.5 rounded-[11px] border border-seam bg-slab px-3 py-2.5 text-[13px] font-medium"><Logo name="cloudflare" size={16} />Cloudflare</button>
              </div></Field>
              <Field label="API key"><input type="password" defaultValue="dtn_live_4f9a2c" data-secret className="h-9 w-full rounded-[10px] border border-seam bg-slab px-3 font-mono text-[13px] outline-none focus:border-brass/50" /></Field>
              <div className="flex items-center gap-2 text-sec text-ash"><ShieldCheck size={14} className="text-sage" />Stored in your encrypted vault, never on disk in plain text</div>
            </>}
            {kind === 'ssh' && <>
              <Field label="Host"><input placeholder="user@hostname or an SSH alias" className="h-9 w-full rounded-[10px] border border-seam bg-slab px-3 text-[13px] outline-none placeholder:text-ash focus:border-brass/50" /></Field>
              <Field label="Working folder"><input defaultValue="~/projects" className="h-9 w-full rounded-[10px] border border-seam bg-slab px-3 font-mono text-[13px] outline-none focus:border-brass/50" /></Field>
              <div className="flex items-center gap-2 text-sec text-ash"><KeyRound size={14} />Uses your existing SSH keys and config</div>
            </>}
          </div>
        )}
        {step === 2 && <Provisioning />}
      </div>
      <div className="flex items-center justify-between border-t border-seam px-6 py-3.5">
        <Button variant="ghost" onClick={() => (step === 0 ? close(false) : setStep(step - 1))}>{step === 0 ? 'Cancel' : 'Back'}</Button>
        {step < 2 ? <Button variant="primary" onClick={() => setStep(step + 1)}>{step === 0 ? 'Continue' : 'Create machine'}<ArrowRight size={14} /></Button>
          : <Button variant="primary" onClick={() => { close(false); toast('gcp-home-2 is ready', { description: 'Your logins and settings are synced.' }) }}>Done</Button>}
      </div>
    </Dialog>
  )
}
function Provisioning() {
  const steps = ['Creating the machine', 'Installing Jcode', 'Syncing logins from your vault', 'Cloning tasued', 'Ready']
  return (
    <div className="flex flex-col gap-1">
      {steps.map((s, i) => (
        <motion.div key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.45 }} className="flex items-center gap-3 py-2">
          <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ delay: i * 0.45 + 0.3 }}
            className="grid size-6 place-items-center rounded-full border border-sage/50 bg-sage/15 text-sage"><Check size={12} strokeWidth={3} /></motion.span>
          <span className="text-[14px]">{s}</span>
          {i === 2 && <span className="ml-auto flex gap-1">{(['openai', 'claude', 'openrouter'] as const).map((l) => <LogoTile key={l} name={l} size={22} />)}</span>}
        </motion.div>
      ))}
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="text-sec font-medium text-dust">{label}</span>{children}</label>
}
function Select({ v }: { v: string }) {
  return <button className="flex h-9 w-full items-center justify-between rounded-[10px] border border-seam bg-slab px-3 text-[13px]">{v}<RefreshCw size={12} className="hidden" /><span className="text-ash">⌄</span></button>
}
function Toggle({ label, desc, on }: { label: string; desc: string; on?: boolean }) {
  return <div className="flex items-center gap-3 rounded-[12px] border border-seam bg-slab p-3"><div className="flex-1"><div className="text-[13px] font-medium">{label}</div><div className="text-sec text-ash">{desc}</div></div><Switch defaultChecked={on} /></div>
}
