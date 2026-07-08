import { Pencil, Save, Trash2, X } from 'lucide-react'
import { thumbnailBoxes } from '@/graph/thumbnail'
import { sanitizeSnapshot } from '@/graph/share'
import { useGraphStore, type GallerySlot } from '@/store/useGraphStore'

const THUMB_W = 300
const THUMB_H = 200

/** Pure-SVG mini-map of a saved design (ADR 0033) — no canvas capture. */
function Thumbnail({ slot }: { slot: GallerySlot }) {
  const clean = sanitizeSnapshot(slot.snapshot)
  const boxes = clean ? thumbnailBoxes(clean.nodes, THUMB_W, THUMB_H) : []
  return (
    <svg
      viewBox={`0 0 ${THUMB_W} ${THUMB_H}`}
      className="h-full w-full rounded-t-lg bg-surface"
      role="img"
      aria-label={`${slot.name} 미리보기`}
    >
      {boxes.length === 0 ? (
        <text
          x={THUMB_W / 2}
          y={THUMB_H / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-slate-600 text-xs"
        >
          빈 설계
        </text>
      ) : (
        boxes.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={3}
            fill={b.container ? 'none' : b.color}
            fillOpacity={b.container ? 0 : 0.85}
            stroke={b.color}
            strokeWidth={b.container ? 1.5 : 0.5}
            strokeOpacity={b.container ? 0.7 : 0.9}
          />
        ))
      )}
    </svg>
  )
}

/** One-line, locale-stable date for a slot card. */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Gallery modal (ADR 0033): a grid of saved-design cards. Clicking a card body
 * loads it (replacing the canvas); each card carries rename + delete controls.
 * "현재 설계 저장" captures the live canvas into a new slot.
 */
export default function Gallery() {
  const setShowGallery = useGraphStore((s) => s.setShowGallery)
  const slots = useGraphStore((s) => s.slots)
  const saveSlot = useGraphStore((s) => s.saveSlot)
  const loadSlot = useGraphStore((s) => s.loadSlot)
  const deleteSlot = useGraphStore((s) => s.deleteSlot)
  const renameSlot = useGraphStore((s) => s.renameSlot)

  const onSave = () => {
    const name = window.prompt('저장할 설계 이름:', `설계 ${slots.length + 1}`)
    if (name === null) return
    saveSlot(name)
  }

  const onRename = (slot: GallerySlot) => {
    const name = window.prompt('새 이름:', slot.name)
    if (name === null) return
    renameSlot(slot.id, name)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onClick={() => setShowGallery(false)}
    >
      <div
        role="dialog"
        aria-label="갤러리"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            갤러리{' '}
            <span className="text-sm font-normal text-slate-400">{slots.length}개</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-accent-soft"
            >
              <Save size={14} />
              현재 설계 저장
            </button>
            <button
              type="button"
              onClick={() => setShowGallery(false)}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {slots.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              저장된 설계가 없습니다. "현재 설계 저장"으로 첫 슬롯을 만들어 보세요.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="group flex flex-col overflow-hidden rounded-lg border border-surface-border bg-surface/40 transition-colors hover:border-accent-soft"
                >
                  <button
                    type="button"
                    onClick={() => loadSlot(slot.id)}
                    className="aspect-[3/2] w-full"
                    title="이 설계 불러오기"
                  >
                    <Thumbnail slot={slot} />
                  </button>
                  <div className="flex items-center justify-between gap-1 border-t border-surface-border px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-200">
                        {slot.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatDate(slot.updatedAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => onRename(slot)}
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
                        aria-label="이름 변경"
                        title="이름 변경"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSlot(slot.id)}
                        className="rounded p-1 text-slate-500 transition-colors hover:bg-rose-900/50 hover:text-rose-300"
                        aria-label="삭제"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
