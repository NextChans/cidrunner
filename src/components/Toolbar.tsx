import { useRef } from 'react'
import clsx from 'clsx'
import { useStore } from 'zustand'
import {
  Play,
  Square,
  RotateCcw,
  Download,
  Share2,
  FileDown,
  FileUp,
  Undo2,
  Redo2,
  Volume2,
  VolumeX,
  Keyboard,
  Trophy,
  Images,
} from 'lucide-react'
import { redoDesign, undoDesign, useGraphStore, type Mode } from '@/store/useGraphStore'
import { downloadTerraformZip } from '@/graph/terraform'
import { getGraphIssues } from '@/graph/checks'
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
  const soundOn = useGraphStore((s) => s.soundOn)
  const toggleSound = useGraphStore((s) => s.toggleSound)
  const setNotice = useGraphStore((s) => s.setNotice)
  const loadDesign = useGraphStore((s) => s.loadDesign)
  const setShortcutHelp = useGraphStore((s) => s.setShortcutHelp)
  const setShowGallery = useGraphStore((s) => s.setShowGallery)
  const setShowAchievements = useGraphStore((s) => s.setShowAchievements)
  const badgeCount = useGraphStore((s) => s.earnedBadges.length)
  const canUndo = useStore(useGraphStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useGraphStore.temporal, (s) => s.futureStates.length > 0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const iconBtn =
    'flex items-center gap-1.5 rounded-md border border-surface-border px-2 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/60'

  const share = async () => {
    // Mission context rides along so a shared submission opens gradable.
    const { nodes, edges, activeMissionId } = useGraphStore.getState()
    const url = encodeShareUrl(nodes, edges, activeMissionId)
    try {
      await navigator.clipboard.writeText(url)
      setNotice('공유 링크가 클립보드에 복사되었습니다.', 'info')
    } catch {
      // Clipboard can be blocked (permissions); fall back to a prompt.
      window.prompt('아래 링크를 복사하세요:', url)
    }
  }

  const exportJson = () => {
    const { nodes, edges, activeMissionId } = useGraphStore.getState()
    downloadText(
      'cidrunner-design.json',
      JSON.stringify(toSnapshot(nodes, edges, activeMissionId), null, 2),
    )
    setNotice('설계를 cidrunner-design.json으로 저장했습니다.', 'info')
  }

  const importJson = async (file: File) => {
    try {
      const design = sanitizeSnapshot(JSON.parse(await file.text()))
      if (!design) {
        setNotice('불러오기 실패: cidrunner 설계 파일이 아닙니다.')
        return
      }
      loadDesign(design.nodes, design.edges, design.missionId)
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

      <button
        type="button"
        onClick={() => toggleSound()}
        className={iconBtn}
        title={soundOn ? '재생 사운드 끄기' : '재생 사운드 켜기'}
        aria-pressed={soundOn}
      >
        {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
      </button>

      <button type="button" onClick={() => reset()} className={iconBtn}>
        <RotateCcw size={14} />
        초기화
      </button>

      <div className="h-5 w-px bg-surface-border" />

      <button
        type="button"
        onClick={() => undoDesign()}
        disabled={!canUndo}
        className={clsx(iconBtn, !canUndo && 'cursor-not-allowed opacity-40')}
        title="실행 취소 (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>

      <button
        type="button"
        onClick={() => redoDesign()}
        disabled={!canRedo}
        className={clsx(iconBtn, !canRedo && 'cursor-not-allowed opacity-40')}
        title="다시 실행 (Ctrl+Shift+Z)"
      >
        <Redo2 size={14} />
      </button>

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
          // Apply-ready contract (QA-001 / ADR 0045): a graph error means the
          // export would emit REPLACE_ME markers (e.g. an orphaned resource with
          // no parent reference), so block export until the design validates.
          const errorCount = [...getGraphIssues(nodes, edges).errors.values()].reduce(
            (sum, msgs) => sum + msgs.length,
            0,
          )
          if (errorCount > 0) {
            setNotice(
              `설계에 오류 ${errorCount}건이 있어 Terraform으로 내보낼 수 없습니다. 빨간 오류를 먼저 해결하세요.`,
            )
            return
          }
          void downloadTerraformZip(nodes, edges)
        }}
        className={iconBtn}
      >
        <Download size={14} />
        Terraform 내보내기
      </button>

      <button
        type="button"
        onClick={() => setShowGallery(true)}
        className={iconBtn}
        title="갤러리 (저장된 설계)"
        aria-label="갤러리"
      >
        <Images size={14} />
      </button>

      <button
        type="button"
        onClick={() => setShowAchievements(true)}
        className={clsx(iconBtn, 'relative')}
        title="배지"
        aria-label="배지"
      >
        <Trophy size={14} />
        {badgeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-slate-900">
            {badgeCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setShortcutHelp(true)}
        className={iconBtn}
        title="키보드 단축키 (?)"
        aria-label="키보드 단축키"
      >
        <Keyboard size={14} />
      </button>
    </div>
  )
}
