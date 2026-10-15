import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Tooltip } from 'radix-ui'
import { Toaster } from 'sonner'
import { useApp } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { ChatView } from './Chat'
import { HomeView } from './Home'
import { MachinesView } from './Machines'
import { AgentsView, AppsView } from './Agents'
import { SettingsView } from './Settings'
import { Palette, CanvasView } from './Overlays'

export function App() {
  const s = useApp()

  // Deep links for screenshots/review: #view/sub, e.g. #settings/models, #inspector/changes
  useEffect(() => {
    const [v, sub] = location.hash.slice(1).split('/')
    if (!v) return
    if (v === 'palette') s.set({ palette: true })
    else if (v === 'inspector') s.openInspector((sub as never) || 'plan')
    else if (v === 'canvas') s.set({ layout: 'canvas' })
    else if (v === 'add-machine') { s.go('machines'); s.set({ addMachine: true }) }
    else if (v === 'stream') s.set({ stream: true })
    else if (v === 'theme') s.set({ theme: sub as never })
    else s.go(v as never, sub)
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = s.theme }, [s.theme])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'k') { e.preventDefault(); s.set({ palette: !useApp.getState().palette }) }
      else if (mod && key === 'b') { e.preventDefault(); s.set({ sidebar: !useApp.getState().sidebar }) }
      else if (mod && key === 'i') { e.preventDefault(); s.set({ inspector: !useApp.getState().inspector, view: 'chat' }) }
      else if (mod && key === 'n') { e.preventDefault(); s.go('home') }
      else if (mod && key === ',') { e.preventDefault(); s.go('settings', 'general') }
      else if (e.shiftKey && key === 'tab' && (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        e.preventDefault(); const order = ['agent', 'plan', 'ask'] as const
        s.set({ mode: order[(order.indexOf(useApp.getState().mode) + 1) % 3] })
      }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])

  const showCanvas = s.view === 'chat' && s.layout === 'canvas'
  return (
    <Tooltip.Provider>
      <div className={`grain relative flex h-full ${s.stream ? 'stream' : ''}`}>
        <AnimatePresence initial={false}>
          {s.sidebar && (
            <motion.div key="sb" initial={{ width: 0 }} animate={{ width: 272 }} exit={{ width: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 42 }}
              className="shrink-0 overflow-hidden border-r border-seam">
              <div className="h-full w-[272px]"><Sidebar /></div>
            </motion.div>
          )}
        </AnimatePresence>
        <main className="relative flex min-w-0 flex-1 flex-col bg-ink">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={showCanvas ? 'canvas' : s.view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
              className="flex min-h-0 flex-1 flex-col">
              {showCanvas ? <CanvasView /> :
                s.view === 'chat' ? <ChatView /> :
                s.view === 'home' ? <HomeView /> :
                s.view === 'machines' ? <MachinesView /> :
                s.view === 'agents' ? <AgentsView /> :
                s.view === 'apps' ? <AppsView /> : <SettingsView />}
            </motion.div>
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

/* The add-machine dialog lives on the Machines page; elsewhere we route there first. */
function AddMachineHost() {
  const { addMachine, go } = useApp()
  useEffect(() => { if (addMachine) go('machines') }, [addMachine])
  return null
}
