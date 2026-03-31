import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: project })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const project = await db.project.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        status: body.status,
        jiraProjectKey: body.jiraProjectKey,
        jiraBaseUrl: body.jiraBaseUrl,
        githubRepo: body.githubRepo,
      },
    })
    return NextResponse.json({ success: true, data: project })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
