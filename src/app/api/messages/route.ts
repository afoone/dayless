import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPrisma } from '@/lib/prisma-fresh'
import { assertMemberChatProjectAccess } from '@/lib/chat-project-access'

// GET /api/messages - List messages for a team with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const ownerMemberId = searchParams.get('ownerMemberId')
    const projectId = searchParams.get('projectId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!teamId || !ownerMemberId || !projectId) {
      return NextResponse.json(
        { success: false, error: 'teamId, ownerMemberId and projectId query parameters are required' },
        { status: 400 }
      )
    }

    const access = await assertMemberChatProjectAccess(teamId, ownerMemberId, projectId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: 403 })
    }

    const [messages, total] = await withPrisma((p) =>
      Promise.all([
        p.message.findMany({
          where: { teamId, ownerMemberId, projectId },
          orderBy: { createdAt: 'asc' },
          take: Math.min(limit, 200),
          skip: offset,
        }),
        p.message.count({
          where: { teamId, ownerMemberId, projectId },
        }),
      ])
    )

    return NextResponse.json({
      success: true,
      data: messages,
      error: null,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + messages.length < total,
      },
    })
  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST /api/messages - Create a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, ownerMemberId, projectId, senderId, senderName, content, senderType, metadata } = body

    if (
      !teamId ||
      !ownerMemberId ||
      !projectId ||
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'teamId, ownerMemberId, projectId and content are required' },
        { status: 400 }
      )
    }

    const team = await db.team.findUnique({ where: { id: teamId } })
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    const access = await assertMemberChatProjectAccess(teamId, ownerMemberId, projectId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: 403 })
    }

    const message = await withPrisma((p) =>
      p.message.create({
        data: {
          team: { connect: { id: teamId } },
          owner: { connect: { id: ownerMemberId } },
          project: { connect: { id: projectId } },
          senderId: senderId || null,
          senderName: senderName || 'System',
          senderType: senderType || 'member',
          content: content.trim(),
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      })
    )

    return NextResponse.json({ success: true, data: message, error: null }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create message' },
      { status: 500 }
    )
  }
}
