import { NextRequest, NextResponse } from 'next/server'
import { assertMemberChatProjectAccess } from '@/lib/chat-project-access'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as {
      teamId: string
      ownerMemberId: string
      projectId: string
    }

    if (!body?.teamId || !body?.ownerMemberId || !body?.projectId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const access = await assertMemberChatProjectAccess(body.teamId, body.ownerMemberId, body.projectId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: 403 })
    }

    const systemMessage = await db.message.create({
      data: {
        teamId: body.teamId,
        ownerMemberId: body.ownerMemberId,
        projectId: body.projectId,
        senderId: null,
        senderName: 'Dayless.ai',
        senderType: 'system',
        content: `❎ Acción descartada (${id})`,
      },
    })

    return NextResponse.json({ success: true, data: { message: systemMessage } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
