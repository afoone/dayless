# CLAUDE.md - Dayless.ai Development Guide

## QUE ES DAYLESS

Dayless es un **Scrum Master IA** que elimina reuniones. No es una app de gestion de proyectos. No compite con Jira, Linear ni ningun tracker de tickets.

**El tracker externo (Jira, Linear, GitHub Issues) es la fuente de verdad** de los tickets. Si no hay tracker, Dayless funciona igual con tickets importados manualmente o creados via propuestas. Dayless es la interfaz donde el equipo habla con su Scrum Master IA, que coordina sin que nadie tenga que ir a una daily, un refinement o un planning.

### Principio fundamental

> La app es solo la interfaz del chat y los resumenes. El valor es que la IA coordina sin que nadie tenga que ir a una reunion.

### Que hace un Scrum Master humano vs Dayless

| Reunion         | SM humano                                | Dayless                                                      |
|-----------------|------------------------------------------|--------------------------------------------------------------|
| Daily standup   | Pregunta a cada uno que hizo/hara        | Ya lo sabe del chat. Genera resumen cruzando a todos         |
| Refinement      | Coge ticket vago, pregunta, refina       | Trae tickets del tracker, pregunta al dev, refina por chat   |
| Sprint planning | Decide que entra segun capacidad         | Sugiere basandose en velocidad y estimaciones                |
| Blocker track   | Detecta blockers y los escala            | Cruza chats: "Carlos esta bloqueado esperando lo de Ana"     |
| Status check    | Pregunta "como va el ticket X?"          | Lee tracker + lo que dijo el miembro en su chat              |

### Flujo core

```
1. Cada miembro habla con la IA en privado (chat 1:1 por proyecto)
2. La IA escucha a todos, cruza informacion, detecta blockers
3. La IA refina tickets con cada dev (AC, estimacion, dudas)
4. Cualquiera puede proponer un ticket nuevo desde el chat
5. Solo leads/PM aprueban propuestas (se crean en tracker si hay integracion)
6. La IA genera standups automaticos con lo que ya sabe
7. Nadie va a ninguna reunion
```

## ENVIRONMENT

- Framework: Next.js 16 with App Router
- Language: TypeScript 5 (strict)
- Runtime: bun (not npm, not yarn)
- Database: Prisma ORM + SQLite (file at prisma/dev.db)
- Styling: Tailwind CSS 4 + shadcn/ui (New York style)
- State: Zustand (client)
- Auth: NextAuth.js v4 (Credentials provider)
- Animations: Framer Motion
- Icons: Lucide React
- AI: z-ai-web-dev-sdk (backend ONLY)
- Testing: vitest + @testing-library/react
- Design doc: See `DESIGN.md` for full functional and technical spec

## Critical Rules

- Port: ONLY 3000. Never use other ports.
- Single route: ALL UI is in `src/app/page.tsx` - client component that switches views.
- API routes: Use `/api/` routes, NOT server actions.
- Dev server: Runs via `bun run dev`.
- Database changes: Run `bun run db:push`.
- AI SDK: `z-ai-web-dev-sdk` MUST be used in backend ONLY. Never import in client components.
- Tests: Run via `bun run test`. Write tests for API routes and core logic.

## ARCHITECTURE DECISIONS

### Multi-tenant: Organization > Team > User

- **Organization** = tenant, entidad de facturacion. Se paga por usuario.
- **User** = quien se loguea. Pertenece a una org via OrgMember.
- **Team** = grupo de trabajo dentro de la org. Un user puede estar en multiples equipos.
- Todo dato se filtra por `organizationId` (tenant isolation).

### Roles (simples, sin RBAC)

**Nivel org:** owner (billing + todo), admin (gestionar equipos/miembros), member (usar la app)
**Nivel equipo:** lead (aprobar propuestas, abrir estimaciones/retros), member (chat, proponer, votar)

`jobTitle` (ej: "Senior Backend Developer") es texto libre para contexto de la IA, no un permiso.

Permisos se derivan del rol, no hay tabla de permisos:
```typescript
const canApproveProposals = (m: TeamMember) => m.teamRole === 'lead'
const canManageTeam = (o: OrgMember) => o.role === 'owner' || o.role === 'admin'
```

### El tracker externo es la fuente de verdad

- Los tickets viven en el tracker (Jira, Linear, GitHub Issues). Si no hay tracker, TicketCache local es la fuente minima.
- Dayless cachea datos del tracker en `TicketCache` para dar contexto a la IA.
- Cuando la IA refina un ticket (AC, estimacion), actualiza el tracker via adapter (si soporta write). Si no, actualiza TicketCache local.
- **Dayless funciona sin integracion**: tickets se pueden importar via CSV/XML/JSON o pegar en el chat.

### Adapter Layer (src/lib/ticket-source.ts)

Toda interaccion con trackers pasa por una capa de abstraccion:
- **Jira adapter**: full sync bidireccional (read + write + sprints + estimates)
- **Linear adapter**: full sync bidireccional
- **GitHub Issues adapter**: read + limited write (no sprints nativos, estimates via labels)
- **Manual adapter**: CRUD local sobre TicketCache (sin tracker externo)

### Chat 1:1 con la IA (no global)

- Cada miembro tiene su hilo privado con la IA, por proyecto.
- La gente es mas honesta en privado con la IA.
- La IA cruza informacion entre miembros SIN exponer quien dijo que.

### Propuestas de ticket (no creacion directa)

- Cualquier miembro puede proponer un ticket desde el chat.
- La propuesta queda en cola de revision.
- Solo miembros con `teamRole = 'lead'` pueden aprobar.
- Al aprobar, se crea en el tracker (si hay integracion) o en TicketCache local.
- Al rechazar, la IA notifica al autor con el motivo.

### Conocimiento = decisiones del equipo

- KnowledgeEntry guarda decisiones, acuerdos, y contexto importante.
- La IA propone guardar cuando detecta una decision. El miembro confirma.
- La IA consulta el knowledge base antes de responder.

## DATA MODEL (ver DESIGN.md para detalle completo)

### Auth y Organizacion

- **User** - Auth identity (email, password, name)
- **Organization** - Tenant, entidad de facturacion (name, slug, plan, maxUsers)
- **OrgMember** - Enlace User <> Org con rol (owner, admin, member)

### Equipos y Proyectos

- **Team** - Equipo dentro de una org (storyPointGuide, sprintLengthDays)
- **TeamMember** - Enlace User <> Team con teamRole (lead, member) y jobTitle
- **Project** - Con config de trackers (Jira, Linear, GitHub) o sin integracion
- **ProjectAssignment** - Asignacion miembro-proyecto

### Core

- **Message** - Chat 1:1 con IA (por ownerMemberId + projectId)
- **KnowledgeEntry** - Decisiones y conocimiento del equipo
- **DailyReport** - Standups generados por la IA
- **StandupCheckin** - Input de cada miembro (manual o extraido por IA)
- **IntegrationLog** - Audit de acciones en trackers

### Modelos NUEVOS

- **TicketCache** - Cache local de tickets (de cualquier fuente: Jira, Linear, GitHub, import, manual)
- **TicketProposal** - Propuestas de ticket antes de ir al tracker
- **EstimationSession** - Sesiones de Planning Poker asincrono
- **EstimationVote** - Votos individuales por sesion y ronda
- **Retrospective** - Retros asincronas con feedback anonimo
- **RetroFeedback** - Feedback individual anonimo

### Modelos a ELIMINAR

- **Ticket** - Los tickets estan en el tracker o en TicketCache
- **TicketWorkflow** - Los workflows son del tracker
- **TicketTransition** - El historial esta en el tracker
- **TicketMessage** - Los comentarios van al tracker directamente

## VIEWS (simplificadas)

| View | Proposito | Prioridad |
|------|-----------|-----------|
| **chat** | Core. Chat 1:1 con la IA. Refinamiento, propuestas, standups. | P0 |
| **proposals** | Cola de propuestas de tickets pendientes de aprobacion (solo leads) | P0 |
| **standup** | Resumen diario generado por la IA, cruzando todos los chats | P0 |
| **board** | Vista de lectura de tickets del sprint actual (desde TicketCache) | P1 |
| **knowledge** | Decisiones y acuerdos del equipo | P1 |
| **teams** | Gestion de equipos y miembros | P2 |
| **projects** | Configuracion de proyectos, conexion con trackers, importacion | P2 |
| **settings** | Ajustes del equipo (story point guide, etc.) | P2 |
| **profile** | Perfil del usuario | P3 |

Views eliminadas: `dashboard` (no aporta), `kanban` (esta en el tracker), `tickets` (estan en el tracker), `reports` (lo reemplaza standup automatico).

## AI CHAT BEHAVIOR

### Rol de la IA

La IA es un Scrum Master experimentado. No es un chatbot generico. Su trabajo es:

1. **Escuchar** - Entender que hace cada miembro, sus blockers, su estado
2. **Recordar** - Consultar knowledge base y conversaciones previas
3. **Refinar** - Tomar tickets vagos y convertirlos en tickets accionables con AC y estimacion
4. **Proponer** - Detectar cuando se necesita un ticket nuevo y proponer su creacion
5. **Coordinar** - Cruzar informacion entre miembros. "Ana necesita tu endpoint" sin revelar contexto innecesario
6. **Resumir** - Generar standups automaticos con lo que ya sabe

### Contexto que recibe la IA en cada mensaje

1. Info del equipo + miembros
2. Knowledge base del equipo
3. Tickets del sprint actual (desde TicketCache)
4. Historial de chat del miembro actual (ultimos 20 mensajes)
5. **Resumenes relevantes de otros miembros** (blockers, dependencias, sin revelar conversacion completa)
6. Propuestas de tickets pendientes del miembro
7. Estimaciones pendientes de voto
8. Story point guide del equipo

### Acciones que puede tomar la IA

- Proponer `TicketProposal` (el usuario confirma -> va a cola de aprobacion)
- Actualizar ticket (descripcion, AC, estimacion) tras confirmacion del dev (via adapter)
- Guardar `KnowledgeEntry` (tras confirmacion)
- Generar resumen de standup (desde conversaciones del dia)
- Alertar sobre blockers cruzados

### Quick actions en el chat

- `/standup` - Abrir dialogo de standup
- `/refinar PAY-123` - La IA trae el ticket y empieza refinamiento
- `/proponer` - La IA ayuda a redactar una propuesta de ticket
- `/estimar PAY-123` - (Solo leads) Abre sesion de estimacion
- `/mis-tickets` - Tickets asignados al miembro
- `/blockers` - Blockers actuales del equipo (cruzando chats)
- `/decisiones` - Decisiones recientes del knowledge base
- `/retro` - (Solo leads) Inicia retrospectiva del sprint

## CODE PATTERNS

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')
    const items = await db.entity.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
```

### API Client Pattern

```typescript
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await fetch(`/api/${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  })
  const json = await response.json()
  if (!response.ok) return { success: false, data: null, error: json.error || 'Request failed' }
  if (typeof json.success === 'boolean') return json as ApiResponse<T>
  return { success: true, data: json as T, error: null }
}
```

### View Component Pattern

```typescript
'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function SomeView() {
  // ...
}
```

## TESTING

- Framework: vitest
- Run: `bun run test`
- Test API routes with mocked Prisma client
- Test adapter layer with mocked external APIs
- Test UI components with @testing-library/react
- Test IA prompt construction (verify context blocks are built correctly)
- Test estimation consensus algorithm
- Test TicketProposal approval flow (permissions, state transitions)

## UI/UX DESIGN

- shadcn/ui components always. Never build custom when shadcn has it.
- Icons: Lucide React
- Accent: emerald (#10b981)
- Animations: Framer Motion
- Toast: sonner
- Mobile-first responsive
- Dark/light mode via next-themes

## COMMON MISTAKES TO AVOID

- DO NOT create new routes in `app/` - everything in `page.tsx`
- DO NOT import `z-ai-web-dev-sdk` in client components
- DO NOT build a ticket management system - the tracker handles that
- DO NOT build a kanban board - the tracker handles that
- DO NOT add features that compete with the tracker - complement it
- DO NOT expose private chat content between members without explicit context
- DO NOT create tickets directly - everything goes through TicketProposal -> approval
- DO NOT skip the approval flow for ticket creation
- DO NOT hardcode Jira-specific logic outside the adapter layer
- DO NOT assume a tracker is connected - always handle the "no integration" case

## TRACKER SYNC STRATEGY

### Read (frequent)
- On project load: fetch current sprint tickets via adapter -> update TicketCache
- On `/refinar PROJ-123`: fetch single ticket details via adapter
- On standup generation: fetch ticket statuses for the team
- Manual: import CSV/XML/JSON or paste tickets in chat

### Write (after user confirmation, if adapter supports write)
- Refinement: update description, AC, estimate on tracker ticket
- Approved proposal: create new issue in tracker
- Comment: add comment to tracker ticket from chat context
- If no write support: show formatted data for user to copy-paste

### Cache invalidation
- TicketCache entries expire after `lastSyncedAt` + 15 minutes
- Force refresh via API call or `/refinar` command
- Background sync on app load per project
- Manually imported tickets (syncEnabled=false) never expire

## GIT CONVENTIONS

- Commit messages in English, imperative mood
- Feature branches: `feature/description`
- One logical change per commit
