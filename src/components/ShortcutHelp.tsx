import { X } from 'lucide-react'
import { useGraphStore } from '@/store/useGraphStore'

/** ⌘ on macOS, Ctrl elsewhere — purely cosmetic (both fire the same handler). */
const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘'
    : 'Ctrl'

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  {
    title: '편집',
    rows: [
      [[MOD, 'Z'], '실행 취소'],
      [[MOD, 'Shift', 'Z'], '다시 실행'],
      [[MOD, 'D'], '선택 노드 복제'],
      [['Delete'], '선택 삭제'],
      [['Esc'], '메뉴 닫기 · 선택 해제'],
    ],
  },
  {
    title: '캔버스 · 실행',
    rows: [
      [['R'], '화면에 맞추기'],
      [['S'], '트래픽 시뮬 시작 / 중지'],
      [['E'], 'Terraform 내보내기'],
      [['?'], '이 도움말 열기 / 닫기'],
    ],
  },
]

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-600">+</span>}
          <kbd className="rounded border border-surface-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-slate-200">
            {k}
          </kbd>
        </span>
      ))}
    </span>
  )
}

/**
 * Keyboard-shortcut cheat sheet modal (ADR 0028). Lazy-loaded from the Layout
 * and driven by `showShortcutHelp`; `?` toggles it and Esc closes it (handled by
 * {@link useKeyboardShortcuts}).
 */
export default function ShortcutHelp() {
  const setShortcutHelp = useGraphStore((s) => s.setShortcutHelp)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={() => setShortcutHelp(false)}
    >
      <div
        role="dialog"
        aria-label="키보드 단축키"
        className="w-full max-w-md rounded-xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">키보드 단축키</h2>
          <button
            type="button"
            onClick={() => setShortcutHelp(false)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </div>
              <dl className="space-y-1.5">
                {group.rows.map(([keys, label]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <dt className="text-slate-300">{label}</dt>
                    <dd>
                      <Keys keys={keys} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-slate-500">
          입력창에 포커스가 있을 때는 단축키가 비활성화됩니다.
        </p>
      </div>
    </div>
  )
}
