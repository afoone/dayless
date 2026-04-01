import { describe, expect, it, vi } from 'vitest'
import { emitToMember, subscribeMemberEvents } from '@/lib/sse'

describe('sse event bus', () => {
  it('delivers events to subscribed member', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeMemberEvents('member-1', handler)

    emitToMember('member-1', 'notification', { id: 'n1' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('notification', { id: 'n1' })

    unsubscribe()
  })

  it('stops delivery after unsubscribe', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeMemberEvents('member-2', handler)
    unsubscribe()

    emitToMember('member-2', 'notification', { id: 'n2' })

    expect(handler).not.toHaveBeenCalled()
  })
})
