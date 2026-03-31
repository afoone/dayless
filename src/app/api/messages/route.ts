import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/messages - List messages for a team with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId query parameter is required' },
        { status: 400 }
      )
    }

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where: { teamId },
        orderBy: { createdAt: 'asc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.message.count({
        where: { teamId },
      }),
    ])

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
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
    const { teamId, senderId, senderName, content, senderType, metadata } = body

    if (!teamId || !content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'teamId and content are required' },
        { status: 400 }
      )
    }

    // Verify team exists
    const team = await db.team.findUnique({ where: { id: teamId } })
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    const message = await db.message.create({
      data: {
        teamId,
        senderId: senderId || null,
        senderName: senderName || 'System',
        senderType: senderType || 'member',
        content: content.trim(),
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    return NextResponse.json({ success: true, message }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create message' },
      { status: 500 }
    )
  }
}
