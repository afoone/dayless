import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { registerUserWithOrganization } from '@/lib/register-user'

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid payload' },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data
    const { user, organization, orgMember } = await registerUserWithOrganization({
      email,
      password,
      name,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          maxUsers: organization.maxUsers,
        },
        orgMember: {
          id: orgMember.id,
          role: orgMember.role,
        },
        onboardingRequired: true,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      return NextResponse.json(
        { success: false, error: 'Este email ya está registrado' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}
