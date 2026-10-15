import { create } from 'zustand'
import { machines, models, sessions as seedSessions, type Session } from './data'

export type View = 'chat' | 'home' | 'agents' | 'machines' | 'apps' | 'settings'
export type InspectorTab = 'plan' | 'changes' | 'terminal' | 'files' | 'preview' | 'usage'
export type Layout = 'focus' | 'canvas'
export type Theme = 'graphite' | 'midnight' | 'carbon' | 'paper'

type State = {
  view: View
  settingsPage: string
  sessionId: string
  sessions: Session[]
  sidebar: boolean
  inspector: boolean
  inspectorTab: InspectorTab
  inspectorWidth: number
  layout: Layout
  palette: boolean
  addMachine: boolean
  stream: boolean
  theme: Theme
  machine: string
  model: string
  effort: 'low' | 'medium' | 'high' | 'max'
  mode: 'agent' | 'plan' | 'ask'
  runKey: number
  runDone: boolean
  set: (p: Partial<State>) => void
  go: (v: View, page?: string) => void
  openSession: (id: string) => void
  openInspector: (t: InspectorTab) => void
}

export const useApp = create<State>((set) => ({
  view: 'chat',
  settingsPage: 'appearance',
  sessionId: 'korope',
  sessions: seedSessions,
  sidebar: true,
  inspector: false,
  inspectorTab: 'plan',
  inspectorWidth: 380,
  layout: 'focus',
  palette: false,
  addMachine: false,
  stream: false,
  theme: 'graphite',
  machine: machines[0].id,
  model: models[0].id,
  effort: 'medium',
  mode: 'agent',
  runKey: 0,
  runDone: false,
  set: (p) => set(p),
  go: (view, page) => set((s) => ({ view, settingsPage: page ?? s.settingsPage, palette: false })),
  openSession: (id) =>
    set((s) => ({ sessionId: id, view: 'chat', palette: false, sessions: s.sessions.map((x) => (x.id === id ? { ...x, unread: false } : x)) })),
  openInspector: (t) => set({ inspector: true, inspectorTab: t, view: 'chat' }),
}))

export const getMachine = (id: string) => machines.find((m) => m.id === id) ?? machines[0]
export const getModel = (id: string) => models.find((m) => m.id === id) ?? models[0]
