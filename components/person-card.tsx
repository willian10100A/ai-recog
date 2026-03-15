'use client'

import { User, Edit2, Trash2, Mail, Phone, MapPin, Calendar, ScanFace } from 'lucide-react'
import type { Person } from '@/lib/types'

interface PersonCardProps {
  person: Person
  onEdit: (person: Person) => void
  onDelete: (person: Person) => void
  onViewPhoto?: (person: Person) => void
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  isLoading?: boolean // optional – for skeleton/fallback while fetching
}

export function PersonCard({
  person,
  onEdit,
  onDelete,
  onViewPhoto,
  isSelected = false,
  onSelect,
  isLoading = false,
}: PersonCardProps) {
  const hasFaceData = !!person.face_descriptor
  const formattedDob = person.date_of_birth
    ? new Date(person.date_of_birth).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  if (isLoading) {
    return (
      <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card animate-pulse">
        <div className="aspect-square bg-muted" />
        <div className="p-3 space-y-3">
          <div className="h-5 w-3/4 bg-muted rounded" />
          <div className="space-y-2">
            <div className="h-3 w-5/6 bg-muted rounded" />
            <div className="h-3 w-4/6 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
        group flex flex-col overflow-hidden rounded-lg border bg-card
        transition-all duration-200 hover:shadow-md hover:border-primary/40
        ${onViewPhoto ? 'cursor-pointer' : ''}
      `}
      onClick={() => onViewPhoto?.(person)}
    >
      {/* Photo / Placeholder */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-secondary to-muted/50">
        {person.photo_base64 ? (
          <img
            src={person.photo_base64}
            alt={`Enrollment photo of ${person.name}`}
            title={`${person.name}'s photo`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-20 w-20 text-muted-foreground/40" />
          </div>
        )}

        {/* Face enrolled badge */}
        {hasFaceData && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm backdrop-blur-sm">
            <ScanFace className="h-3.5 w-3.5" />
            Face Enrolled
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {onSelect && (
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelect(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-white/70 bg-black/40 text-primary focus:ring-primary/50"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(person)
                }}
                className="rounded-full bg-black/70 p-2.5 text-white backdrop-blur-md transition hover:bg-black/90 hover:scale-105 active:scale-95"
                aria-label={`Edit ${person.name}`}
              >
                <Edit2 className="h-4 w-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(person)
                }}
                className="rounded-full bg-black/70 p-2.5 text-destructive backdrop-blur-md transition hover:bg-black/90 hover:scale-105 active:scale-95"
                aria-label={`Delete ${person.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="flex flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground">
          {person.name}
        </h3>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {person.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{person.email}</span>
            </div>
          )}
          {person.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{person.phone}</span>
            </div>
          )}
          {person.address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{person.address}</span>
            </div>
          )}
          {formattedDob && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{formattedDob}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}