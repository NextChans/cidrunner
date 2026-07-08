import { useRef } from 'react'
import clsx from 'clsx'
import { Play, Square, RotateCcw, Download, Share2, FileDown, FileUp } from 'lucide-react'
import { useGraphStore, type Mode } from '@/store/useGraphStore'
import { downloadTerraformZip } from '@/graph/terraform'
import { encodeShareUrl, sanitizeSnapshot, toSnapshot } from '@/graph/share'

const MODES: Mode[] = ['free', 'challenge']

const MODE_LABELS: Record<Mode, string> = {
  free: '자유 모드',
  challenge: '챌린지 모드',
}

/** Triggers a browser download of a text file. */
function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function Toolbar() {
  const mode = useGraphStore((s) => s.mode)
  const setMode = useGraphStore((s) => s.setMode)
  const reset = useGraphStore((s) => s.reset)
  const running = useGraphStore((s) => s.simulation !== null)
  const runSimulation = useGraphStore((s) => s.runSimulation)
  const stopSimulation = useGraphStore((s) => s.stopSimulation)
  const setNotice = useGraphStore((s) => s.setNotice)
  const loadDesign = useGraphStore((s) => s.loadDesign)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const iconBtn =
    'flex items-center gap-1.5 rounded-md border border-surface-border px-2 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/60'

  const share = async () => {
    const { nodes, edges } = useGraphStore.getState()
    const url = encodeShareUrl(nodes, edges)
    try {
      await navigator.clipboard.writeText(url)
      setNotice('공유 링크가 클립보드에 복사되었습니다.', 'info')
    } catch {
      // Clipboard can be blocked (permissions); fall back to a prompt.
      window.prompt('아래 링크를 복사하세요:', url)
    }
  }

  const exportJson = () => {
    const { nodes, edges } = useGraphStore.getState()
    downloadText('cidrunner-design.json', JSON.stringify(toSnapshot(nodes, edges), null, 2))
    setNotice('설계를 cidrunner-design.json으로 저장했습니다.', 'info')
  }

  const importJson = async (file: File) => {
    try {
      const design = sanitizeSnapshot(JSON.parse(await file.text()))
      if (!design) {
        setNotice('불러오기 실패: cidrunner 설계 파일이 아닙니다.')
        return
      }
      loadDesign(design.nodes, design.edges)
      setNotice('설계를 불러왔습니다.', 'info')
    } catch {
      setNotice('불러오기 실패: JSON을 읽을 수 없습니다.')
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Free / Challenge mode toggle */}
      <div className="flex overflow-hidden rounded-md border border-surface-border text-xs">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              'px-3 py-1.5 transition-colors',
              mode === m
                ? 'bg-accent text-slate-900 font-semibold'
                : 'text-slate-400 hover:bg-slate-700/60',
            )}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-surface-border" />

      <button
        type="button"
        onClick={() => (running ? stopSimulation() : runSimulation())}
        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-accent-soft"
      >
        {running ? <Square size={14} /> : <Play size={14} />}
        {running ? '중지' : '시작'}
      </button>

      <button type="button" onClick={() => reset()} className={iconBtn}>
        <RotateCcw size={14} />
        초기화
      </button>

      <div className="h-5 w-px bg-surface-border" />

      <button type="button" onClick={() => void share()} className={iconBtn} title="공유 링크 복사">
        <Share2 size={14} />
        공유
      </button>

      <button type="button" onClick={exportJson} className={iconBtn} title="설계를 JSON으로 저장">
        <FileDown size={14} />
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={iconBtn}
        title="JSON 설계 불러오기"
      >
        <FileUp size={14} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importJson(file)
          e.target.value = ''
        }}
      />

      <button
        type="button"
        onClick={() => {
          const { nodes, edges } = useGraphStore.getState()
          void downloadTerraformZip(nodes, edges)
        }}
        className={iconBtn}
      >
        <Download size={14} />
        Terraform 내보내기
      </button>
    </div>
  )
}
