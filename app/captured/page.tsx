import { AppNav } from '@/components/app-nav'
import { AuthGuard } from '@/components/auth-guard' 
import { CapturedDashboard } from '@/components/captured-dashboard'

export default function CapturedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav />
      <AuthGuard>
        <CapturedDashboard />
      </AuthGuard>
    </div>
  )
}