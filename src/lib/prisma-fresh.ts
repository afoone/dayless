export async function withPrisma<T>(fn: (prisma: any) => Promise<T>): Promise<T> {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    return await fn(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
