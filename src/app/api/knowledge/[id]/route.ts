import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const entry = await db.knowledgeEntry.update({
      where: { id },
      data: {
        key: body.key,
        value: body.value,
        source: body.source,
        category: body.category,
        confidence: body.confidence,
        isVerified: body.isVerified,
      },
    })
    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.knowledgeEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
