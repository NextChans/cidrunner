import { lazy, Suspense } from 'react'
import { Waves } from 'lucide-react'
import { Toolbar } from './Toolbar'
import { MobileHeader } from './MobileHeader'
import { Drawer } from './Drawer'
import { Palette, PaletteBody } from './Palette'
import { Canvas } from './Canvas'
import { Inspector, InspectorBody } from './Inspector'
import { MissionList } from './MissionPanel'
import { SimAudio } from './SimAudio'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useGraphStore } from '@/store/useGraphStore'

// Split out of the main bundle (ADR 0029): each is only fetched when first shown.
const ShortcutHelp = lazy(() => import('./ShortcutHelp'))
const NodeContextMenu = lazy(() => import('./NodeContextMenu'))
const Gallery = lazy(() => import('./Gallery'))
const Achievements = lazy(() => import('./Achievements'))

export function Layout() {
  const drawers = useGraphStore((s) => s.mobileDrawers)
  const setDrawer = useGraphStore((s) => s.setDrawer)
  const showShortcutHelp = useGraphStore((s) => s.showShortcutHelp)
  const showGallery = useGraphStore((s) => s.showGallery)
  const showAchievements = useGraphStore((s) => s.showAchievements)
  const contextMenu = useGraphStore((s) => s.contextMenu)

  // Mounted here (inside ReactFlowProvider) so `R` can reach the flow instance.
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-slate-200">
      <SimAudio />
      <header className="flex items-center justify-between border-b border-surface-border bg-surface-raised px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Waves size={20} className="text-accent" />
          <h1 className="text-base font-semibold tracking-tight text-slate-100">
            cidrunner
          </h1>
          <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            MVP
          </span>
        </div>
        {/* Full toolbar on desktop; compact drawer toggles on mobile. */}
        <div className="hidden md:block">
          <Toolbar />
        </div>
        <MobileHeader />
      </header>

      <main className="flex min-h-0 flex-1">
        {/* Desktop 3-pane layout (hidden on mobile). */}
        <Palette />
        <div className="min-w-0 flex-1">
          <Canvas />
        </div>
        <Inspector />
      </main>

      {/* Mobile-only overlay drawers reusing the same panel bodies. */}
      <Drawer
        open={drawers.palette}
        onClose={() => setDrawer('palette', false)}
        side="left"
        title="리소스"
      >
        <PaletteBody />
      </Drawer>

      <Drawer
        open={drawers.inspector}
        onClose={() => setDrawer('inspector', false)}
        side="right"
        title="인스펙터"
      >
        <InspectorBody />
      </Drawer>

      <Drawer
        open={drawers.missions}
        onClose={() => setDrawer('missions', false)}
        side="bottom"
        title="미션"
      >
        <MissionList />
      </Drawer>

      <Suspense fallback={null}>
        {contextMenu && <NodeContextMenu />}
        {showShortcutHelp && <ShortcutHelp />}
        {showGallery && <Gallery />}
        {showAchievements && <Achievements />}
      </Suspense>
    </div>
  )
}
