type EventPayload = Record<string, unknown> | string | number | boolean | null

type Subscriber = (event: string, data: EventPayload) => void

const memberSubscribers = new Map<string, Set<Subscriber>>()

export function subscribeMemberEvents(memberId: string, subscriber: Subscriber): () => void {
  const existing = memberSubscribers.get(memberId) ?? new Set<Subscriber>()
  existing.add(subscriber)
  memberSubscribers.set(memberId, existing)

  return () => {
    const subscribers = memberSubscribers.get(memberId)
    if (!subscribers) return
    subscribers.delete(subscriber)
    if (subscribers.size === 0) {
      memberSubscribers.delete(memberId)
    }
  }
}

export function emitToMember(memberId: string, event: string, data: EventPayload): void {
  const subscribers = memberSubscribers.get(memberId)
  if (!subscribers || subscribers.size === 0) return
  for (const subscriber of subscribers) {
    subscriber(event, data)
  }
}
