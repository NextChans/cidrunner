import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Layout } from './components/Layout'
import { Onboarding } from './components/Onboarding'
import { designFromHash } from '@/graph/share'
import { redoDesign, undoDesign, useGraphStore } from '@/store/useGraphStore'

/** True when the user is typing in a form control (skip global shortcuts). */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * True when the canvas deviates from the untouched seed graph — the bar for
 * "there is work worth protecting" before a shared link replaces it.
 */
function hasExistingWork(): boolean {
  const { nodes, edges } = useGraphStore.getState()
  const seedIds = ['vpc-1', 'subnet-1', 'ec2-1']
  return (
    edges.length > 0 ||
    nodes.length !== seedIds.length ||
    !seedIds.every((id) => nodes.some((n) => n.id === id))
  )
}

function App() {
  const [sharedLoaded, setSharedLoaded] = useState(false)

  // A shared link (#g=…) asks before replacing existing work (a grader opening
  // 30 submissions must not lose their own design — ADR 0023), then the hash
  // is stripped so a refresh keeps the loaded design instead of re-importing.
  // Also handles pasting a share URL into an already-open tab (hash-only
  // navigation fires `hashchange`, not a reload).
  useEffect(() => {
    const loadFromHash = () => {
      const design = designFromHash(window.location.hash)
      if (!design) return
      const store = useGraphStore.getState()
      const proceed =
        !hasExistingWork() ||
        window.confirm(
          '공유된 설계를 불러오면 현재 캔버스가 대체됩니다.\n(현재 작업이 필요하면 취소 후 JSON으로 내보내세요.)\n\n계속할까요?',
        )
      if (proceed) {
        store.loadDesign(design.nodes, design.edges, design.missionId)
        store.setNotice(
          design.missionId ? '공유된 미션 제출물을 불러왔습니다.' : '공유된 설계를 불러왔습니다.',
          'info',
        )
        setSharedLoaded(true)
      } else {
        store.setNotice('공유 설계 불러오기를 취소했습니다.', 'info')
      }
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    loadFromHash()
    window.addEventListener('hashchange', loadFromHash)
    return () => window.removeEventListener('hashchange', loadFromHash)
  }, [])

  // Global undo/redo shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redoDesign()
        else undoDesign()
      } else if (key === 'y') {
        e.preventDefault()
        redoDesign()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ReactFlowProvider>
      <Layout />
      <Onboarding suppressed={sharedLoaded} />
    </ReactFlowProvider>
  )
}

export default App
