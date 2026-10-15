import type { LogoName } from '@/components/logos'
import type { Status } from '@/components/ui'

export type MachineKind = 'local' | 'vm' | 'sandbox' | 'ssh'
export type Machine = {
  id: string; name: string; kind: MachineKind; provider?: LogoName; region?: string; detail: string
  status: 'online' | 'sleeping' | 'on-demand' | 'offline'; cpu: string; mem: string; load: number; sessions: number; latency?: number
}
export const machines: Machine[] = [
  { id: 'local', name: 'This laptop', kind: 'local', provider: 'linux', detail: 'Latitude E7240', status: 'online', cpu: '4 cores', mem: '11.6 GB', load: 0.42, sessions: 3 },
  { id: 'gcp', name: 'gcp-home', kind: 'vm', provider: 'gcloud', region: 'europe-west2', detail: 'e2-standard-8, always on', status: 'online', cpu: '8 vCPU', mem: '32 GB', load: 0.18, sessions: 2, latency: 24 },
  { id: 'daytona', name: 'Daytona', kind: 'sandbox', detail: 'Fresh box per task, ready in ~2s', status: 'on-demand', cpu: '2 vCPU', mem: '4 GB', load: 0, sessions: 0 },
  { id: 'cf', name: 'Cloudflare Sandbox', kind: 'sandbox', provider: 'cloudflare', detail: 'Edge containers for quick runs', status: 'on-demand', cpu: '1 vCPU', mem: '2 GB', load: 0, sessions: 0 },
  { id: 'nebula', name: 'nebula-cpanel', kind: 'ssh', detail: 'user@nebula over SSH', status: 'sleeping', cpu: '2 cores', mem: '4 GB', load: 0, sessions: 0, latency: 61 },
]
export const kindMeta: Record<MachineKind, { label: string; color: string; ring: string }> = {
  local: { label: 'Local', color: 'text-brass', ring: 'bg-brass' },
  vm: { label: 'Cloud VM', color: 'text-sky', ring: 'bg-sky' },
  sandbox: { label: 'Sandbox', color: 'text-lilac', ring: 'bg-lilac' },
  ssh: { label: 'SSH', color: 'text-dust', ring: 'bg-dust' },
}

export type Model = { id: string; name: string; provider: LogoName; via: string; note?: string; ctx: string; speed: 1 | 2 | 3; smarts: 1 | 2 | 3 }
export const models: Model[] = [
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', provider: 'openai', via: 'ChatGPT Pro', ctx: '400k', speed: 2, smarts: 3, note: 'Default' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai', via: 'ChatGPT Pro', ctx: '256k', speed: 3, smarts: 2 },
  { id: 'claude-opus', name: 'Claude Opus', provider: 'claude', via: 'Claude Max', ctx: '1M', speed: 1, smarts: 3, note: 'Deep work' },
  { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'claude', via: 'Claude Max', ctx: '1M', speed: 2, smarts: 3 },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini', via: 'API key', ctx: '2M', speed: 2, smarts: 3 },
  { id: 'deepseek', name: 'DeepSeek V4', provider: 'deepseek', via: 'OpenRouter', ctx: '128k', speed: 3, smarts: 2 },
  { id: 'kimi', name: 'Kimi K2', provider: 'kimi', via: 'OpenRouter', ctx: '256k', speed: 3, smarts: 2 },
  { id: 'qwen-coder', name: 'Qwen Coder', provider: 'ollama', via: 'Local, Ollama', ctx: '64k', speed: 2, smarts: 1, note: 'Offline' },
]

export type Session = {
  id: string; title: string; status: Status; project: string; machine: string; model: string
  updated: string; agents?: number; added?: number; removed?: number; unread?: boolean
}
export type Project = { id: string; name: string; branch: string; dirty: number; open: boolean }
export const projects: Project[] = [
  { id: 'tasued', name: 'tasued', branch: 'master', dirty: 3, open: true },
  { id: 'jcode', name: 'jcode', branch: 'master', dirty: 0, open: true },
  { id: 'grace', name: 'grace', branch: 'main', dirty: 1, open: true },
  { id: 'hostel', name: 'hostel', branch: 'master', dirty: 0, open: false },
]
export const sessions: Session[] = [
  { id: 'korope', title: 'Realistic Korope render', status: 'running', project: 'tasued', machine: 'local', model: 'gpt-6-astra', updated: 'now', agents: 6, added: 9648, removed: 2163 },
  { id: 'catalog', title: 'Catalog provenance tests', status: 'waiting', project: 'tasued', machine: 'gcp', model: 'claude-opus', updated: '12m', unread: true },
  { id: 'harness', title: 'Personal harness plan', status: 'done', project: 'jcode', machine: 'local', model: 'claude-opus', updated: '34m' },
  { id: 'ship', title: 'Ship the booking flow', status: 'waiting', project: 'grace', machine: 'gcp', model: 'gpt-6-astra', updated: '1h', agents: 4, added: 7031, removed: 3361 },
  { id: 'demos', title: 'Demo reel scenes', status: 'idle', project: 'hostel', machine: 'local', model: 'claude-sonnet', updated: '1w' },
]

/* ---------------- Scripted agent run (drives the live transcript) ---------------- */
export type Step =
  | { kind: 'think'; text: string; ms: number }
  | { kind: 'tool'; tool: 'search' | 'read' | 'edit' | 'bash' | 'browser' | 'agent'; title: string; arg: string; result: string; ms: number; ok?: boolean; body?: string }
  | { kind: 'say'; text: string }
  | { kind: 'images' }
  | { kind: 'diff' }
  | { kind: 'ask'; text: string; options: string[] }

export const run: Step[] = [
  { kind: 'think', text: 'The korope in the photos is a Suzuki Every (DA52) with the high roof. The danfo is a VW T3. Match by headlight shape and grille, then fix the roof seam that shows a gap.', ms: 2200 },
  { kind: 'tool', tool: 'search', title: 'Searched the web', arg: 'Suzuki Every DA52 Lagos korope', result: '8 sources', ms: 1400 },
  { kind: 'tool', tool: 'read', title: 'Read reference photos', arg: 'reference/transport-korope/', result: '6 images', ms: 900 },
  { kind: 'images' },
  { kind: 'tool', tool: 'edit', title: 'Edited', arg: 'src/scene/korope.rs', result: '+48 −12', ms: 1100, body: 'fn korope_body() -> Mesh {\n-    let roof = Roof::flat(1.42);\n+    let roof = Roof::high(1.58).with_drip_rail();\n+    let grille = Grille::da52();' },
  { kind: 'tool', tool: 'edit', title: 'Edited', arg: 'src/scene/danfo_roof.rs', result: '+21 −9', ms: 900 },
  { kind: 'tool', tool: 'bash', title: 'Ran tests', arg: 'cargo test -p render korope', result: '14 passed', ms: 2600, ok: true, body: '   Compiling render v0.4.1\n    Finished test in 38.2s\ntest geometry::no_stray_panels ... ok\ntest geometry::roof_joints ... ok\n\ntest result: ok. 14 passed; 0 failed' },
  { kind: 'say', text: "The korope now uses the **Suzuki Every DA52** high-roof body, which matches your photos: the taller roof line, drip rail and the narrow grille. I also welded the danfo roof seam to the pillar, so the gap you saw is gone. All 14 geometry tests pass." },
  { kind: 'diff' },
  { kind: 'ask', text: 'Should the korope keep the faded blue livery from the photos, or use a clean factory finish?', options: ['Faded, like the photos', 'Clean factory finish'] },
]

export const plan = [
  { text: 'Collect reference photos of Lagos korope buses', done: true },
  { text: 'Identify the base vehicle (Suzuki Every DA52)', done: true },
  { text: 'Fix stray panel geometry on the korope', done: true },
  { text: 'Weld the danfo roof seam to the pillar', done: false },
  { text: 'Write catalog provenance tests', done: false },
]

export const slashCommands: { group: string; items: { cmd: string; desc: string; icon: string }[] }[] = [
  { group: 'Session', items: [
    { cmd: 'fork', desc: 'Branch this conversation', icon: 'GitFork' },
    { cmd: 'btw', desc: 'Ask a side question without derailing', icon: 'MessageCircleQuestion' },
    { cmd: 'split', desc: 'Start a parallel session', icon: 'Columns2' },
    { cmd: 'transfer', desc: 'Move this session to another machine', icon: 'ArrowRightLeft' },
    { cmd: 'rewind', desc: 'Go back to an earlier turn', icon: 'Undo2' },
    { cmd: 'compact', desc: 'Summarize to free up context', icon: 'Minimize2' },
    { cmd: 'rename', desc: 'Rename this session', icon: 'Pencil' },
  ]},
  { group: 'Agent', items: [
    { cmd: 'model', desc: 'Switch model', icon: 'Sparkles' },
    { cmd: 'plan', desc: 'Plan first, then ask before acting', icon: 'ListChecks' },
    { cmd: 'swarm', desc: 'Split the work across parallel agents', icon: 'Network' },
    { cmd: 'review', desc: 'Have a second agent review the changes', icon: 'ScanEye' },
    { cmd: 'overnight', desc: 'Keep working while you sleep', icon: 'Moon' },
  ]},
  { group: 'Workspace', items: [
    { cmd: 'terminal', desc: 'Open a terminal here', icon: 'SquareTerminal' },
    { cmd: 'diff', desc: 'Review changes', icon: 'FileDiff' },
    { cmd: 'commit', desc: 'Commit with a written message', icon: 'GitCommitHorizontal' },
    { cmd: 'machines', desc: 'Pick where agents run', icon: 'Server' },
  ]},
  { group: 'Account', items: [
    { cmd: 'login', desc: 'Connect a model provider', icon: 'KeyRound' },
    { cmd: 'usage', desc: 'Limits and spend', icon: 'Gauge' },
    { cmd: 'memory', desc: 'What the agent remembers', icon: 'Brain' },
    { cmd: 'settings', desc: 'Open settings', icon: 'Settings2' },
  ]},
]
