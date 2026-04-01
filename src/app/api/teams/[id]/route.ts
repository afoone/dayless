import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPrisma } from '@/lib/prisma-fresh'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const team = await withPrisma((p) =>
      p.team.findUnique({
        where: { id },
        include: {
          members: true,
          projects: true,
          _count: { select: { messages: true, knowledge: true, reports: true } },
        },
      })
    )
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
    const data: Record<string, string | null | undefined> = {}
    if (typeof body.name === 'string') data.name = body.name
    if ('description' in body) data.description = body.description == null ? null : String(body.description)
    if (typeof body.color === 'string') data.color = body.color
    if (typeof body.storyPointGuide === 'string') data.storyPointGuide = body.storyPointGuide
    if (body.storyPointGuide === null) data.storyPointGuide = null
    if (Object.keys(data).length === 0) {
      const team = await withPrisma((p) => p.team.findUnique({ where: { id } }))
      if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
      return NextResponse.json({ success: true, data: team })
    }
    const team = await withPrisma((p) => p.team.update({ where: { id }, data }))
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
