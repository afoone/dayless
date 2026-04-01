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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await resolveAuthContext(request)

    const notification = await db.notification.findUnique({
      where: { id },
      select: { id: true, memberId: true, isRead: true },
    })
    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 })
    }

    const member = await db.teamMember.findUnique({
      where: { id: notification.memberId },
      select: { userId: true },
    })
    if (!member || member.userId !== ctx.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    if (notification.isRead) {
      return NextResponse.json({ success: true, data: { alreadyRead: true } })
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
