import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const session = cookieStore.get('admin_session')
  return session?.value === 'authenticated'
}

export async function GET() {
  try {
    const persons = await sql`
      SELECT id, name, email, phone, address, date_of_birth, notes,
             photo_base64, face_descriptor, created_at, updated_at
      FROM persons
      ORDER BY name ASC
    `
    const result = Array.isArray(persons) ? persons : Object.values(persons || {})
    const mapped = result.map((row: any) => ({
      ...row,
      face_descriptor: row.face_descriptor ? JSON.parse(row.face_descriptor) : null,
    }))
    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Failed to fetch persons:', error)
    return NextResponse.json(
      { error: 'Failed to fetch persons' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    if (!isAuthenticated(cookieStore)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, address, date_of_birth, notes, photo_base64, face_descriptor } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const descriptorJson = face_descriptor
      ? JSON.stringify(face_descriptor)
      : null

    const rows = await sql`
      INSERT INTO persons (name, email, phone, address, date_of_birth, notes, photo_base64, face_descriptor)
      VALUES (${name.trim()}, ${email || null}, ${phone || null}, ${address || null}, ${date_of_birth || null}, ${notes || null}, ${photo_base64 || null}, ${descriptorJson})
      RETURNING *
    `

    const person = {
      ...rows[0],
      face_descriptor: rows[0].face_descriptor
        ? JSON.parse(rows[0].face_descriptor)
        : null,
    }

    return NextResponse.json(person, { status: 201 })
  } catch (error) {
    console.error('Failed to create person:', error)
    return NextResponse.json(
      { error: 'Failed to create person' },
      { status: 500 }
    )
  }
}
