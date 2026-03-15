'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Upload, X, RotateCcw } from 'lucide-react'

interface PhotoCaptureProps {
  value: string
  onChange: (base64: string) => void
}

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
  const [mode, setMode] = useState<'idle' | 'preview'>(() =>
    value ? 'preview' : 'idle'
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value) setMode('preview')
  }, [value])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()

      reader.onload = (event) => {
        const base64 = event.target?.result as string
        onChange?.(base64)
        setMode('preview')
      }

      reader.readAsDataURL(file)

      e.target.value = ''
    },
    [onChange]
  )

  const clearPhoto = useCallback(() => {
    onChange?.('')
    setMode('idle')
  }, [onChange])

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-foreground">
        Photo <span className="text-muted-foreground">(for face recognition)</span>
      </label>

      {mode === 'idle' && (
        <div className="flex">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Upload className="h-5 w-5" />
            Upload Photo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {mode === 'preview' && value && (
        <div
          className="relative overflow-hidden rounded-lg border border-border"
          aria-live="polite"
        >
          <img
            src={value}
            alt="Uploaded photo"
            className="w-full object-cover"
          />

          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition-colors hover:bg-black/80"
              aria-label="Retake photo"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={clearPhoto}
              className="rounded-full bg-black/60 p-1.5 text-white backdrop-blur transition-colors hover:bg-black/80"
              aria-label="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  )
}