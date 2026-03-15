'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Loader2,
  AlertCircle,
  Users,
  Zap,
  History,
} from 'lucide-react'
import useSWR from 'swr'
import { MatchedPersonPanel } from './matched-person-panel'
import type { Person, RecognitionMatch } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type FaceApi = typeof import('@vladmandic/face-api')

// Local type for the improved in-memory history (includes the actual captured frame)
type RecentRecognition = {
  id: string
  person: Person
  confidence: number
  timestamp: Date
  captureImage: string
  status?: 'pending' | 'saved' | 'failed'
}

export function LiveRecognition() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const detectingRef = useRef(false)
  const faceapiRef = useRef<FaceApi | null>(null)
  const matcherRef = useRef<InstanceType<FaceApi['FaceMatcher']> | null>(null)
  // Throttle logging to DB per person (30 seconds)
  const lastLoggedRef = useRef<Record<number, number>>({})

  const [cameraActive, setCameraActive] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMatches, setCurrentMatches] = useState<RecognitionMatch[]>([])
  const [faceZooms, setFaceZooms] = useState<string[]>([])
  const [detectionFps, setDetectionFps] = useState(0)

  // Improved recent recognition history (local, instant, with captured images)
  const [recentLogs, setRecentLogs] = useState<RecentRecognition[]>([])

  const { data: persons } = useSWR<Person[]>('/api/persons', fetcher, {
    refreshInterval: 10000,
  })

  // Constants 
  const DISPLAY_THRESHOLD = 0.50      // show name on overlay
  const ACTION_THRESHOLD = 0.50       // actually log + save capture
  const FACE_MATCHER_THRESHOLD = 0.50 // stricter than default 0.6
  const MIN_FACE_AREA = 10000          // ~100×100 px – skip tiny/distant faces
  const CAPTURE_QUALITY = 0.85        // fixed high quality (no auto)
  const LOG_THROTTLE_MS = 30000
  const MAX_HISTORY = 20

  const buildMatcher = useCallback(
    (faceapi: FaceApi, personList: Person[]) => {
      const personsWithFaces = personList.filter(
        (p) => p.face_descriptor && p.face_descriptor.length === 128
      )
      if (personsWithFaces.length === 0) {
        matcherRef.current = null
        return
      }

      const labeledDescriptors = personsWithFaces.map((p) => {
        const desc = new Float32Array(p.face_descriptor!)
        return new faceapi.LabeledFaceDescriptors(String(p.id), [desc])
      })

      matcherRef.current = new faceapi.FaceMatcher(
        labeledDescriptors,
        FACE_MATCHER_THRESHOLD
      )
    },
    []
  )

  useEffect(() => {
    if (faceapiRef.current && persons && modelsLoaded) {
      buildMatcher(faceapiRef.current, persons)
    }
  }, [persons, modelsLoaded, buildMatcher])

  const loadModels = useCallback(async () => {
    if (modelsLoaded && faceapiRef.current) return true

    try {
      const faceapi = await import('@vladmandic/face-api')
      faceapiRef.current = faceapi

      const MODEL_URL = '/models'
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])

      setModelsLoaded(true)

      if (persons) {
        buildMatcher(faceapi, persons)
      }

      return true
    } catch (err) {
      console.error('Failed to load face-api models:', err)
      setError('Failed to load face recognition models. Please ensure model files exist under `/public/models`.')
      return false
    }
  }, [modelsLoaded, persons, buildMatcher])

  const captureZoomFace = useCallback(
    (
      video: HTMLVideoElement,
      box: { x: number; y: number; width: number; height: number },
      quality: number
    ) => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const padding = 70 // improved padding for better context
      const sx = Math.max(0, box.x - padding)
      const sy = Math.max(0, box.y - padding)
      const sw = Math.min(video.videoWidth - sx, box.width + padding * 2)
      const sh = Math.min(video.videoHeight - sy, box.height + padding * 2)

      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)
      return canvas.toDataURL('image/jpeg', quality)
    },
    []
  )

  const drawOverlay = useCallback(
    (
      detections: Array<{
        detection: { box: { x: number; y: number; width: number; height: number } }
      }>,
      labels: Array<string | null>,
      videoWidth: number,
      videoHeight: number
    ) => {
      const overlay = overlayRef.current
      if (!overlay) return

      overlay.width = videoWidth
      overlay.height = videoHeight
      const ctx = overlay.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, videoWidth, videoHeight)

      detections.forEach((d, idx) => {
        const { x, y, width, height } = d.detection.box

        const matchLabel = labels[idx] ?? null
        const isMatch = matchLabel && matchLabel !== 'unknown'
        ctx.strokeStyle = isMatch
          ? 'oklch(0.72 0.19 170)'
          : 'oklch(0.60 0.02 220)'
        ctx.lineWidth = 2
        ctx.setLineDash(isMatch ? [] : [6, 4])

        ctx.strokeRect(x, y, width, height)

        const cornerLen = 14
        ctx.lineWidth = 3
        ctx.setLineDash([])

        // Top-left
        ctx.beginPath()
        ctx.moveTo(x, y + cornerLen)
        ctx.lineTo(x, y)
        ctx.lineTo(x + cornerLen, y)
        ctx.stroke()

        // Top-right
        ctx.beginPath()
        ctx.moveTo(x + width - cornerLen, y)
        ctx.lineTo(x + width, y)
        ctx.lineTo(x + width, y + cornerLen)
        ctx.stroke()

        // Bottom-left
        ctx.beginPath()
        ctx.moveTo(x, y + height - cornerLen)
        ctx.lineTo(x, y + height)
        ctx.lineTo(x + cornerLen, y + height)
        ctx.stroke()

        // Bottom-right
        ctx.beginPath()
        ctx.moveTo(x + width - cornerLen, y + height)
        ctx.lineTo(x + width, y + height)
        ctx.lineTo(x + width, y + height - cornerLen)
        ctx.stroke()

        if (matchLabel && matchLabel !== 'unknown') {
          const matchedPerson = persons?.find((p) => String(p.id) === matchLabel)
          const displayName = matchedPerson?.name || matchLabel
          ctx.font = '600 14px Geist, sans-serif'
          const textWidth = ctx.measureText(displayName).width
          const labelPadding = 6

          ctx.fillStyle = 'oklch(0.72 0.19 170)'
          ctx.fillRect(x, y - 28, textWidth + labelPadding * 2, 24)
          ctx.fillStyle = 'oklch(0.13 0.005 250)'
          ctx.fillText(displayName, x + labelPadding, y - 10)
        }
      })
    },
    [persons]
  )
const saveRecognitionCapture = async (personId: number, image: string, confidence: number) => {
  console.log(`[API CALL] POST /api/captures - person_id=${personId}, confidence=${confidence}, base64 length=${image.length}`);

  try {
    const res = await fetch('/api/captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: personId,
        image_base64: image,
        confidence,
      }),
    });

    console.log(`[API RESPONSE] Status: ${res.status}`);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('[API ERROR]', errData.error || res.statusText);
      // toast.error("Failed to save capture") if you have sonner
    } else {
      console.log('[SAVE SUCCESS] Capture saved to database');
    }
  } catch (err) {
    console.error('[NETWORK ERROR] Failed to reach /api/captures:', err);
  }
};

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 10) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const runDetection = useCallback(async () => {

    const faceapi = faceapiRef.current
    const video = videoRef.current

    if (
      !faceapi ||
      !video ||
      !cameraActive ||
      detectingRef.current ||
      video.readyState < 2
    ) {
      if (cameraActive) {
        animFrameRef.current = requestAnimationFrame(runDetection)
      }
      return
    }

    detectingRef.current = true
    const startTime = performance.now()

    try {

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors()

      const elapsed = performance.now() - startTime
      setDetectionFps(Math.round(1000 / elapsed))

      if (detections.length > 0 && matcherRef.current) {

        const matches: RecognitionMatch[] = []
        const labels: Array<string | null> = []

        for (let i = 0; i < detections.length; i++) {

          const d = detections[i]
          const box = d.detection.box

          labels.push(null)

          if (box.width * box.height < MIN_FACE_AREA) continue

          const best = matcherRef.current.findBestMatch(d.descriptor)

          if (best.label !== 'unknown') {

            const person = persons?.find(
              (p) => String(p.id) === best.label
            )

            if (!person) continue

            const confidence = 1 - best.distance

            if (confidence >= DISPLAY_THRESHOLD) {
              labels[i] = best.label
            }

            if (confidence >= ACTION_THRESHOLD) {

              if (!matches.find(m => m.person.id === person.id)) {
                matches.push({
                  person,
                  confidence,
                  distance: 0
                })
              }

              const now = Date.now()
              const last = lastLoggedRef.current[person.id] || 0

              if (now - last > LOG_THROTTLE_MS) {

                lastLoggedRef.current[person.id] = now

                const zoom = captureZoomFace(video, box, CAPTURE_QUALITY)

                if (zoom) {

                  const log: RecentRecognition = {
                    id: crypto.randomUUID(),
                    person,
                    confidence,
                    timestamp: new Date(),
                    captureImage: zoom,
                    status: 'saved'
                  }

                  setRecentLogs(prev => [log, ...prev].slice(0, MAX_HISTORY))

                  saveRecognitionCapture(person.id, zoom, confidence)
                }
              }
            }
          }
        }

        setCurrentMatches(matches)

        drawOverlay(
          detections,
          labels,
          video.videoWidth,
          video.videoHeight
        )
      }

    } catch (err) {

      console.error('Detection error:', err)

    }

    detectingRef.current = false

    if (cameraActive) {
      animFrameRef.current = requestAnimationFrame(runDetection)
    }

  }, [
    cameraActive,
    persons,
    drawOverlay,
    captureZoomFace
  ])
  useEffect(() => {
    if (cameraActive && modelsLoaded) {
      animFrameRef.current = requestAnimationFrame(runDetection)
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [cameraActive, modelsLoaded, runDetection])

  const startCamera = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const modelsOk = await loadModels()
      if (!modelsOk) {
        setLoading(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise<void>((resolve) => {
          videoRef.current!.onloadeddata = () => resolve()
        })
      }

      setCameraActive(true)
    } catch (err) {
      console.error('Camera start failed:', err)
      setError('Failed to access camera. Please check permissions.')
    } finally {
      setLoading(false)
    }
  }, [loadModels])

  const stopCamera = useCallback(() => {
    setCameraActive(false)
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCurrentMatches([])
    setFaceZooms([])
    // Do NOT clear recentLogs on stop – history persists

    const overlay = overlayRef.current
    if (overlay) {
      const ctx = overlay.getContext('2d')
      ctx?.clearRect(0, 0, overlay.width, overlay.height)
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const enrolledCount = (persons || []).filter((p) => p.face_descriptor).length

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Camera feed */}
      <div className="flex flex-1 flex-col">
        {/* Status bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-foreground">
              Live Recognition
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {enrolledCount} enrolled
              </span>
              {cameraActive && (
                <span className="flex items-center gap-1 text-primary">
                  <Zap className="h-3 w-3" />
                  {detectionFps} FPS
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cameraActive && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="text-xs font-medium text-primary">LIVE</span>
              </div>
            )}
            <button
              onClick={cameraActive ? stopCamera : startCamera}
              disabled={loading}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                cameraActive
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              } disabled:opacity-50`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : cameraActive ? (
                <CameraOff className="h-4 w-4" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {loading
                ? 'Loading models...'
                : cameraActive
                  ? 'Stop Camera'
                  : 'Start Camera'}
            </button>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="relative flex flex-1 items-center justify-center bg-black/40 overflow-hidden">
          {!cameraActive && !loading && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/50">
                <Camera className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Camera Off</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Click &ldquo;Start Camera&rdquo; to begin real-time face
                  recognition
                </p>
              </div>
              {enrolledCount === 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  No persons enrolled yet. Add persons in the Manage page first.
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading AI models...
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="max-w-xs text-sm text-destructive">{error}</p>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-contain ${
              cameraActive ? 'block' : 'hidden'
            }`}
          />
          <canvas
            ref={overlayRef}
            className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${
              cameraActive ? 'block' : 'hidden'
            }`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {cameraActive && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-scan-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            </div>
          )}

          {/* Live face zoom overlay */}
          {faceZooms.length > 0 && currentMatches.length > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-4">
              {currentMatches.map((match, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-lg border-2 border-primary bg-black/80 shadow-lg shadow-primary/20"
                >
                  <div className="px-2 py-1 text-center text-xs font-semibold text-primary bg-black/60">
                    Detected Face
                  </div>
                  <img
                    src={faceZooms[idx]}
                    alt="Zoomed face"
                    className="h-28 w-28 object-cover"
                  />
                  {match.person.photo_base64 && (
                    <>
                      <div className="mt-1 px-2 py-1 text-center text-xs font-semibold text-primary bg-black/60">
                        Stored Photo
                      </div>
                      <img
                        src={match.person.photo_base64}
                        alt={`Stored photo of ${match.person.name}`}
                        className="h-28 w-28 object-cover"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Match panel + improved history */}
      <div className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
        <div className="flex-1 overflow-hidden">
          <MatchedPersonPanel matches={currentMatches} scanning={cameraActive} />
        </div>

        {/* Better Recognition History – visual thumbnails + instant updates */}
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recognition History
              </h3>
            </div>
            {recentLogs.length > 0 && (
              <button
                onClick={() => setRecentLogs([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto px-4 pb-4">
            {recentLogs.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-3 rounded-2xl bg-secondary/70 p-3 border border-border/60"
                  >
                    <div className="shrink-0 overflow-hidden rounded-xl border border-border">
                      <img
                        src={log.captureImage}
                        alt="Captured recognition"
                        className="h-20 w-20 object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-sm truncate">
                          {log.person.name}
                        </p>
                        <span className="inline-flex items-center rounded bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-primary">
                          {Math.round(log.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {timeAgo(log.timestamp)}
                      </p>
                      {log.person.photo_base64 && (
                        <p className="mt-2 text-[10px] text-emerald-500/80">
                          ✓ Stored photo match
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-center">
                <p className="text-xs text-muted-foreground">
                  Recognitions appear here<br />(30-second throttle per person)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}