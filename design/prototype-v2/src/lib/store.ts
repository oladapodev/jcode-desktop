import { create } from 'zustand'
import type { DockviewApi } from 'dockview-react'
import { machines, models, sessions as seedSessions, type Session } from './data'

export type View = 'workspace' | 'home' | 'agents' | 'machines' | 'apps' | 'settings'
export type PaneKind = 'chat' | 'editor' | 'files' | 'terminal' | 'browser' | 'changes' | 'plan' | 'usage'
export type Theme = 'graphite' | 'midnight' | 'carbon' | 'paper'
export type Preset = 'chat' | 'code' | 'review' | 'browser' | 'terminal'

type State = {
  view: View
  settingsPage: string
  sessionId: string
  sessions: Session[]
  sidebar: 'full' | 'rail'
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
  preset: Preset
  dock: DockviewApi | null
  openFiles: string[]
  set: (p: Partial<State>) => void
  go: (v: View, page?: string) => void
  openSession: (id: string) => void
}

export const useApp = create<State>((set) => ({
  view: 'workspace',
  settingsPage: 'appearance',
  sessionId: 'korope',
  sessions: seedSessions,
  sidebar: 'full',
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
  preset: 'chat',
  dock: null,
  openFiles: [],
  set: (p) => set(p),
  go: (view, page) => set((s) => ({ view, settingsPage: page ?? s.settingsPage, palette: false })),
  openSession: (id) =>
    set((s) => ({ sessionId: id, view: 'workspace', palette: false, sessions: s.sessions.map((x) => (x.id === id ? { ...x, unread: false } : x)) })),
}))

export const getMachine = (id: string) => machines.find((m) => m.id === id) ?? machines[0]
export const getModel = (id: string) => models.find((m) => m.id === id) ?? models[0]
