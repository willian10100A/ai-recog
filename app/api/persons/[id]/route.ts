import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

function isAuthenticated(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const session = cookieStore.get('admin_session')
  return session?.value === 'authenticated'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await sql`SELECT * FROM persons WHERE id = ${parseInt(id)}`

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = {
      ...rows[0],
      face_descriptor: rows[0].face_descriptor
        ? JSON.parse(rows[0].face_descriptor)
        : null,
    }

    return NextResponse.json(person)
  } catch (error) {
    console.error('Failed to fetch person:', error)
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    if (!isAuthenticated(cookieStore)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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
      UPDATE persons
      SET name = ${name.trim()},
          email = ${email || null},
          phone = ${phone || null},
          address = ${address || null},
          date_of_birth = ${date_of_birth || null},
          notes = ${notes || null},
          photo_base64 = ${photo_base64 || null},
          face_descriptor = ${descriptorJson},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const person = {
      ...rows[0],
      face_descriptor: rows[0].face_descriptor
        ? JSON.parse(rows[0].face_descriptor)
        : null,
    }

    return NextResponse.json(person)
  } catch (error) {
    console.error('Failed to update person:', error)
    return NextResponse.json(
      { error: 'Failed to update person' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    if (!isAuthenticated(cookieStore)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const rows = await sql`
      DELETE FROM persons WHERE id = ${parseInt(id)} RETURNING id
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete person:', error)
    return NextResponse.json(
      { error: 'Failed to delete person' },
      { status: 500 }
    )
  }
}
