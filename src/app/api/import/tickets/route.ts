import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { markImportedManualTicket } from '@/lib/ticket-cache'

type ImportTicket = {
  key: string
  title: string
  description?: string
  priority?: string
  estimate?: string
}

function parseCsv(input: string): ImportTicket[] {
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) return []
  return lines.slice(1).map((line, idx) => {
    const cols = line.split(',').map((c) => c.trim())
    return {
      key: cols[0] || `csv-${idx + 1}`,
      title: cols[1] || `Imported ticket ${idx + 1}`,
      description: cols[2] || '',
      priority: cols[3] || 'medium',
      estimate: cols[4] || undefined,
    }
  })
}

function parseXml(input: string): ImportTicket[] {
  const ticketRe = /<ticket>([\s\S]*?)<\/ticket>/gi
  const out: ImportTicket[] = []
  let match: RegExpExecArray | null
  while ((match = ticketRe.exec(input)) !== null) {
    const block = match[1]
    const read = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'))
      return m?.[1]?.trim() || ''
    }
    out.push({
      key: read('key') || `xml-${out.length + 1}`,
      title: read('title') || `Imported ticket ${out.length + 1}`,
      description: read('description'),
      priority: read('priority') || 'medium',
      estimate: read('estimate') || undefined,
    })
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId?: string
      format?: 'json' | 'csv' | 'xml'
      content?: string
      tickets?: ImportTicket[]
    }
    if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId is required' }, { status: 400 })

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, teamId: true },
    })
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })

    let tickets: ImportTicket[] = []
    if (Array.isArray(body.tickets)) tickets = body.tickets
    else if ((body.format || 'json') === 'json' && body.content) tickets = JSON.parse(body.content)
    else if (body.format === 'csv' && body.content) tickets = parseCsv(body.content)
    else if (body.format === 'xml' && body.content) tickets = parseXml(body.content)

    const imported: string[] = []
    for (const t of tickets) {
      const row = await markImportedManualTicket(project.id, project.teamId, t)
      if (row) imported.push(row.id)
    }

    return NextResponse.json({ success: true, data: { importedCount: imported.length } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
