import { AppNav } from '@/components/app-nav'
import { LiveRecognition } from '@/components/live-recognition'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <LiveRecognition />
    </div>
  )
}
