import { db } from '@/lib/db'
import { emitToMember } from '@/lib/sse'

type CreateNotificationInput = {
  memberId: string
  teamId: string
  type: string
  title: string
  body?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await db.notification.create({
    data: {
      memberId: input.memberId,
      teamId: input.teamId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  emitToMember(input.memberId, 'notification', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    createdAt: notification.createdAt.toISOString(),
  })

  return notification
}
