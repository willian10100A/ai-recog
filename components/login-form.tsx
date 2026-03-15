'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils' // ← shadcn / tailwind-merge helper (optional – remove if not using)

export function LoginForm() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })

      let data
      try {
        data = await res.json()
      } catch {
        data = {}
      }

      if (res.ok) {
        toast.success('Login successful')

        // Critical fix: replace + refresh to force auth-aware RSC re-render
        router.replace('/manage')
        router.refresh()

        // Optional: fallback full reload if the above still fails in some edge cases
        // setTimeout(() => window.location.href = '/manage', 100)
      } else {
        const errMsg = data.error || 'Invalid password'
        setError(errMsg)
        toast.error(errMsg)
        setPassword('')
        inputRef.current?.focus()
      }
    } catch (err) {
      const msg = 'Network error — please try again'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 pb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground">
              Admin Access
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the admin password to manage persons
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Enter admin password"
              autoFocus
              autoComplete="current-password"
              disabled={loading}
              className={cn(
                "w-full rounded-lg border bg-secondary px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all",
                error && "border-destructive focus:border-destructive focus:ring-destructive/50",
                loading && "opacity-70 cursor-not-allowed"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
              loading && "bg-primary/80"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Sign In
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Contact your administrator if you don't know the password.
          </p>
        </form>
      </div>
    </div>
  )
}