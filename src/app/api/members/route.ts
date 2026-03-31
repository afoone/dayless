import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const members = await db.teamMember.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { standups: true } } },
    })
    return NextResponse.json({ success: true, data: members })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, name, role, email, avatar } = body
    if (!teamId || !name) {
      return NextResponse.json({ success: false, error: 'teamId and name are required' }, { status: 400 })
    }
    const member = await db.teamMember.create({
      data: {
        teamId,
        name,
        role: role || 'Developer',
        email: email || null,
        avatar: avatar || null,
      },
    })
    return NextResponse.json({ success: true, data: member })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
