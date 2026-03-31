import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const member = await db.teamMember.findUnique({
      where: { id },
      include: { standups: { orderBy: { date: 'desc' }, take: 10 } },
    })
    if (!member) return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: member })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const member = await db.teamMember.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        email: body.email,
        avatar: body.avatar,
        status: body.status,
      },
    })
    return NextResponse.json({ success: true, data: member })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.teamMember.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
