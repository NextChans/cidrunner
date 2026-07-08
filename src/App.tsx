import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Layout } from './components/Layout'
import { designFromHash } from '@/graph/share'
import { useGraphStore } from '@/store/useGraphStore'

function App() {
  // A shared link (#g=…) overrides the autosaved design, then the hash is
  // stripped so a refresh keeps the loaded design instead of re-importing.
  useEffect(() => {
    const design = designFromHash(window.location.hash)
    if (!design) return
    const store = useGraphStore.getState()
    store.loadDesign(design.nodes, design.edges)
    store.setNotice('공유된 설계를 불러왔습니다.', 'info')
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  return (
    <ReactFlowProvider>
      <Layout />
    </ReactFlowProvider>
  )
}

export default App
