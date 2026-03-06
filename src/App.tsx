import { TopBar } from './components/layout/TopBar'
import { LeftSidebar } from './components/layout/LeftSidebar'
import { RightSidebar } from './components/layout/RightSidebar'
import { ResultsDrawer } from './components/results/ResultsDrawer'
import { ImageCanvas } from './components/canvas/ImageCanvas'

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="flex flex-col flex-1 overflow-hidden">
          <ImageCanvas />
          <ResultsDrawer />
        </main>
        <RightSidebar />
      </div>
    </div>
  )
}
