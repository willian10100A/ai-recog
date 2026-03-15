import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { person_id, confidence } = await request.json()

    if (!person_id) {
      return NextResponse.json(
        { error: 'person_id is required' },
        { status: 400 }
      )
    }

    await sql`
      INSERT INTO recognition_logs (person_id, confidence)
      VALUES (${person_id}, ${confidence || 0})
    `

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Failed to log recognition:', error)
    return NextResponse.json(
      { error: 'Failed to log recognition' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT rl.*, p.name as person_name
      FROM recognition_logs rl
      JOIN persons p ON p.id = rl.person_id
      ORDER BY rl.recognized_at DESC
      LIMIT 50
    `
    const result = Array.isArray(rows) ? rows : Object.values(rows || {})
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to fetch logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
