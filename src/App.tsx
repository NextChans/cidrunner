import { ReactFlowProvider } from '@xyflow/react'
import { Layout } from './components/Layout'

function App() {
  return (
    <ReactFlowProvider>
      <Layout />
    </ReactFlowProvider>
  )
}

export default App
