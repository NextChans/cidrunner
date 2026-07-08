import { Menu, ListChecks, PanelRight } from 'lucide-react'
import { useGraphStore, type DrawerKey } from '@/store/useGraphStore'

const BUTTONS: { which: DrawerKey; label: string; Icon: typeof Menu }[] = [
  { which: 'palette', label: '리소스 열기', Icon: Menu },
  { which: 'missions', label: '미션 열기', Icon: ListChecks },
  { which: 'inspector', label: '인스펙터 열기', Icon: PanelRight },
]

/** Mobile-only (md:hidden) header controls: one toggle per side panel drawer. */
export function MobileHeader() {
  const setDrawer = useGraphStore((s) => s.setDrawer)

  return (
    <div className="flex items-center gap-1 md:hidden">
      {BUTTONS.map(({ which, label, Icon }) => (
        <button
          key={which}
          type="button"
          onClick={() => setDrawer(which, true)}
          aria-label={label}
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-slate-100"
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  )
}
