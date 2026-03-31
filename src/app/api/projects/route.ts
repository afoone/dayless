import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const projects = await db.project.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: projects })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, name, description, status, jiraProjectKey, jiraBaseUrl, githubRepo } = body
    if (!teamId || !name) {
      return NextResponse.json({ success: false, error: 'teamId and name are required' }, { status: 400 })
    }
    const project = await db.project.create({
      data: {
        teamId, name,
        description: description || null,
        status: status || 'active',
        jiraProjectKey: jiraProjectKey || null,
        jiraBaseUrl: jiraBaseUrl || null,
        githubRepo: githubRepo || null,
      },
    })
    return NextResponse.json({ success: true, data: project })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
