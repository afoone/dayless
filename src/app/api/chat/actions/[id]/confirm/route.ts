import { NextRequest, NextResponse } from 'next/server'
import { assertMemberChatProjectAccess } from '@/lib/chat-project-access'
import type { ChatPendingAction } from '@/lib/chat/types'
import { executeConfirmedChatAction } from '@/lib/chat/action-executor'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      teamId: string
      ownerMemberId: string
      projectId: string
      senderName: string
      action: ChatPendingAction
    }

    if (!body?.teamId || !body?.ownerMemberId || !body?.projectId || !body?.action) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (body.action.id !== id) {
      return NextResponse.json({ success: false, error: 'Action id mismatch' }, { status: 400 })
    }

    const access = await assertMemberChatProjectAccess(body.teamId, body.ownerMemberId, body.projectId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: 403 })
    }

    const resultLine = await executeConfirmedChatAction({
      teamId: body.teamId,
      ownerMemberId: body.ownerMemberId,
      projectId: body.projectId,
      senderName: body.senderName || 'Usuario',
      action: body.action,
    })

    const systemMessage = await db.message.create({
      data: {
        teamId: body.teamId,
        ownerMemberId: body.ownerMemberId,
        projectId: body.projectId,
        senderId: null,
        senderName: 'Dayless.ai',
        senderType: 'system',
        content: resultLine,
      },
    })

    return NextResponse.json({ success: true, data: { message: systemMessage } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
