import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getIssue, updateIssue, addComment, getIssueComments, buildConfigFromProject } from '@/lib/jira'

// GET /api/jira/[key]?projectId=xxx&comments=true
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: issueKey } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const withComments = searchParams.get('comments') === 'true'

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const setup = buildConfigFromProject(project)
    if (!setup) {
      return NextResponse.json({ success: false, error: 'Jira not configured' }, { status: 400 })
    }

    const issue = await getIssue(setup.config, issueKey)

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// PATCH /api/jira/[key]?projectId=xxx - Update issue (status, priority, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: issueKey } = await params
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const setup = buildConfigFromProject(project)
    if (!setup) {
      return NextResponse.json({ success: false, error: 'Jira not configured' }, { status: 400 })
    }

    const body = await request.json()
    const { summary, description, status, priority, labels } = body

    const issue = await updateIssue(setup.config, issueKey, {
      summary, description, status, priority, labels,
    })

    await db.integrationLog.create({
      data: {
        teamId: project.teamId,
        type: 'jira',
        action: `issue_updated${status ? ` -> ${status}` : ''}`,
        externalId: issueKey,
        data: JSON.stringify({ key: issueKey, summary: issue.fields.summary, status: issue.fields.status?.name }),
        status: 'success',
      },
    })

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/jira/[key]?projectId=xxx&comment=true - Add comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: issueKey } = await params
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

    const setup = buildConfigFromProject(project)
    if (!setup) {
      return NextResponse.json({ success: false, error: 'Jira not configured' }, { status: 400 })
    }

    const body = await request.json()

    if (isComment && body.body) {
      const comment = await addComment(setup.config, issueKey, body.body)

      await db.integrationLog.create({
        data: {
          teamId: project.teamId,
          type: 'jira',
          action: 'issue_commented',
          externalId: issueKey,
          data: JSON.stringify({ key: issueKey, comment: body.body.slice(0, 200) }),
          status: 'success',
        },
      })

      return NextResponse.json({ success: true, data: comment })
    }

    return NextResponse.json({ success: false, error: 'Use ?comment=true to add a comment' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
