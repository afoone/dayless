import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveAuthContext } from '@/lib/auth-context'
import { subscribeMemberEvents } from '@/lib/sse'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function encodeEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveAuthContext(request)
    const memberId = request.nextUrl.searchParams.get('memberId')
    if (!memberId) {
      return new Response(JSON.stringify({ success: false, error: 'memberId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const member = await db.teamMember.findUnique({
      where: { id: memberId },
      select: { userId: true },
    })
    if (!member || member.userId !== ctx.user.id) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encodeEvent(event, data))
        }
        const unsubscribe = subscribeMemberEvents(memberId, send)

        send('ready', { memberId, ts: Date.now() })
        const heartbeat = setInterval(() => {
          send('ping', { ts: Date.now() })
        }, 25000)

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          unsubscribe()
          controller.close()
        })
      },
      cancel() {
        // no-op
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
