import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveAuthContext, requireOrgRole } from '@/lib/auth-context'

function toApiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await resolveAuthContext(request)
    requireOrgRole(ctx, 'admin')

    const invitation = await db.invitation.findUnique({
      where: { id },
      select: { id: true, organizationId: true, status: true },
    })

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 })
    }
    if (invitation.organizationId !== ctx.organization.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Only pending invitations can be revoked' },
        { status: 409 }
      )
    }

    const updated = await db.invitation.update({
      where: { id },
      data: { status: 'revoked' },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return toApiError(error)
  }
}
