#!/usr/bin/env bun
// Quick fix script: ensures DB exists, schema is synced, and demo users are created
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function setup() {
  console.log('🔧 Setting up Dayless.ai database...')

  try {
    // Check if users exist
    const users = await prisma.$queryRaw`SELECT id, email FROM "User"` as any[]

    if (users.length === 0) {
      console.log('📝 Creating demo users...')
      const hash = await bcrypt.hash('demo1234', 12)
      const now = new Date().toISOString()

      await prisma.$executeRaw`INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt") VALUES ('usr_ana_001', 'ana@dayless.ai', ${hash}, 'Ana López', ${now}, ${now})`
      await prisma.$executeRaw`INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt") VALUES ('usr_carlos_002', 'carlos@dayless.ai', ${hash}, 'Carlos Rodríguez', ${now}, ${now})`
      await prisma.$executeRaw`INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt") VALUES ('usr_luis_003', 'luis@dayless.ai', ${hash}, 'Luis Hernández', ${now}, ${now})`

      console.log('✅ 3 demo users created:')
      console.log('   - ana@dayless.ai / demo1234')
      console.log('   - carlos@dayless.ai / demo1234')
      console.log('   - luis@dayless.ai / demo1234')
    } else {
      console.log(`✅ ${users.length} users already exist:`)
      users.forEach((u: any) => console.log(`   - ${u.email}`))
    }
  } catch (error) {
    console.error('❌ Error:', error)
    console.log('\nRun: bun run db:push first')
  } finally {
    await prisma.$disconnect()
  }
}

setup()
