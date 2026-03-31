import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

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
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data

    // Import PrismaClient directly to avoid module cache issues
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      await prisma.$disconnect()
      return NextResponse.json(
        { success: false, error: 'Este email ya está registrado' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    })

    await prisma.$disconnect()

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear la cuenta' },
      { status: 500 }
    )
  }
}
