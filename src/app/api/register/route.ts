import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

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

    // Use db from lib which works
    const { db } = await import('@/lib/db')

    // Check if user already exists via raw SQL
    const existing = await db.$queryRaw`
      SELECT id FROM "User" WHERE email = ${email} LIMIT 1
    ` as any[]

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Este email ya está registrado' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user via raw SQL
    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const now = new Date().toISOString()

    await db.$executeRaw`
      INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt")
      VALUES (${id}, ${email}, ${hashedPassword}, ${name}, ${now}, ${now})
    `

    return NextResponse.json({
      success: true,
      data: {
        id,
        email,
        name,
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
