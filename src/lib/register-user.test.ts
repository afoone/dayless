import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  hashMock,
  findUserMock,
  findOrgMock,
  txUserCreateMock,
  txOrgCreateMock,
  txOrgMemberCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  hashMock: vi.fn(),
  findUserMock: vi.fn(),
  findOrgMock: vi.fn(),
  txUserCreateMock: vi.fn(),
  txOrgCreateMock: vi.fn(),
  txOrgMemberCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: hashMock,
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: findUserMock,
    },
    organization: {
      findUnique: findOrgMock,
    },
    $transaction: transactionMock,
  },
}))

import { registerUserWithOrganization } from '@/lib/register-user'

describe('registerUserWithOrganization', () => {
  beforeEach(() => {
    hashMock.mockReset()
    findUserMock.mockReset()
    findOrgMock.mockReset()
    txUserCreateMock.mockReset()
    txOrgCreateMock.mockReset()
    txOrgMemberCreateMock.mockReset()
    transactionMock.mockReset()
  })

  it('creates user, organization and owner membership', async () => {
    findUserMock.mockResolvedValue(null)
    findOrgMock.mockResolvedValue(null)
    hashMock.mockResolvedValue('hashed-pass')
    txUserCreateMock.mockResolvedValue({ id: 'user-1', email: 'ana@team.com', name: 'Ana' })
    txOrgCreateMock.mockResolvedValue({ id: 'org-1', name: "Ana's Organization", slug: 'ana' })
    txOrgMemberCreateMock.mockResolvedValue({ id: 'om-1', role: 'owner' })
    transactionMock.mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        user: { create: txUserCreateMock },
        organization: { create: txOrgCreateMock },
        orgMember: { create: txOrgMemberCreateMock },
      })
    )

    const result = await registerUserWithOrganization({
      email: 'ANA@team.com',
      password: 'secret123',
      name: 'Ana',
    })

    expect(hashMock).toHaveBeenCalledWith('secret123', 12)
    expect(findUserMock).toHaveBeenCalledWith({
      where: { email: 'ana@team.com' },
      select: { id: true },
    })
    expect(result.user.id).toBe('user-1')
    expect(result.organization.id).toBe('org-1')
    expect(result.orgMember.id).toBe('om-1')
  })

  it('throws when email already exists', async () => {
    findUserMock.mockResolvedValue({ id: 'existing' })

    await expect(
      registerUserWithOrganization({
        email: 'ana@team.com',
        password: 'secret123',
        name: 'Ana',
      })
    ).rejects.toThrow('EMAIL_EXISTS')
  })
})
