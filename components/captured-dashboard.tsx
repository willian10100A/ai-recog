'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, X, Clock, ImageOff, Image as ImageIcon } from 'lucide-react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { PersonCard } from '@/components/person-card'
import type { Person } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Capture {
  id: number
  image_base64: string
  created_at: string
  confidence?: number
}

export function CapturedDashboard() {
  const { data: persons, isLoading, mutate } = useSWR<Person[]>('/api/persons', fetcher)
  const [search, setSearch] = useState('')
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [loadingCaptures, setLoadingCaptures] = useState(false)
  const [fullView, setFullView] = useState<{
    src: string
    title: string
    type: 'live' | 'stored'
  } | null>(null)

  // Filter persons
  const filteredPersons = (persons || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.id.toString().includes(search) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  )

  const enrolledCount = (persons || []).filter(p => p.face_descriptor).length

  // Delete person
  const handleDelete = async (person: Person) => {
    if (!confirm(`Are you sure you want to delete ${person.name}?`)) return
    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success(`${person.name} deleted`)
      mutate()
    } catch {
      toast.error('Failed to delete person')
    }
  }

  // // Load captures
  // const loadCaptures = async (person: Person) => {
  //   setViewingPerson(person)
  //   setLoadingCaptures(true)
  //   setCaptures([])

  //   try {
  //     const res = await fetch(`/api/persons/${person.id}/captures`)
  //     if (!res.ok) throw new Error('Failed to fetch captures')
  //     const data: Capture[] = await res.json()

  //     const getTime = (d: string) => new Date(d).getTime() || 0
  //     const sorted = data.sort((a, b) => getTime(b.created_at) - getTime(a.created_at))
  //     setCaptures(sorted)
  //   } catch (err) {
  //     console.error('Error loading captures:', err)
  //     toast.error('Failed to load recognition captures')
  //   } finally {
  //     setLoadingCaptures(false)
  //   }
  // }

  // Format timestamp
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Escape key to close full view
  useEffect(() => {
    if (!fullView) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullView(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [fullView])

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Captured Images</h1>
        <span className="text-sm text-muted-foreground">
          {enrolledCount} enrolled • {persons?.length || 0} total
        </span>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, phone, ID, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
          aria-label="Search persons"
        />
      </div>

      {/* Persons grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredPersons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ImageOff className="h-12 w-12 opacity-40" />
          <p>No persons found matching your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPersons.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onEdit={() => { /* add edit logic if needed */ }}
              onDelete={() => handleDelete(person)}
              // onViewPhoto={() => loadCaptures(person)}
            />
          ))}
        </div>
      )}

      {/* Main Captures Modal */}
      {viewingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl">
            <button
              onClick={() => {
                setViewingPerson(null)
                setCaptures([])
                setFullView(null)
              }}
              className="absolute right-5 top-5 z-10 rounded-full bg-background/80 p-2 hover:bg-background transition-colors"
              aria-label="Close captures modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 md:p-8">
              <h2 className="text-2xl font-semibold mb-1">
                {viewingPerson.name}'s Recognition Captures
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Live detections that matched this person
              </p>

              {/* Reference photo preview */}
              {viewingPerson.photo_base64 && (
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center justify-between">
                    <span>Stored Enrollment Photo (Match Reference)</span>
                    <button
                      onClick={() =>
                        setFullView({
                          src: viewingPerson.photo_base64!,
                          title: `Stored Enrollment Photo – ${viewingPerson.name}`,
                          type: 'stored',
                        })
                      }
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                    >                  
                     
                    </button>
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-border bg-black max-w-sm">
                    <img
                      src={viewingPerson.photo_base64}
                      alt={`Enrollment photo of ${viewingPerson.name}`}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              )}

              {loadingCaptures ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : captures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <ImageOff className="h-12 w-12 opacity-50" />
                  <p className="text-center max-w-md">
                    No live recognition captures recorded for this person yet.
                    <br />
                    <span className="text-xs mt-2 block opacity-70">
                      (Captures saved when confidence ≥ 62% and throttled to 1 per 30 seconds)
                    </span>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {captures.map((cap) => (
                    <div
                      key={cap.id}
                      className="overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="px-4 py-3 bg-secondary/40 border-b flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(cap.created_at)}
                        </div>
                        {cap.confidence !== undefined && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {Math.round(cap.confidence * 100)}% match
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-px bg-border">
                        {/* Live Capture */}
                        <div className="bg-black p-3">
                          <div className="text-center text-xs font-semibold text-primary/80 mb-2">
                            Live Capture
                          </div>
                          <div className="overflow-hidden rounded-lg relative group">
                            <img
                              src={cap.image_base64}
                              alt={`Live capture of ${viewingPerson.name}`}
                              className="w-full h-48 object-cover cursor-pointer"
                              loading="lazy"
                              decoding="async"
                            />
                            <button
                              onClick={() =>
                                setFullView({
                                  src: cap.image_base64,
                                  title: `Live Capture – ${formatDate(cap.created_at)}`,
                                  type: 'live',
                                })
                              }
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <div className="bg-background/90 text-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                                <ImageIcon className="h-3.5 w-3.5" />
                                Full Size
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Stored Match */}
                        <div className="bg-black p-3 flex flex-col">
                          <div className="text-center text-xs font-semibold text-emerald-500/80 mb-2">
                            Stored Match
                          </div>
                          <div className="overflow-hidden rounded-lg flex-1 relative group">
                            {viewingPerson.photo_base64 ? (
                              <>
                                <img
                                  src={viewingPerson.photo_base64}
                                  alt={`Stored photo of ${viewingPerson.name}`}
                                  className="w-full h-48 object-cover cursor-pointer"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <button
                                  onClick={() =>
                                    setFullView({
                                      src: viewingPerson.photo_base64!,
                                      title: `Stored Enrollment Photo – ${viewingPerson.name}`,
                                      type: 'stored',
                                    })
                                  }
                                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <div className="bg-background/90 text-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Full Size
                                  </div>
                                </button>
                              </>
                            ) : (
                              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                No enrollment photo
                              </div>
                            )}
                          </div>

                          {viewingPerson.photo_base64 && (
                            <button
                              onClick={() =>
                                setFullView({
                                  src: viewingPerson.photo_base64!,
                                  title: `Stored Enrollment Photo – ${viewingPerson.name}`,
                                  type: 'stored',
                                })
                              }
                                >
                              
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-size Photo Lightbox */}
      {fullView && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setFullView(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setFullView(null)}
              className="absolute -top-12 right-0 text-white bg-black/60 rounded-full p-3 hover:bg-black/80 transition"
              aria-label="Close full size view"
            >
              <X className="h-6 w-6" />
            </button>

            <img
              src={fullView.src}
              alt={fullView.title}
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />

            <div className="mt-4 text-center text-white/90 text-sm">
              {fullView.title}
              {fullView.type === 'live' && (
                <span className="ml-2 text-white/60 text-xs">(Live detection)</span>
              )}
              {fullView.type === 'stored' && (
                <span className="ml-2 text-white/60 text-xs">(Enrollment reference)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}