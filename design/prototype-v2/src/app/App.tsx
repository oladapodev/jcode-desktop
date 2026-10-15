import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Tooltip } from 'radix-ui'
import { Toaster } from 'sonner'
import { useApp, type Preset } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { Workspace, useDockShortcut, applyPreset } from './Workspace'
import { HomeView } from './Home'
import { MachinesView } from './Machines'
import { AgentsView, AppsView } from './Agents'
import { SettingsView } from './Settings'
import { Palette } from './Overlays'

/* Collapse the sidebar to a rail on narrow windows; restore when wide again. */
function useResponsiveSidebar() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)')
    const on = () => useApp.getState().set({ sidebar: mq.matches ? 'rail' : 'full' })
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
}

export function App() {
  const s = useApp()
  useResponsiveSidebar()
  useDockShortcut()

  // Deep links: #home, #agents, #code, #review, #browser, #terminal, #settings/models, #theme/paper ...
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('theme')
    if (t) s.set({ theme: t as never })
    const [v, sub] = location.hash.slice(1).split('/')
    if (!v) return
    const presets = ['chat', 'code', 'review', 'browser', 'terminal']
    if (v === 'palette') s.set({ palette: true })
    else if (presets.includes(v)) { s.set({ preset: v as Preset, view: 'workspace' }); const d = useApp.getState().dock; if (d) applyPreset(d, v as Preset) }
    else if (v === 'add-machine') { s.go('machines'); s.set({ addMachine: true }) }
    else if (v === 'stream') s.set({ stream: true })
    else if (v === 'rail') s.set({ sidebar: 'rail' })
    else if (v === 'theme') s.set({ theme: sub as never })
    else s.go(v as never, sub)
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = s.theme }, [s.theme])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const st = useApp.getState()
      const handled = () => { e.preventDefault(); e.stopPropagation() }
      if (mod && key === 'k') { handled(); st.set({ palette: !st.palette }) }
      else if (mod && key === 'b') { handled(); st.set({ sidebar: st.sidebar === 'full' ? 'rail' : 'full' }) }
      else if (mod && key === 'n') { handled(); st.go('home') }
      else if (mod && key === ',') { handled(); st.go('settings', 'general') }
      else if (mod && /^[1-5]$/.test(e.key)) {
        handled()
        const p = (['chat', 'code', 'review', 'browser', 'terminal'] as Preset[])[+e.key - 1]
        st.set({ preset: p, view: 'workspace' }); if (st.dock) applyPreset(st.dock, p)
      }
      else if (e.shiftKey && key === 'tab' && (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        e.preventDefault(); const order = ['agent', 'plan', 'ask'] as const
        st.set({ mode: order[(order.indexOf(st.mode) + 1) % 3] })
      }
    }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  }, [])

  const w = s.sidebar === 'full' ? 272 : 60
  return (
    <Tooltip.Provider>
      <div className={`relative flex h-full ${s.stream ? 'stream' : ''}`}>
        <motion.div initial={false} animate={{ width: w }} transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          className="shrink-0 overflow-hidden border-r border-seam">
          <div className="h-full" style={{ width: w }}><Sidebar /></div>
        </motion.div>
        <main className="relative flex min-w-0 flex-1 flex-col bg-ink">
          {/* The workspace stays mounted so its layout, editors and terminal survive navigation. */}
          <div className={s.view === 'workspace' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}><Workspace /></div>
          <AnimatePresence mode="wait" initial={false}>
            {s.view !== 'workspace' && (
              <motion.div key={s.view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
                className="flex min-h-0 flex-1 flex-col">
                {s.view === 'home' ? <HomeView /> : s.view === 'machines' ? <MachinesView /> : s.view === 'agents' ? <AgentsView /> : s.view === 'apps' ? <AppsView /> : <SettingsView />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <Palette />
        {s.view !== 'machines' && <AddMachineHost />}
        <Toaster position="bottom-right" toastOptions={{
          className: '!bg-soot !border !border-seam-2 !text-bone !rounded-[14px] !shadow-[0_20px_50px_-12px_rgb(0_0_0/.6)] !font-sans',
          descriptionClassName: '!text-ash',
        }} />
      </div>
    </Tooltip.Provider>
  )
}

function AddMachineHost() {
  const { addMachine, go } = useApp()
  useEffect(() => { if (addMachine) go('machines') }, [addMachine])
  return null
}
