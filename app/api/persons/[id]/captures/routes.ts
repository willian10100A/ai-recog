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
    const rows = await sql`SELECT * FROM captures WHERE person_id = ${parseInt(id)}`

    return NextResponse.json(rows)
  } catch (error) {
    console.error('Failed to fetch captures:', error)
    return NextResponse.json(
      { error: 'Failed to fetch captures' },
      { status: 500 }
    )
  }
}