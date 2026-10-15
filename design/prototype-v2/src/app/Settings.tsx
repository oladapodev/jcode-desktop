import { motion, AnimatePresence } from 'motion/react'
import {
  Settings2, UserRound, KeyRound, Palette, MessagesSquare, Server, SquareTerminal, Mic, Bell, Radio, Keyboard, Download,
  Check, Laptop, Smartphone, Globe2, QrCode, ShieldCheck, Plus, ExternalLink,
} from 'lucide-react'
import { useApp, type Theme } from '@/lib/store'
import { LogoTile, Logo, type LogoName } from '@/components/logos'
import { Button, Switch, Badge, Segmented, Keys, Meter } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useState } from 'react'
import { toast } from 'sonner'

const pages = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'account', label: 'Account and sync', icon: UserRound },
  { id: 'models', label: 'Models and logins', icon: KeyRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'chat', label: 'Conversation', icon: MessagesSquare },
  { id: 'machines', label: 'Machines', icon: Server },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'alerts', label: 'Notifications', icon: Bell },
  { id: 'stream', label: 'Stream mode', icon: Radio },
  { id: 'keys', label: 'Keyboard', icon: Keyboard },
  { id: 'about', label: 'Updates and about', icon: Download },
]

export function SettingsView() {
  const { settingsPage, set } = useApp()
  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-[232px] shrink-0 overflow-y-auto border-r border-seam px-3 py-6">
        <div className="mb-3 px-2.5 text-[17px] font-semibold tracking-[-0.01em]">Settings</div>
        {pages.map((p) => {
          const active = settingsPage === p.id
          return (
            <button key={p.id} onClick={() => set({ settingsPage: p.id })}
              className={cn('relative flex h-8 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-ui', active ? 'text-bone' : 'text-dust hover:text-bone')}>
              {active && <motion.span layoutId="set-pill" className="absolute inset-0 rounded-[8px] bg-slab-2" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <p.icon size={15} className={cn('relative', active && 'text-brass')} /><span className="relative">{p.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={settingsPage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            className="mx-auto max-w-[720px] px-10 pb-20 pt-9">
            <Page id={settingsPage} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function H({ t, d }: { t: string; d: string }) {
  return <div className="mb-7"><h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{t}</h1><p className="m-0 mt-1 text-[14px] text-dust">{d}</p></div>
}
function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      {title && <h2 className="mb-2 px-1 text-[13px] font-semibold text-dust">{title}</h2>}
      <div className="overflow-hidden rounded-[14px] border border-seam bg-soot [&>*+*]:border-t [&>*+*]:border-seam">{children}</div>
    </section>
  )
}
function Item({ t, d, children, icon }: { t: React.ReactNode; d?: React.ReactNode; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex min-h-[58px] items-center gap-4 px-4 py-3">
      {icon}
      <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">{t}</div>{d && <div className="text-sec text-ash">{d}</div>}</div>
      {children}
    </div>
  )
}
function Choice({ value, options }: { value: string; options: string[] }) {
  const [v, setV] = useState(value)
  return <Segmented layoutId={`c-${options.join()}`} value={v} onChange={setV} size="sm" items={options.map((o) => ({ value: o, label: o }))} />
}
function Select({ value }: { value: string }) {
  return <button className="flex h-8 min-w-[170px] items-center justify-between gap-3 rounded-[9px] border border-seam-2 bg-slab px-3 text-sec hover:bg-slab-2">{value}<span className="text-ash">⌄</span></button>
}

function Page({ id }: { id: string }) {
  const { theme, set, stream } = useApp()
  switch (id) {
    case 'general':
      return <>
        <H t="General" d="Defaults for new sessions." />
        <Group>
          <Item t="Default project" d="Where Ctrl Enter starts a session"><Select value="~/Desktop/tasued" /></Item>
          <Item t="Layout" d="Focus shows one chat. Canvas lays sessions side by side."><Choice value="Focus" options={['Focus', 'Canvas']} /></Item>
          <Item t="Restore sessions on launch" d="Also recovers your workspace after a crash"><Switch defaultChecked /></Item>
          <Item t="Auto-continue" d="Keep going while the plan has unfinished steps"><Switch defaultChecked /></Item>
          <Item t="New sessions in a git worktree" d="Keeps parallel agents from touching each other's files"><Switch /></Item>
        </Group>
        <Group title="Help">
          <Item t="Learn Jcode" d="A three-step tour of sessions, the inspector and shortcuts"><Button size="sm">Start tour</Button></Item>
          <Item t="Pop out a session" d="Open a chat in its own small window"><Button size="sm"><ExternalLink size={13} />Pop out</Button></Item>
        </Group>
      </>
    case 'account':
      return <>
        <H t="Account and sync" d="Sign in once. Sessions, settings and logins follow you everywhere." />
        <div className="mb-7 flex items-center gap-4 rounded-[16px] border border-seam bg-soot p-4">
          <span className="grid size-12 place-items-center rounded-full bg-[conic-gradient(from_200deg,#e0b46c,#b77f3b,#6d4b25,#e0b46c)] text-[18px] font-bold text-brass-ink">D</span>
          <div className="flex-1"><div className="text-[15px] font-semibold">dev</div><div data-secret className="text-sec text-ash">dev@example.com</div></div>
          <Badge tone="brass">Pro</Badge><Button size="sm" variant="ghost">Sign out</Button>
        </div>
        <Group title="What syncs">
          <Item t="Sessions and history" d="Continue any session on desktop, web or phone"><Switch defaultChecked /></Item>
          <Item t="Model logins" d={<span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-sage" />End-to-end encrypted in your vault</span>}><Switch defaultChecked /></Item>
          <Item t="Settings and themes"><Switch defaultChecked /></Item>
          <Item t="Memory" d="What the agent remembers about you and your projects"><Switch /></Item>
        </Group>
        <Group title="Your devices">
          <Item icon={<Laptop size={18} className="text-dust" />} t="Latitude E7240" d="This device, Linux"><Badge tone="sage">Active now</Badge></Item>
          <Item icon={<Smartphone size={18} className="text-dust" />} t="Pixel 8" d="Android app, 2 hours ago"><Button size="xs" variant="ghost">Remove</Button></Item>
          <Item icon={<Globe2 size={18} className="text-dust" />} t="Chrome on Windows" d="Web, yesterday"><Button size="xs" variant="ghost">Remove</Button></Item>
          <Item icon={<QrCode size={18} className="text-brass" />} t="Add a device" d="Scan a code from the phone or web app"><Button size="sm"><Plus size={13} />Pair</Button></Item>
        </Group>
      </>
    case 'models':
      return <>
        <H t="Models and logins" d="Use your subscriptions or API keys. Logins reach every machine you add." />
        <Group>
          {([
            ['openai', 'OpenAI', 'Signed in with ChatGPT Pro', 0.48],
            ['claude', 'Anthropic', 'Signed in with Claude Max', 0.71],
            ['openrouter', 'OpenRouter', 'API key, 300+ models', 0.37],
            ['gemini', 'Google Gemini', 'Not connected', null],
            ['copilot', 'GitHub Copilot', 'Not connected', null],
            ['ollama', 'Ollama', 'Local models on this laptop', null],
          ] as [LogoName, string, string, number | null][]).map(([l, n, d, v]) => (
            <Item key={n} icon={<LogoTile name={l} size={36} />} t={n} d={d}>
              {v !== null ? <div className="flex items-center gap-3"><div className="w-[90px]"><Meter value={v} tone={v > 0.65 ? 'ember' : 'brass'} /><div className="mt-1 text-[11px] text-ash">{Math.round(v * 100)}% of limit</div></div><Button size="xs" variant="ghost">Manage</Button></div>
                : <Button size="sm" onClick={() => toast(`Opening ${n} sign-in in your browser`)}>Connect</Button>}
            </Item>
          ))}
        </Group>
        <Group title="Defaults">
          <Item t="Default model"><Select value="GPT-6 Astra" /></Item>
          <Item t="Default effort"><Choice value="Medium" options={['Low', 'Medium', 'High', 'Max']} /></Item>
          <Item t="Model for swarm agents" d="Cheaper models keep big swarms affordable"><Select value="GPT-5.6 Luna" /></Item>
        </Group>
      </>
    case 'appearance': {
      const themes: { id: Theme; name: string; c: string[] }[] = [
        { id: 'graphite', name: 'Graphite', c: ['#12100e', '#1f1c18', '#e0b46c', '#efe7db'] },
        { id: 'midnight', name: 'Midnight', c: ['#0c0f14', '#161b24', '#8fb3ff', '#e5ebf3'] },
        { id: 'carbon', name: 'Carbon', c: ['#000000', '#101010', '#5fe0b0', '#f4f4f4'] },
        { id: 'paper', name: 'Paper', c: ['#f6f3ee', '#fffdf9', '#a8691f', '#221d17'] },
      ]
      return <>
        <H t="Appearance" d="Interface text is set in Instrument Sans. Code stays monospace." />
        <div className="mb-7 grid grid-cols-4 gap-3">
          {themes.map((t) => (
            <button key={t.id} onClick={() => { set({ theme: t.id }) }}
              className={cn('overflow-hidden rounded-[14px] border text-left transition-[border-color,box-shadow]', theme === t.id ? 'border-brass/60 shadow-[0_0_0_3px_rgb(var(--glow)/.12)]' : 'border-seam hover:border-seam-2')}>
              <div className="relative h-[86px] p-2.5" style={{ background: t.c[0] }}>
                <div className="flex h-full gap-1.5">
                  <div className="w-[30%] rounded-[6px]" style={{ background: t.c[1] }} />
                  <div className="flex flex-1 flex-col gap-1.5 rounded-[6px] p-1.5" style={{ background: t.c[1] }}>
                    <div className="h-1.5 w-3/4 rounded-full" style={{ background: t.c[3], opacity: 0.7 }} />
                    <div className="h-1.5 w-1/2 rounded-full" style={{ background: t.c[3], opacity: 0.35 }} />
                    <div className="mt-auto h-3 w-6 self-end rounded-full" style={{ background: t.c[2] }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-soot px-3 py-2 text-sec font-medium">{t.name}{theme === t.id && <Check size={14} className="text-brass" />}</div>
            </button>
          ))}
        </div>
        <Group>
          <Item t="Interface font"><Select value="Instrument Sans" /></Item>
          <Item t="Code font"><Select value="JetBrains Mono" /></Item>
          <Item t="Text size"><Choice value="Default" options={['Small', 'Default', 'Large']} /></Item>
          <Item t="Reduce motion" d="Replaces movement with fades"><Switch /></Item>
          <Item t="Translucent sidebar" d="Lets the desktop wallpaper show through"><Switch /></Item>
        </Group>
      </>
    }
    case 'chat':
      return <>
        <H t="Conversation" d="How agent work is shown in the chat." />
        <Group>
          <Item t="Thinking" d="The agent's reasoning between steps"><Choice value="Collapsed" options={['Hidden', 'Collapsed', 'Open']} /></Item>
          <Item t="Tool steps" d="Each search, read, edit and command"><Choice value="Thread" options={['Thread', 'Compact', 'Hidden']} /></Item>
          <Item t="Changes" d="Where file edits appear"><Choice value="Card" options={['Card', 'Inline diff', 'Inspector']} /></Item>
          <Item t="Show token counts" d="Below each reply"><Switch defaultChecked /></Item>
        </Group>
      </>
    case 'machines':
      return <>
        <H t="Machines" d="Defaults for remote and cloud machines." />
        <Group>
          <Item t="Run new sessions on"><Select value="This laptop" /></Item>
          <Item t="Wake sleeping machines when needed"><Switch defaultChecked /></Item>
          <Item t="Put cloud VMs to sleep after"><Select value="30 idle minutes" /></Item>
          <Item t="Sandbox for risky commands" d="Run anything that deletes or installs in a throwaway box"><Switch defaultChecked /></Item>
        </Group>
      </>
    case 'terminal':
      return <>
        <H t="Terminal" d="Built-in terminals in the inspector and canvas." />
        <Group>
          <Item t="Engine" d="libghostty renders with the GPU"><Choice value="libghostty" options={['libghostty', 'Handterm']} /></Item>
          <Item t="Shell"><Select value="zsh" /></Item>
          <Item t="Scrollback"><Select value="50,000 lines" /></Item>
          <Item t="Copy on select"><Switch defaultChecked /></Item>
        </Group>
      </>
    case 'voice':
      return <>
        <H t="Voice" d="Talk to your agents. Speech becomes a task, a navigation, or a draft." />
        <Group>
          <Item t="Hold to talk"><Keys k="Ctrl Shift V" /></Item>
          <Item t="Works when Jcode is in the background"><Switch defaultChecked /></Item>
          <Item t="Smart routing" d="Decides if speech is a new task, a jump to a session, or text to keep"><Switch defaultChecked /></Item>
          <Item t="Microphone"><Select value="Built-in microphone" /></Item>
        </Group>
      </>
    case 'alerts':
      return <>
        <H t="Notifications" d="Know when agents finish or need you." />
        <Group>
          <Item t="When an agent needs your answer"><Switch defaultChecked /></Item>
          <Item t="When a session finishes"><Switch defaultChecked /></Item>
          <Item t="Sounds"><Switch /></Item>
          <Item t="Email overnight summaries" d={<span data-secret>to dev@example.com</span>}><Switch defaultChecked /></Item>
        </Group>
      </>
    case 'stream':
      return <>
        <H t="Stream mode" d="Safe to show live. Turn it on from the radio icon in any session." />
        <div className="mb-7 flex items-center gap-4 rounded-[16px] border border-rose/25 bg-rose/[0.05] p-4">
          <span className="grid size-10 place-items-center rounded-[11px] bg-rose text-white"><Radio size={18} /></span>
          <div className="flex-1"><div className="text-[14px] font-semibold">Stream mode is {stream ? 'on' : 'off'}</div><div className="text-sec text-ash">Shows a LIVE badge and hides private details</div></div>
          <Switch checked={stream} onCheckedChange={(v) => set({ stream: v })} />
        </div>
        <Group title="Hide">
          <Item t="Emails and account names"><Switch defaultChecked /></Item>
          <Item t="API keys and tokens"><Switch defaultChecked /></Item>
          <Item t="File paths outside the project"><Switch defaultChecked /></Item>
        </Group>
        <Group title="Show">
          <Item t="Larger text for viewers"><Switch defaultChecked /></Item>
          <Item t="Keystrokes on screen"><Switch /></Item>
          <Item icon={<span className="flex gap-1"><Logo name="twitch" size={16} tinted /><Logo name="youtube" size={16} tinted /></span>} t="Viewer questions" d="Pull questions from Twitch or YouTube chat into a side panel"><Button size="sm">Connect</Button></Item>
        </Group>
      </>
    case 'keys':
      return <>
        <H t="Keyboard" d="Every action is also in search." />
        <Group>
          {[['Search and commands', 'Ctrl K'], ['New session', 'Ctrl N'], ['Toggle sidebar', 'Ctrl B'], ['Toggle inspector', 'Ctrl I'], ['Switch mode', 'Shift Tab'],
            ['Move between sessions', 'Alt ↑'], ['Fork session', 'Ctrl Shift F'], ['Hold to talk', 'Ctrl Shift V'], ['Settings', 'Ctrl ,']].map(([a, k]) => (
            <Item key={a} t={a}><Keys k={k} /></Item>
          ))}
        </Group>
      </>
    case 'about':
      return <>
        <H t="Updates and about" d="Jcode Desktop 0.7.0, engine 0.98.1" />
        <Group>
          <Item t="You're up to date" d="Checked 5 minutes ago"><Button size="sm">Check now</Button></Item>
          <Item t="Install updates automatically"><Switch defaultChecked /></Item>
          <Item t="Channel"><Choice value="Stable" options={['Stable', 'Beta']} /></Item>
        </Group>
        <Group title="Developer">
          <Item t="Publish this app" d="Commit, release and publish from your checkout"><Button size="sm">Publish</Button></Item>
          <Item t="Self-dev mode" d="Hot-reload the interface while editing it"><Switch /></Item>
        </Group>
      </>
  }
  return null
}
