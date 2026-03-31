import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    // Clean existing data (order matters for FK constraints)
    await db.standupCheckin.deleteMany()
    await db.message.deleteMany()
    await db.knowledgeEntry.deleteMany()
    await db.dailyReport.deleteMany()
    await db.integrationLog.deleteMany()
    await db.project.deleteMany()
    await db.teamMember.deleteMany()
    await db.team.deleteMany()

    // Create users via raw SQL to avoid stale Prisma client cache
    const hashedPassword = await bcrypt.hash('demo1234', 12)
    const now = new Date().toISOString()
    const users = [
      { id: 'usr_ana_001', email: 'ana@dayless.ai', name: 'Ana López' },
      { id: 'usr_carlos_002', email: 'carlos@dayless.ai', name: 'Carlos Rodríguez' },
      { id: 'usr_luis_003', email: 'luis@dayless.ai', name: 'Luis Hernández' },
    ]

    for (const u of users) {
      await db.$executeRaw`
        INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt")
        VALUES (${u.id}, ${u.email}, ${hashedPassword}, ${u.name}, ${now}, ${now})
      `
    }

    // Create teams
    const frontendTeam = await db.team.create({
      data: { name: 'Frontend Team', description: 'UI/UX development and component library', color: '#10b981' },
    })
    const backendTeam = await db.team.create({
      data: { name: 'Backend Team', description: 'API development, database, and infrastructure', color: '#8b5cf6' },
    })
    const devopsTeam = await db.team.create({
      data: { name: 'DevOps Team', description: 'CI/CD, monitoring, and cloud infrastructure', color: '#f59e0b' },
    })

    // Create members (some linked to users via raw SQL for userId)
    const memberData = [
      { teamId: frontendTeam.id, userId: users[0].id, name: 'Ana López', role: 'Tech Lead', email: 'ana@dayless.ai', status: 'active' },
      { teamId: frontendTeam.id, userId: users[1].id, name: 'Carlos Rodríguez', role: 'Senior Dev', email: 'carlos@dayless.ai', status: 'active' },
      { teamId: frontendTeam.id, name: 'María García', role: 'Mid Dev', email: 'maria@team.com', status: 'active' },
      { teamId: frontendTeam.id, name: 'Javier Kim', role: 'Junior Dev', email: 'javier@team.com', status: 'away' },
      { teamId: frontendTeam.id, name: 'Tina Santos', role: 'Designer', email: 'tina@team.com', status: 'active' },
      { teamId: backendTeam.id, userId: users[2].id, name: 'Luis Hernández', role: 'Tech Lead', email: 'luis@dayless.ai', status: 'active' },
      { teamId: backendTeam.id, name: 'Pablo Navarro', role: 'Senior Dev', email: 'pablo@team.com', status: 'away' },
      { teamId: backendTeam.id, name: 'Sara Gómez', role: 'Mid Dev', email: 'sara@team.com', status: 'active' },
      { teamId: backendTeam.id, name: 'Diego Ruiz', role: 'DevOps', email: 'diego@team.com', status: 'active' },
      { teamId: devopsTeam.id, name: 'Raúl Martínez', role: 'SRE Lead', email: 'raul@team.com', status: 'active' },
      { teamId: devopsTeam.id, name: 'Karen Wu', role: 'Cloud Engineer', email: 'karen@team.com', status: 'active' },
      { teamId: devopsTeam.id, name: 'Víctor Torres', role: 'Platform Dev', email: 'victor@team.com', status: 'offline' },
    ]

    // Create members - first without userId, then update with raw SQL
    const members: any[] = []
    for (const m of memberData) {
      const member = await db.teamMember.create({
        data: { teamId: m.teamId, name: m.name, role: m.role, email: m.email, status: m.status },
      })
      members.push(member)
    }

    // Link users to members via raw SQL
    await db.$executeRaw`UPDATE "TeamMember" SET "userId" = ${users[0].id} WHERE email = ${users[0].email}`
    await db.$executeRaw`UPDATE "TeamMember" SET "userId" = ${users[1].id} WHERE email = ${users[1].email}`
    await db.$executeRaw`UPDATE "TeamMember" SET "userId" = ${users[2].id} WHERE email = ${users[2].email}`

    // Create projects
    await Promise.all([
      db.project.create({ data: { teamId: frontendTeam.id, name: 'Payment Module Refactor', description: 'Refactor payment processing with Stripe integration', status: 'active', jiraProjectKey: 'PAY', githubRepo: 'org/payment-module' } }),
      db.project.create({ data: { teamId: backendTeam.id, name: 'Auth Service v2', description: 'New authentication service with OAuth2 and MFA', status: 'active', jiraProjectKey: 'AUTH', githubRepo: 'org/auth-service' } }),
      db.project.create({ data: { teamId: devopsTeam.id, name: 'CI/CD Pipeline', description: 'Automated deployment pipeline with staging and production', status: 'active', jiraProjectKey: 'DEVOPS' } }),
      db.project.create({ data: { teamId: frontendTeam.id, name: 'Mobile App MVP', description: 'React Native mobile application for iOS and Android', status: 'paused', jiraProjectKey: 'MOB' } }),
      db.project.create({ data: { teamId: backendTeam.id, name: 'Analytics Dashboard', description: 'Real-time analytics and reporting dashboard', status: 'completed', jiraProjectKey: 'ANALYTICS' } }),
    ])

    // Create knowledge entries
    await Promise.all([
      db.knowledgeEntry.create({ data: { teamId: frontendTeam.id, key: 'Stripe Webhook Endpoint', value: 'The Stripe webhook verification is done at `/api/webhooks/stripe`. Uses stripe-webhook-header for signature validation.', category: 'technical', source: 'Ana López', confidence: 95, isVerified: true } }),
      db.knowledgeEntry.create({ data: { teamId: backendTeam.id, key: 'API Rate Limit', value: 'The API rate limit is 100 requests per minute per user. Exceeding returns HTTP 429.', category: 'technical', source: 'System (Jira)', confidence: 100, isVerified: true } }),
      db.knowledgeEntry.create({ data: { teamId: frontendTeam.id, key: 'Sprint Duration', value: 'Sprints are 2 weeks long. Starts on Monday, ends on Friday with a demo/review session.', category: 'process', source: 'Dayless.ai', confidence: 90, isVerified: true } }),
      db.knowledgeEntry.create({ data: { teamId: backendTeam.id, key: 'Auth Module Blocker', value: 'The OAuth2 integration is blocked because Google Cloud Console approval is pending. Expected resolution: 2-3 days.', category: 'blocker', source: 'Carlos Rodríguez', confidence: 80, isVerified: false } }),
      db.knowledgeEntry.create({ data: { teamId: backendTeam.id, key: 'Database Migration Strategy', value: 'Decided to use Prisma Migrate for all schema changes. No raw SQL migrations allowed. Review in PR required.', category: 'decision', source: 'Team Decision', confidence: 100, isVerified: true } }),
      db.knowledgeEntry.create({ data: { teamId: frontendTeam.id, key: 'Code Review Policy', value: 'All PRs require at least 2 approvals before merging. One must be from a Tech Lead.', category: 'process', source: 'Dayless.ai', confidence: 95, isVerified: true } }),
      db.knowledgeEntry.create({ data: { teamId: devopsTeam.id, key: 'Deployment Schedule', value: 'Deployments to production happen on Tuesdays and Thursdays at 10:00 AM CET. Emergency deploys require CTO approval.', category: 'general', source: 'DevOps Team', confidence: 90, isVerified: true } }),
      db.knowledgeEntry.create({ data: { teamId: frontendTeam.id, key: 'Frontend Testing', value: 'Use Vitest for unit tests and Playwright for E2E. Minimum 80% coverage for new code.', category: 'technical', source: 'Frontend Team Lead', confidence: 85, isVerified: true } }),
    ])

    // Create chat messages
    const today = new Date()
    await Promise.all([
      db.message.create({ data: { teamId: frontendTeam.id, senderName: 'Dayless.ai', senderType: 'ai', content: '¡Buenos días equipo! 👋 Soy vuestro Scrum Master virtual. ¿Cómo va el sprint? ¿Hay algún blocker que necesite atención?', createdAt: new Date(today.getTime() - 3600000) } }),
      db.message.create({ data: { teamId: frontendTeam.id, senderId: members[1].id, senderName: 'Carlos Rodríguez', senderType: 'member', content: 'Buenos días. Estoy trabajando en el refactor del módulo de pagos. Tengo un problema con la integración de Stripe.', createdAt: new Date(today.getTime() - 3500000) } }),
      db.message.create({ data: { teamId: frontendTeam.id, senderName: 'Dayless.ai', senderType: 'ai', content: 'Entendido, Carlos. He registrado el problema con la integración de Stripe.\n\n1. ¿Es un problema de autenticación con la API de Stripe?\n2. ¿Es un problema con los webhooks?\n3. ¿Es un problema con el flujo de pago?\n\nVoy a preguntar a Ana si tiene experiencia con esta integración.', createdAt: new Date(today.getTime() - 3400000) } }),
      db.message.create({ data: { teamId: frontendTeam.id, senderId: members[0].id, senderName: 'Ana López', senderType: 'member', content: 'Yo trabajé con Stripe el sprint pasado. Carlos, el problema probablemente sea el webhook signature verification. Usamos el endpoint /api/webhooks/stripe.', createdAt: new Date(today.getTime() - 3000000) } }),
      db.message.create({ data: { teamId: frontendTeam.id, senderName: 'Dayless.ai', senderType: 'ai', content: '**Perfecto, gracias Ana.** He guardado esta información en la base de conocimiento:\n\n📌 **Knowledge Entry**: Stripe webhook verification se hace en `/api/webhooks/stripe`. Ana tiene experiencia previa con la integración.\n\nCarlos, ¿puedes verificar si el problema está relacionado con la firma del webhook?', createdAt: new Date(today.getTime() - 2800000) } }),
    ])

    // Create standups
    const todayStr = today.toISOString().split('T')[0]
    await Promise.all([
      db.standupCheckin.create({ data: { memberId: members[0].id, date: todayStr, yesterdayWork: 'Completed PR review for payment module. Fixed 3 bugs in auth flow.', todayPlan: 'Start working on the new dashboard analytics component. Code review for Carlos.', blockers: '', mood: 'great' } }),
      db.standupCheckin.create({ data: { memberId: members[1].id, date: todayStr, yesterdayWork: 'Refactored Stripe webhook handler. Started unit tests.', todayPlan: 'Continue with Stripe integration tests. Ask Ana about webhook signature.', blockers: 'Stripe webhook signature verification failing in staging', mood: 'stressed' } }),
      db.standupCheckin.create({ data: { memberId: members[2].id, date: todayStr, yesterdayWork: 'Implemented new date picker component. Updated Storybook docs.', todayPlan: 'Work on the notification system UI. Pair programming with Javier.', blockers: '', mood: 'good' } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        teams: 3,
        members: 12,
        projects: 5,
        knowledge: 8,
        messages: 5,
        standups: 3,
        users: 3,
      },
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
