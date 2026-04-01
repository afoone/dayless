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

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthContext(request)
    const memberId = request.nextUrl.searchParams.get('memberId')
    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId is required' }, { status: 400 })
    }

    const member = await db.teamMember.findUnique({
      where: { id: memberId },
      select: { userId: true },
    })
    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }
    if (member.userId !== ctx.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const unreadCount = await db.notification.count({
      where: { memberId, isRead: false },
    })

    return NextResponse.json({ success: true, data: { unreadCount } })
  } catch (error) {
    return errorResponse(error)
  }
}
