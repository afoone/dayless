import { NextRequest, NextResponse } from 'next/server'
import { withPrisma } from '@/lib/prisma-fresh'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: ticketId } = await params
    const limit = Number(new URL(request.url).searchParams.get('limit') || '100')
    const messages = await withPrisma(async (db) =>
      db.ticketMessage.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })
    )
    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: ticketId } = await params
    const body = await request.json()
    const { senderId, senderName, senderType, content, metadata } = body

    if (!content) {
      return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 })
    }

    const ticket = await withPrisma(async (db) => db.ticket.findUnique({ where: { id: ticketId } }))
    if (!ticket) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })

    const message = await withPrisma(async (db) =>
      db.ticketMessage.create({
        data: {
          ticketId,
          senderId: senderId || null,
          senderName: senderName || 'Anonymous',
          senderType: senderType || 'member',
          content,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      })
    )

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
