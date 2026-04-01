import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveAuthContext } from '@/lib/auth-context'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

async function assertMemberAccess(memberId: string, userId: string) {
  const member = await db.teamMember.findFirst({
    where: { id: memberId },
    select: { id: true, userId: true },
  })
  if (!member) {
    throw new Error('NOT_FOUND')
  }
  if (member.userId !== userId) {
    throw new Error('FORBIDDEN')
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthContext(request)
    const memberId = request.nextUrl.searchParams.get('memberId')
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true'
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 50), 100)

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId is required' }, { status: 400 })
    }
    await assertMemberAccess(memberId, ctx.user.id)

    const notifications = await db.notification.findMany({
      where: {
        memberId,
        isRead: unreadOnly ? false : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: notifications })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveAuthContext(request)
    const memberId = request.nextUrl.searchParams.get('memberId')
    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId is required' }, { status: 400 })
    }
    await assertMemberAccess(memberId, ctx.user.id)

    const result = await db.notification.updateMany({
      where: { memberId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true, data: { updated: result.count } })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }
    return errorResponse(error)
  }
}
