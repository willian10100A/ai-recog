'use client'

import { useState } from 'react'
import { Plus, Users, Search, Loader2, ScanFace, Trash2, X } from 'lucide-react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { PersonCard } from '@/components/person-card'
import { PersonForm } from '@/components/person-form'
import type { Person } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function ManageDashboard() {
  const {
    data: persons,
    isLoading,
    mutate,
  } = useSWR<Person[]>('/api/persons', fetcher)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | null>(null)
  const [selectedPersons, setSelectedPersons] = useState<Set<number>>(new Set())
  const [viewingPhoto, setViewingPhoto] = useState<Person | null>(null)

  const filteredPersons = (persons || []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search) ||
    p.id.toString().includes(search) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  )

  const enrolledCount = (persons || []).filter(
    (p) => p.face_descriptor
  ).length

 const handleDelete = async (person: Person) => {
  if (!confirm(`Delete ${person.name}?`)) return;

  const originalPersons = persons || [];

  // Optimistic update
  mutate(
    originalPersons.filter(p => p.id !== person.id),
    { revalidate: false } // don't fetch yet
  );

  try {
    console.log(`DELETE /api/persons/${person.id}`);

    const res = await fetch(`/api/persons/${person.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    console.log('DELETE status:', res.status);

    if (!res.ok) {
      const errText = await res.text().catch(() => 'No response body');
      console.error('Delete failed:', res.status, errText);
      throw new Error(`Delete failed (${res.status})`);
    }

    toast.success(`${person.name} deleted`);
    mutate(); // revalidate from server
  } catch (err) {
    console.error(err);
    toast.error('Failed to delete person');
    mutate(originalPersons, { revalidate: false }); // rollback
  }
};

  const handleBulkDelete = async () => {
    const selectedArray = Array.from(selectedPersons)
    if (selectedArray.length === 0) return

    const personNames = selectedArray.map(id => {
      const person = persons?.find(p => p.id === id)
      return person?.name || `Person ${id}`
    }).join(', ')

    if (!confirm(`Are you sure you want to delete ${selectedArray.length} person(s): ${personNames}?`)) return

    try {
      const deletePromises = selectedArray.map(id =>
        fetch(`/api/persons/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      )

      const results = await Promise.all(deletePromises)
      const failed = results.filter(r => !r.ok).length

      if (failed > 0) {
        toast.error(`Failed to delete ${failed} person(s)`)
      } else {
        toast.success(`${selectedArray.length} person(s) deleted`)
      }

      setSelectedPersons(new Set())
      mutate()
    } catch {
      toast.error('Failed to delete persons')
    }
  }

  const handleSelectPerson = (personId: number, selected: boolean) => {
    const newSelected = new Set(selectedPersons)
    if (selected) {
      newSelected.add(personId)
    } else {
      newSelected.delete(personId)
    }
    setSelectedPersons(newSelected)
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedPersons(new Set(filteredPersons.map(p => p.id)))
    } else {
      setSelectedPersons(new Set())
    }
  }

  const handleEdit = (person: Person) => {
    setEditPerson(person)
    setShowForm(true)
  }

  const handleSave = () => {
    setShowForm(false)
    setEditPerson(null)
    mutate()
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditPerson(null)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Person Management
              </h1>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {persons?.length || 0} persons
                </span>
                <span className="flex items-center gap-1">
                  <ScanFace className="h-3 w-3" />
                  {enrolledCount} enrolled
                </span>
                {selectedPersons.size > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {selectedPersons.size} selected
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedPersons.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedPersons.size})
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search persons..."
                className="w-64 rounded-lg border border-border bg-secondary pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => {
                setEditPerson(null)
                setShowForm(true)
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Person
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPersons.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {search ? 'No matches found' : 'No persons added yet'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? 'Try a different search term'
                    : 'Add a person with their photo to enable face recognition'}
                </p>
              </div>
              {!search && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Add First Person
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={filteredPersons.length > 0 && selectedPersons.size === filteredPersons.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="select-all" className="text-sm font-medium text-foreground">
                  Select All ({filteredPersons.length})
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredPersons.map((person) => (
                  <div key={person.id} onClick={() => person.photo_base64 && setViewingPhoto(person)} className="cursor-pointer">
                    <PersonCard
                      person={person}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isSelected={selectedPersons.has(person.id)}
                      onSelect={(selected) => handleSelectPerson(person.id, selected)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side panel for form */}
      {showForm && (
        <div className="flex w-96 shrink-0 flex-col border-l border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editPerson ? 'Edit Person' : 'Add New Person'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <PersonForm
              person={editPerson}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-card shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setViewingPhoto(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur transition-colors hover:bg-black/80"
              aria-label="Close photo viewer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Photo Container */}
            <div className="flex flex-col items-center justify-center bg-secondary p-8">
              <img
                src={viewingPhoto.photo_base64 || ''}
                alt={`Photo of ${viewingPhoto.name}`}
                className="max-h-[70vh] max-w-[70vw] rounded-lg object-contain"
              />
            </div>

            {/* Info Section */}
            <div className="border-t border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{viewingPhoto.name}</h3>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {viewingPhoto.email && <div>Email: {viewingPhoto.email}</div>}
                {viewingPhoto.phone && <div>Phone: {viewingPhoto.phone}</div>}
                {viewingPhoto.address && <div>Address: {viewingPhoto.address}</div>}
                {viewingPhoto.date_of_birth && (
                  <div>
                    DOB:{' '}
                    {new Date(viewingPhoto.date_of_birth).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
