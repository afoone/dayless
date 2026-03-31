import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')

    const knowledge = await db.knowledgeEntry.findMany({
      where: {
        ...(teamId ? { teamId } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return NextResponse.json({ success: true, data: knowledge })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, key, value, source, category, confidence } = body
    if (!teamId || !key || !value) {
      return NextResponse.json({ success: false, error: 'teamId, key and value are required' }, { status: 400 })
    }
    const entry = await db.knowledgeEntry.create({
      data: {
        teamId, key, value,
        source: source || null,
        category: category || 'general',
        confidence: confidence || 80,
      },
    })
    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
