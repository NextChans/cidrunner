import { lazy, Suspense, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Layout } from './components/Layout'
import { designFromHash } from '@/graph/share'
import { customMissionFromHash } from '@/missions/custom'
import { useAchievements } from '@/hooks/useAchievements'
import { useGraphStore } from '@/store/useGraphStore'

// First-visit-only overlay — split out of the main bundle (ADR 0029).
const Onboarding = lazy(() =>
  import('./components/Onboarding').then((m) => ({ default: m.Onboarding })),
)

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

  // Watches badge progress and toasts new unlocks (ADR 0032).
  useAchievements()

  // A shared link (#g=…) asks before replacing existing work (a grader opening
  // 30 submissions must not lose their own design — ADR 0023), then the hash
  // is stripped so a refresh keeps the loaded design instead of re-importing.
  // Also handles pasting a share URL into an already-open tab (hash-only
  // navigation fires `hashchange`, not a reload).
  useEffect(() => {
    const loadFromHash = () => {
      const store = useGraphStore.getState()

      // Instructor custom mission (#m=, ADR 0065): activate it in challenge mode
      // without touching the canvas — the student builds their own solution.
      const spec = customMissionFromHash(window.location.hash)
      if (spec) {
        store.setCustomMission(spec)
        store.setNotice(`커스텀 미션 "${spec.title}"을(를) 불러왔습니다.`, 'info')
        setSharedLoaded(true)
        history.replaceState(null, '', window.location.pathname + window.location.search)
        return
      }

      const design = designFromHash(window.location.hash)
      if (!design) return
      const proceed =
        !hasExistingWork() ||
        window.confirm(
          '공유된 설계를 불러오면 현재 캔버스가 대체됩니다.\n(현재 작업이 필요하면 취소 후 JSON으로 내보내세요.)\n\n계속할까요?',
        )
      if (proceed) {
        store.loadDesign(design.nodes, design.edges, design.missionId, design.securityGroups)
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

  return (
    <ReactFlowProvider>
      <Layout />
      <Suspense fallback={null}>
        <Onboarding suppressed={sharedLoaded} />
      </Suspense>
    </ReactFlowProvider>
  )
}

export default App
