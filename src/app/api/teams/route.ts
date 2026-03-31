import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const teams = await db.team.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, projects: true, messages: true } },
      },
    })
    return NextResponse.json({ success: true, data: teams })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, color } = body
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }
    const team = await db.team.create({
      data: { name, description: description || null, color: color || '#10b981' },
    })
    return NextResponse.json({ success: true, data: team })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
