import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function registerUserWithOrganization(params: {
  email: string
  password: string
  name: string
}) {
  const email = params.email.toLowerCase().trim()

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) {
    throw new Error('EMAIL_EXISTS')
  }

  const hashedPassword = await bcrypt.hash(params.password, 12)
  const baseSlug = slugify(params.name || email.split('@')[0]) || 'org'
  let slug = baseSlug
  let count = 0
  while (await db.organization.findUnique({ where: { slug }, select: { id: true } })) {
    count += 1
    slug = `${baseSlug}-${count}`
  }

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: params.name,
      },
    })

    const organization = await tx.organization.create({
      data: {
        name: `${params.name}'s Organization`,
        slug,
        plan: 'free',
        maxUsers: 5,
      },
    })

    const orgMember = await tx.orgMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'owner',
      },
    })

    return { user, organization, orgMember }
  })

  return result
}
