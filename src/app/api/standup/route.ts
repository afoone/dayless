import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const date = searchParams.get('date')
    const memberId = searchParams.get('memberId')

    const standups = await db.standupCheckin.findMany({
      where: {
        ...(teamId ? { member: { teamId } } : {}),
        ...(date ? { date } : {}),
        ...(memberId ? { memberId } : {}),
      },
      orderBy: { date: 'desc' },
      include: { member: { select: { name: true, role: true, avatar: true } } },
      take: 50,
    })
    return NextResponse.json({ success: true, data: standups })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { memberId, date, yesterdayWork, todayPlan, blockers, mood } = body
    if (!memberId || !date) {
      return NextResponse.json({ success: false, error: 'memberId and date are required' }, { status: 400 })
    }
    const standup = await db.standupCheckin.upsert({
      where: { memberId_date: { memberId, date } },
      update: { yesterdayWork, todayPlan, blockers, mood },
      create: { memberId, date, yesterdayWork, todayPlan, blockers, mood },
    })
    return NextResponse.json({ success: true, data: standup })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
