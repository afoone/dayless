import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getIssue, updateIssue, addIssueComment, getIssueComments, buildConfigFromProject } from '@/lib/github'

// GET /api/github/issues/[id]?projectId=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: issueNumber } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const includeComments = searchParams.get('comments') === 'true'

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const config = buildConfigFromProject(project)
    if (!config) {
      return NextResponse.json({ success: false, error: 'GitHub not configured' }, { status: 400 })
    }

    const issue = await getIssue(config, parseInt(issueNumber))
    let comments = null
    if (includeComments) {
      comments = await getIssueComments(config, parseInt(issueNumber))
    }

    return NextResponse.json({ success: true, data: { ...issue, comments } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// PATCH /api/github/issues/[id]?projectId=xxx - Update issue
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: issueNumber } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const config = buildConfigFromProject(project)
    if (!config) {
      return NextResponse.json({ success: false, error: 'GitHub not configured' }, { status: 400 })
    }

    const body = await request.json()
    const { title, body: issueBody, state, labels, assignees } = body

    const issue = await updateIssue(config, parseInt(issueNumber), {
      title, body: issueBody, state, labels, assignees,
    })

    await db.integrationLog.create({
      data: {
        teamId: project.teamId,
        type: 'github',
        action: `issue_${state || 'updated'}`,
        externalId: issueNumber,
        data: JSON.stringify({ title: issue.title, state: issue.state }),
        status: 'success',
      },
    })

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/github/issues/[id]/comment?projectId=xxx - Add comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: issueNumber } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const isComment = searchParams.get('comment') === 'true'

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const config = buildConfigFromProject(project)
    if (!config) {
      return NextResponse.json({ success: false, error: 'GitHub not configured' }, { status: 400 })
    }

    const body = await request.json()

    // If ?comment=true, add a comment; otherwise, update the issue
    if (isComment && body.body) {
      const comment = await addIssueComment(config, parseInt(issueNumber), body.body)
      return NextResponse.json({ success: true, data: comment })
    }

    return NextResponse.json({ success: false, error: 'Use ?comment=true to add a comment' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
