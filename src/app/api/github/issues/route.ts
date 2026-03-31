import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { listIssues, buildConfigFromProject } from '@/lib/github'

// GET /api/github/issues?projectId=xxx&state=open&per_page=20
export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ success: false, error: 'GitHub not configured for this project. Set githubRepo and githubToken.' }, { status: 400 })
    }

    const params: Parameters<typeof listIssues>[1] = {
      state: (searchParams.get('state') as 'open' | 'closed' | 'all') || 'open',
      sort: (searchParams.get('sort') as 'created' | 'updated' | 'comments') || 'updated',
      direction: (searchParams.get('direction') as 'asc' | 'desc') || 'desc',
      per_page: parseInt(searchParams.get('per_page') || '20'),
      page: parseInt(searchParams.get('page') || '1'),
    }

    if (searchParams.get('labels')) params.labels = searchParams.get('labels')!
    if (searchParams.get('assignee')) params.assignee = searchParams.get('assignee')!

    const issues = await listIssues(config, params)

    return NextResponse.json({ success: true, data: issues, meta: { repo: `${config.owner}/${config.repo}` } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// POST /api/github/issues?projectId=xxx - Create issue
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ success: false, error: 'GitHub not configured for this project' }, { status: 400 })
    }

    const body = await request.json()
    const { title, body: issueBody, labels, assignees } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 })
    }

    const { createIssue, addIssueComment } = await import('@/lib/github')
    const issue = await createIssue(config, { title, body: issueBody, labels, assignees })

    // Log the integration
    await db.integrationLog.create({
      data: {
        teamId: project.teamId,
        type: 'github',
        action: 'issue_created',
        externalId: String(issue.number),
        data: JSON.stringify({ title: issue.title, url: issue.html_url }),
        status: 'success',
      },
    })

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Try to log the error
    try {
      const { searchParams } = new URL(request.url)
      const projectId = searchParams.get('projectId')
      if (projectId) {
        const project = await db.project.findUnique({ where: { id: projectId } })
        if (project) {
          await db.integrationLog.create({
            data: { teamId: project.teamId, type: 'github', action: 'issue_created', status: 'error', data: message },
          })
        }
      }
    } catch { /* ignore log error */ }

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
