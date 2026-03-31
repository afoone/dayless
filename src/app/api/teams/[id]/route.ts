import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const team = await db.team.findUnique({
      where: { id },
      include: {
        members: true,
        projects: true,
        _count: { select: { messages: true, knowledge: true, reports: true } },
      },
    })
    if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: team })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const team = await db.team.update({
      where: { id },
      data: { name: body.name, description: body.description, color: body.color },
    })
    return NextResponse.json({ success: true, data: team })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.team.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
