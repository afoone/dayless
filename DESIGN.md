# Dayless.ai - Documento de Diseno Funcional y Tecnico

> Version: 1.0 | Fecha: 2026-04-01
> Estado: Diseno inicial

---

## Indice

1. [Vision y Principios](#1-vision-y-principios)
2. [Arquitectura General](#2-arquitectura-general)
3. [Modelo de Datos Completo](#3-modelo-de-datos-completo)
4. [Estrategia de Integraciones](#4-estrategia-de-integraciones)
5. [Fase 1: Chat Core (Scrum Master IA 1:1)](#5-fase-1-chat-core)
6. [Fase 2: Sync con Tracker + Refinamiento Conversacional](#6-fase-2-sync-con-tracker--refinamiento)
7. [Fase 3: Propuestas de Ticket + Flujo de Aprobacion](#7-fase-3-propuestas-de-ticket--aprobacion)
8. [Fase 4: Estimacion Asincrona (Planning Poker)](#8-fase-4-estimacion-asincrona)
9. [Fase 5: Standup Automatico](#9-fase-5-standup-automatico)
10. [Fase 6: Deteccion Proactiva de Riesgos](#10-fase-6-deteccion-proactiva-de-riesgos)
11. [Fase 7: Retrospectiva Asincrona](#11-fase-7-retrospectiva-asincrona)
12. [Fase 8: Resumen para Stakeholders](#12-fase-8-resumen-para-stakeholders)
13. [Fase 9: Onboarding Contextual](#13-fase-9-onboarding-contextual)
14. [Fase 10: Dependency Mapping](#14-fase-10-dependency-mapping)
15. [Mapa de Vistas UI](#15-mapa-de-vistas-ui)
16. [Apendice A: Guia de Story Points por defecto](#apendice-a)
17. [Apendice B: Secuencia de migracion desde la app actual](#apendice-b)

---

## 1. Vision y Principios

### Que es Dayless

Dayless es un **Scrum Master IA** que elimina reuniones. No es una app de gestion de proyectos. No compite con Jira, Linear, Trello ni ninguna herramienta de tickets.

**El tracker externo (Jira, Linear, GitHub Issues, o incluso un CSV importado) es la fuente de verdad** de los tickets. Dayless es la interfaz donde cada miembro del equipo habla con su Scrum Master IA en privado, y la IA coordina a todo el equipo sin que nadie tenga que ir a una daily, un refinement, un planning ni una retro.

**Dayless funciona sin integracion directa.** Si el equipo no tiene Jira ni Linear, puede empezar importando tickets manualmente (CSV, XML, JSON, o pegandolos en el chat). La IA trabaja con lo que haya.

### El cambio de mentalidad

```
ANTES:  Dayless = app de gestion de proyectos con chatbot
AHORA:  Dayless = Scrum Master IA que coordina tu equipo y habla con cada miembro
```

El valor NO es la app. El valor es que la IA coordina sin que nadie tenga que ir a una reunion. La app es solo la interfaz del chat y los resumenes.

### Principios de diseno

| # | Principio | Implicacion |
|---|-----------|-------------|
| 1 | **El tracker externo es la fuente de verdad** | No duplicar tickets, estados ni workflows localmente. Si no hay tracker, el TicketCache local actua como fuente minima |
| 2 | **Chat 1:1 privado** | Cada miembro habla con la IA en privado. La gente es mas honesta asi |
| 3 | **La IA cruza, no expone** | La IA sintetiza info entre miembros sin revelar quien dijo que |
| 4 | **Proponer, no crear** | Cualquiera propone tickets; solo leads aprueban (y crean en el tracker si hay integracion) |
| 5 | **Asincrono siempre** | Refinamiento, estimacion, retro: todo asincrono via chat |
| 6 | **Confirmar antes de actuar** | La IA nunca ejecuta acciones sin confirmacion del usuario |
| 7 | **Menos UI, mas IA** | Cada vista nueva que se anade deberia cuestionarse. El chat resuelve casi todo |

### Que hace un Scrum Master humano vs Dayless

| Ceremonia | SM humano | Dayless |
|-----------|-----------|---------|
| Daily standup | Pregunta a cada uno que hizo/hara | Ya lo sabe del chat. Genera resumen cruzando a todos |
| Refinement | Coge ticket vago, pregunta, refina | Trae tickets del tracker (o importados), pregunta al dev, refina por chat iterativamente |
| Sprint planning | Decide que entra segun capacidad | Sugiere basandose en velocidad y estimaciones |
| Planning poker | Modera la votacion de story points | Facilita votacion asincrona con Fibonacci, detecta divergencias |
| Blocker tracking | Detecta blockers y los escala | Cruza chats: "Carlos esta bloqueado esperando lo de Ana" |
| Retrospectiva | Facilita que, bien, que mal, que cambiar | Recoge feedback privado, anonimiza, genera acuerdos |
| Status check | Pregunta "como va el ticket X?" | Lee tracker + lo que dijo el miembro en chat |
| Onboarding | Pone al dia a nuevos miembros | Genera contexto automatico del proyecto, decisiones, sprint actual |

---

## 2. Arquitectura General

### Stack tecnico

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5 (strict) |
| Runtime | Bun |
| Base de datos | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Estilos | Tailwind CSS 4 + shadcn/ui (New York) |
| Estado cliente | Zustand |
| Auth | NextAuth.js v4 (Credentials) |
| Animaciones | Framer Motion |
| Iconos | Lucide React |
| IA | z-ai-web-dev-sdk (backend ONLY) |
| Integraciones | Jira Cloud, Linear, GitHub Issues, importacion CSV/XML/JSON |

### Arquitectura de flujo

```
+-------------------+  +----------+  +----------------+  +-----------+
|    Jira Cloud      |  |  Linear  |  | GitHub Issues  |  | CSV/XML   |
|   (si conectado)   |  |          |  |                |  | (import)  |
+--------+----------+  +----+-----+  +-------+--------+  +-----+-----+
         |                   |                |                  |
         +------- ADAPTER LAYER (src/lib/ticket-source.ts) -----+
                             |
                    sync / read / write (segun soporte)
                             |
+----------+        +--------v----------+        +------------------+
| Frontend | <----> |   Next.js API      | <----> |   SQLite/PG      |
| (React)  |  REST  |   Routes           |        |   (cache + chat) |
+----------+        +--------+----------+        +------------------+
                             |
                     z-ai-web-dev-sdk
                             |
                    +--------v----------+
                    |     LLM            |
                    |  (Scrum Master IA) |
                    +-------------------+
```

### Modos de funcionamiento segun integracion

| Modo | Que tiene el equipo | Como funciona Dayless |
|------|--------------------|-----------------------|
| **Full sync** | Jira o Linear conectado | Sync bidireccional: lee tickets, escribe refinamientos, crea tickets aprobados |
| **Read-only sync** | GitHub Issues o tracker con API limitada | Lee tickets para dar contexto a la IA. Creacion/actualizacion manual por el usuario en el tracker |
| **Import manual** | Sin tracker o tracker sin API | El equipo importa tickets via CSV/XML/JSON o los pega directamente en el chat/UI. La IA trabaja con el TicketCache local |
| **Sin tickets** | Equipo sin nada aun | La IA funciona como coordinador puro: chat, standups, decisiones, retros. Los tickets se proponen y quedan en TicketProposal |

### Que vive en la base de datos local vs en el tracker externo

| Dato | Donde vive | Por que |
|------|-----------|---------|
| Tickets (fuente de verdad) | **Tracker externo** (si hay), o **TicketCache local** (si no hay tracker) | El tracker es el sistema de record. Si no existe, TicketCache es la fuente minima |
| Cache de tickets | **Local (TicketCache)** | Para dar contexto a la IA sin llamar al tracker cada vez |
| Mensajes de chat 1:1 | **Local** | Privados, no van al tracker |
| Propuestas de ticket | **Local (TicketProposal)** | Hasta que se aprueban (y se crean en tracker si hay integracion) |
| Sesiones de estimacion | **Local** | Votos internos, resultado final va al tracker si hay integracion |
| Knowledge base | **Local** | Decisiones del equipo, contexto para la IA |
| Standups generados | **Local** | Resumenes del equipo |
| Retrospectivas | **Local** | Feedback privado anonimizado |
| Usuarios, equipos, proyectos | **Local** | Configuracion de la app |

### Reglas de arquitectura

- Puerto: SOLO 3000
- Ruta unica: Todo el UI en `src/app/page.tsx` (client component que cambia vistas)
- API routes: Usar `/api/`, NO server actions
- AI SDK: `z-ai-web-dev-sdk` SOLO en backend. Nunca importar en cliente
- Base de datos: `bun run db:push` para cambios de schema

---

## 3. Modelo de Datos Completo

### Diagrama de relaciones

```
User 1──N TeamMember N──1 Team
                |              |
                |              +──N Project
                |              |      |
                |              |      +──N ProjectAssignment ──N TeamMember
                |              |      |
                |              |      +──N TicketCache
                |              |      |
                |              |      +──N TicketProposal
                |              |      |
                |              |      +──N EstimationSession
                |              |
                |              +──N KnowledgeEntry
                |              |
                |              +──N DailyReport
                |              |
                |              +──N Retrospective
                |              |
                |              +──N IntegrationLog
                |
                +──N Message (chat 1:1 con IA, por proyecto)
                |
                +──N StandupCheckin
                |
                +──N EstimationVote
                |
                +──N RetroFeedback
```

### Modelos que SE MANTIENEN

#### User
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  memberships TeamMember[]
  @@index([email])
}
```

#### Team
```prisma
model Team {
  id              String   @id @default(cuid())
  name            String
  description     String?
  color           String   @default("#10b981")
  storyPointGuide String?  // Markdown. La IA la usa al estimar.
  sprintLengthDays Int     @default(14)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  members        TeamMember[]
  projects       Project[]
  messages       Message[]
  knowledge      KnowledgeEntry[]
  reports        DailyReport[]
  integrationLogs IntegrationLog[]
  retrospectives Retrospective[]
}
```

#### TeamMember
```prisma
model TeamMember {
  id               String   @id @default(cuid())
  teamId           String
  userId           String?
  defaultProjectId String?
  name             String
  role             String   @default("Developer")
  email            String?
  avatar           String?
  status           String   @default("active") // active, away, offline
  canApproveTickets Boolean @default(false)     // NUEVO: solo estos crean en Jira
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  team             Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user             User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  defaultProject   Project? @relation("MemberDefaultProject", fields: [defaultProjectId], references: [id], onDelete: SetNull)
  standups         StandupCheckin[]
  projectAssignments ProjectAssignment[]
  privateChatMessages Message[]
  proposedTickets  TicketProposal[] @relation("ProposedBy")
  reviewedTickets  TicketProposal[] @relation("ReviewedBy")
  estimationVotes  EstimationVote[]
  retroFeedbacks   RetroFeedback[]
  requestedEstimations EstimationSession[] @relation("RequestedBy")

  @@index([teamId])
  @@index([userId])
}
```

#### Project
```prisma
model Project {
  id              String   @id @default(cuid())
  teamId          String
  name            String
  description     String?
  status          String   @default("active") // active, paused, completed

  // -- Integracion Jira --
  jiraProjectKey  String?
  jiraBaseUrl     String?
  jiraToken       String?
  jiraUserEmail   String?  // NUEVO: para Basic Auth de Jira Cloud

  // -- Integracion Linear (alternativa) --
  linearTeamId    String?
  linearApiKey    String?

  // -- Integracion GitHub (secundario) --
  githubRepo      String?
  githubToken     String?

  // -- Importacion manual --
  // Si no hay integracion, se importan tickets via CSV/XML/JSON
  // No requiere campos en el modelo

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  defaultForMembers TeamMember[] @relation("MemberDefaultProject")
  memberAssignments ProjectAssignment[]
  chatMessages    Message[]
  ticketCache     TicketCache[]
  proposals       TicketProposal[]
  estimationSessions EstimationSession[]

  @@index([teamId])
}
```

#### ProjectAssignment
```prisma
model ProjectAssignment {
  id        String   @id @default(cuid())
  projectId String
  memberId  String
  createdAt DateTime @default(now())

  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  member    TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([projectId, memberId])
  @@index([memberId])
}
```

#### Message (Chat 1:1)
```prisma
model Message {
  id              String   @id @default(cuid())
  teamId          String
  ownerMemberId   String   // Dueno del hilo (chat privado 1:1 con la IA)
  projectId       String   // Hilo distinto por proyecto
  senderId        String?  // null para IA
  senderName      String
  senderType      String   @default("member") // member, ai, system
  content         String
  metadata        String?  // JSON: acciones ejecutadas, contexto extra
  createdAt       DateTime @default(now())

  team    Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  owner   TeamMember @relation(fields: [ownerMemberId], references: [id], onDelete: Cascade)
  project Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)

  originProposal TicketProposal? @relation("OriginMessage")

  @@index([teamId, ownerMemberId, projectId])
  @@index([createdAt])
}
```

#### KnowledgeEntry
```prisma
model KnowledgeEntry {
  id         String   @id @default(cuid())
  teamId     String
  key        String        // Titulo corto de la decision/acuerdo
  value      String        // Descripcion completa
  source     String?       // Quien lo propuso
  category   String   @default("general") // general, technical, process, decision, agreement
  confidence Int      @default(80)        // 0-100
  isVerified Boolean  @default(false)     // Confirmado por el miembro
  expiresAt  DateTime?     // NUEVO: algunas decisiones caducan
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  team       Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId, category])
}
```

#### DailyReport
```prisma
model DailyReport {
  id        String   @id @default(cuid())
  teamId    String
  projectId String?  // NUEVO: reporte puede ser por proyecto
  date      String   // YYYY-MM-DD
  summary   String   // Markdown generado por la IA
  status    String   @default("draft") // draft, published
  createdAt DateTime @default(now())

  team      Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, date])
  @@index([teamId])
}
```

#### StandupCheckin
```prisma
model StandupCheckin {
  id            String   @id @default(cuid())
  memberId      String
  projectId     String?  // NUEVO: standup puede ser por proyecto
  date          String   // YYYY-MM-DD
  yesterdayWork String?
  todayPlan     String?
  blockers      String?
  mood          String   @default("neutral") // great, good, neutral, stressed, blocked
  source        String   @default("manual")  // NUEVO: manual | ai_extracted | chat_command
  createdAt     DateTime @default(now())

  member TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, date])
  @@index([memberId])
}
```

#### IntegrationLog
```prisma
model IntegrationLog {
  id         String   @id @default(cuid())
  teamId     String
  type       String   // jira, linear, github, import
  action     String   // ticket_created, ticket_updated, estimation_synced, proposal_approved, etc.
  externalId String?  // Jira key, Linear ID, etc.
  data       String?  // JSON con request/response
  status     String   @default("success") // success, error
  createdAt  DateTime @default(now())

  @@index([teamId, type])
  @@index([createdAt])
}
```

### Modelos NUEVOS

#### TicketCache
```prisma
model TicketCache {
  id           String   @id @default(cuid())
  projectId    String
  teamId       String

  // -- Identificador del ticket (agnostico) --
  externalKey  String   // PROJ-123 (Jira), PAY-45 (Linear), #123 (GitHub), IMP-001 (importado)
  source       String   @default("manual") // jira, linear, github, manual, csv_import, xml_import

  // -- Datos del ticket --
  title        String
  description  String?
  status       String   // To Do, In Progress, Done, etc. (normalizado)
  priority     String?  // highest, high, medium, low, lowest (normalizado)
  issueType    String?  // story, bug, task, epic (normalizado)
  assignee     String?  // Display name del asignado
  assigneeEmail String? // Email para cruzar con TeamMember
  reporter     String?
  estimate     String?  // Story points
  sprint       String?  // Nombre del sprint/ciclo/milestone (segun tracker)
  labels       String?  // JSON array de labels/tags
  parentKey    String?  // Key del epic/parent (si aplica)
  acceptanceCriteria String? // AC (campo custom o extraido de description)
  externalUrl  String?  // URL directa al ticket en el tracker (para abrir en nueva pestana)

  // -- Sync --
  lastSyncedAt DateTime  // Ultima vez que se sincronizo con el tracker. Para importaciones manuales = createdAt
  syncEnabled  Boolean  @default(true) // false para tickets importados manualmente (no se resincronizan)
  rawData      String?  // JSON completo del tracker para datos extra

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, externalKey])
  @@index([teamId])
  @@index([externalKey])
  @@index([source])
  @@index([assigneeEmail])
  @@index([lastSyncedAt])
}
```

#### TicketProposal
```prisma
model TicketProposal {
  id                  String   @id @default(cuid())
  teamId              String
  projectId           String
  title               String
  description         String
  acceptanceCriteria  String?
  priority            String   @default("medium") // highest, high, medium, low, lowest
  estimate            String?  // Story points sugeridos
  issueType           String   @default("story")  // story, bug, task
  proposedByMemberId  String
  status              String   @default("draft")   // draft, pending_review, approved, rejected
  reviewedByMemberId  String?
  reviewNote          String?  // Motivo de rechazo o comentario de aprobacion
  externalKey         String?  // Se rellena cuando se crea en el tracker tras aprobacion (PROJ-123, #45, etc.)
  origin              String   @default("chat")    // chat, refinement, standup, retro
  originMessageId     String?  @unique             // Mensaje del chat donde nacio
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  project       Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  proposedBy    TeamMember @relation("ProposedBy", fields: [proposedByMemberId], references: [id])
  reviewedBy    TeamMember? @relation("ReviewedBy", fields: [reviewedByMemberId], references: [id])
  originMessage Message?   @relation("OriginMessage", fields: [originMessageId], references: [id])

  @@index([teamId, status])
  @@index([projectId])
  @@index([proposedByMemberId])
}
```

#### EstimationSession
```prisma
model EstimationSession {
  id                  String   @id @default(cuid())
  teamId              String
  projectId           String
  jiraKey             String        // Ticket de Jira que se estima
  ticketTitle         String        // Titulo cacheado para mostrar sin consultar Jira
  ticketDescription   String?       // Descripcion/AC cacheados
  requestedByMemberId String        // Lead/PM que abrio la sesion
  status              String   @default("open") // open, voting, discussing, closed, cancelled
  currentRound        Int      @default(1)
  finalEstimate       String?       // Se rellena al cerrar (ej: "8")
  syncedToJira        Boolean  @default(false)  // Si ya se subio el estimate a Jira
  createdAt           DateTime @default(now())
  closedAt            DateTime?
  updatedAt           DateTime @updatedAt

  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  requestedBy TeamMember @relation("RequestedBy", fields: [requestedByMemberId], references: [id])
  votes       EstimationVote[]

  @@unique([projectId, jiraKey, status]) // Solo una sesion activa por ticket
  @@index([teamId, status])
}
```

#### EstimationVote
```prisma
model EstimationVote {
  id        String   @id @default(cuid())
  sessionId String
  memberId  String
  round     Int            // Ronda de votacion (1, 2, 3...)
  value     String         // "1", "2", "3", "5", "8", "13", "21", "?" (no se/abstener)
  reasoning String?        // Por que eligio ese numero (opcional)
  createdAt DateTime @default(now())

  session EstimationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  member  TeamMember        @relation(fields: [memberId], references: [id])

  @@unique([sessionId, memberId, round])
  @@index([sessionId])
}
```

#### Retrospective
```prisma
model Retrospective {
  id           String   @id @default(cuid())
  teamId       String
  projectId    String?
  sprintName   String?       // "Sprint 14", "Semana 12", etc.
  status       String   @default("collecting") // collecting, summarizing, closed
  summary      String?       // Markdown generado por la IA con los temas anonimizados
  agreements   String?       // JSON: acuerdos extraidos y aprobados
  createdAt    DateTime @default(now())
  closedAt     DateTime?
  updatedAt    DateTime @updatedAt

  team      Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  feedbacks RetroFeedback[]

  @@index([teamId, status])
}
```

#### RetroFeedback
```prisma
model RetroFeedback {
  id              String   @id @default(cuid())
  retrospectiveId String
  memberId        String
  wentWell        String?  // Que fue bien
  wentWrong       String?  // Que fue mal
  suggestions     String?  // Que cambiaria
  mood            String?  // great, good, neutral, stressed, blocked
  isAnonymous     Boolean  @default(true)
  createdAt       DateTime @default(now())

  retrospective Retrospective @relation(fields: [retrospectiveId], references: [id], onDelete: Cascade)
  member        TeamMember    @relation(fields: [memberId], references: [id])

  @@unique([retrospectiveId, memberId])
  @@index([retrospectiveId])
}
```

### Modelos a ELIMINAR (del schema actual)

| Modelo | Razon |
|--------|-------|
| `Ticket` | Los tickets viven en Jira. Se reemplaza por `TicketCache` (lectura) + `TicketProposal` (creacion) |
| `TicketWorkflow` | Los estados/workflows son de Jira |
| `TicketTransition` | El historial de transiciones esta en Jira |
| `TicketMessage` | Los comentarios de tickets van a Jira directamente |

---

## 4. Estrategia de Integraciones

### Principio: Dayless funciona con o sin tracker

Dayless NO requiere integracion con ningun sistema externo para funcionar. El equipo puede empezar desde cero: la IA coordina por chat, los tickets se proponen, se estiman, se refinan. Si mas adelante conectan Jira o Linear, se gana sync bidireccional. Si no, funciona igual.

### Adapter Layer: `src/lib/ticket-source.ts`

Toda la logica de integraciones pasa por una capa de abstraccion. La IA y las APIs nunca hablan directamente con Jira/Linear/GitHub. Hablan con el adapter, que resuelve segun la configuracion del proyecto.

```typescript
interface TicketSourceAdapter {
  // Capacidades del adapter (no todos soportan todo)
  capabilities: {
    read: boolean       // Puede leer tickets
    write: boolean      // Puede crear/actualizar tickets
    sync: boolean       // Soporta sync automatico
    sprints: boolean    // Tiene concepto de sprint/ciclo
    estimates: boolean  // Soporta story points nativamente
    comments: boolean   // Puede anadir comentarios
  }

  // Operaciones
  fetchTickets(projectId: string): Promise<TicketCache[]>
  fetchTicketDetail(key: string): Promise<TicketCache>
  createTicket(data: CreateTicketData): Promise<{ key: string; url?: string }>
  updateTicket(key: string, data: UpdateTicketData): Promise<void>
  addComment(key: string, comment: string): Promise<void>
  getCurrentSprint(): Promise<{ name: string; startDate: string; endDate: string } | null>
}
```

### Implementaciones del adapter

#### 1. Jira Cloud Adapter (full sync)

```
Configuracion: jiraBaseUrl + jiraProjectKey + jiraToken + jiraUserEmail
Capabilities: read ✓ | write ✓ | sync ✓ | sprints ✓ | estimates ✓ | comments ✓
Auth: Basic base64(email:apiToken)
```

| Operacion | Endpoint Jira | Cuando se usa |
|-----------|--------------|---------------|
| Buscar tickets sprint | `GET /rest/api/3/search?jql=project=KEY AND sprint in openSprints()` | Sync periodico |
| Detalle de ticket | `GET /rest/api/3/issue/PROJ-123` | `/refinar PROJ-123` |
| Actualizar ticket | `PUT /rest/api/3/issue/PROJ-123` | Refinamiento aprobado |
| Actualizar estimacion | `PUT /rest/api/3/issue/PROJ-123` (campo story_points) | Estimacion cerrada |
| Crear ticket | `POST /rest/api/3/issue` | Propuesta aprobada |
| Comentar | `POST /rest/api/3/issue/PROJ-123/comment` | Resumen de refinamiento |
| Sprint activo | `GET /rest/agile/1.0/board/{boardId}/sprint` | Velocity |

**Mapeo de campos a TicketCache:**
- `key` -> `externalKey`
- `fields.summary` -> `title`
- `fields.description` -> `description` (convertir ADF a texto)
- `fields.status.name` -> `status`
- `fields.priority.name` -> `priority` (normalizar a lowercase)
- `fields.issuetype.name` -> `issueType` (normalizar)
- `fields.assignee.displayName` -> `assignee`
- `fields.assignee.emailAddress` -> `assigneeEmail`
- `fields.customfield_10016` -> `estimate` (story points, el ID del campo varia)
- `fields.sprint.name` -> `sprint`
- URL: `${jiraBaseUrl}/browse/${key}` -> `externalUrl`

#### 2. Linear Adapter (full sync)

```
Configuracion: linearTeamId + linearApiKey
Capabilities: read ✓ | write ✓ | sync ✓ | sprints ✓ (cycles) | estimates ✓ | comments ✓
Auth: Bearer token
```

API GraphQL:
```graphql
# Leer tickets del ciclo activo
query { team(id: "ID") { activeCycle { issues { nodes {
  identifier, title, description, state { name }, priority, estimate,
  assignee { name, email }, labels { nodes { name } }, url
} } } } }

# Crear issue
mutation { issueCreate(input: { teamId, title, description, priority, estimate }) {
  issue { identifier, url }
} }

# Actualizar issue
mutation { issueUpdate(id: "ID", input: { description, estimate }) {
  issue { identifier }
} }
```

**Mapeo a TicketCache:**
- `identifier` -> `externalKey` (ej: PAY-45)
- `state.name` -> `status`
- `priority` -> 0=none, 1=urgent, 2=high, 3=medium, 4=low -> normalizar
- `estimate` -> `estimate` (Linear usa numeros directamente)
- `activeCycle.name` -> `sprint`
- `url` -> `externalUrl`

#### 3. GitHub Issues Adapter (read + limited write)

```
Configuracion: githubRepo + githubToken
Capabilities: read ✓ | write ✓ | sync ✓ | sprints ✗* | estimates ✗ | comments ✓

*sprints: GitHub no tiene sprints nativos. Se puede mapear milestone como sprint.
*estimates: GitHub no tiene story points. Se usan labels (ej: "estimate:5") como convencion.
```

API REST:
```
GET /repos/{owner}/{repo}/issues?state=open&per_page=50
POST /repos/{owner}/{repo}/issues  (crear)
PATCH /repos/{owner}/{repo}/issues/{number}  (actualizar)
POST /repos/{owner}/{repo}/issues/{number}/comments  (comentar)
```

**Mapeo a TicketCache:**
- `number` -> `externalKey` (ej: #123)
- `title` -> `title`
- `body` -> `description`
- `state` + labels -> `status` (open = "To Do", labels: "in-progress" = "In Progress")
- labels -> `priority` (buscar label "priority:high", etc.)
- labels -> `estimate` (buscar label "estimate:5", etc.)
- `milestone.title` -> `sprint`
- `assignee.login` -> `assignee`
- `html_url` -> `externalUrl`

**Limitaciones:**
- No hay sprints nativos (se usa milestone como aproximacion)
- No hay story points nativos (se usa convencion de labels)
- No hay workflows/transiciones (solo open/closed)
- GitHub Projects v2 tiene tableros pero su API es compleja y limitada

#### 4. Manual Adapter (sin integracion)

```
Configuracion: ninguna
Capabilities: read ✓ | write ✗ (solo local) | sync ✗ | sprints ✗ | estimates ✓* | comments ✗

*estimates: se guardan en TicketCache.estimate localmente
```

Para equipos sin tracker o en fase de evaluacion. Los tickets entran por:

**Opcion A: Importar archivo**
```
POST /api/import/tickets
Content-Type: multipart/form-data
Body: file + projectId + format ("csv" | "xml" | "json" | "trello_json" | "asana_csv")
```

**Opcion B: Pegar en el chat**
```
Dev: "Tenemos estos tickets pendientes:
      - Mejorar login (alta prioridad)
      - Fix bug en checkout (critico)
      - Refactor del API de pagos"

IA: "He detectado 3 tickets. Los cargo en el proyecto:
     - MAN-001: Mejorar login (high)
     - MAN-002: Fix bug en checkout (highest)
     - MAN-003: Refactor del API de pagos (medium)
     ¿Correcto?"
```

**Opcion C: Crear desde la UI**
Vista de proyecto con formulario simple: titulo, descripcion, prioridad, asignado.
Se crea directamente en TicketCache con `source: "manual"` y `syncEnabled: false`.

#### Formatos de importacion soportados

**CSV** (minimo):
```csv
key,title,description,status,priority,assignee,estimate
PROJ-1,Mejorar login,Anadir OAuth,To Do,High,ana@team.com,8
PROJ-2,Fix bug pagos,Error en checkout,In Progress,Critical,carlos@team.com,3
```

**XML** (formato export de Jira):
```xml
<rss version="0.92">
  <channel>
    <item>
      <key>PROJ-123</key>
      <summary>Mejorar login</summary>
      <description>Anadir OAuth Google</description>
      <status>To Do</status>
      <priority>High</priority>
      <assignee>ana@team.com</assignee>
      <customfield_10016>8</customfield_10016>
    </item>
  </channel>
</rss>
```

**JSON** (generico):
```json
[
  {
    "key": "PROJ-1",
    "title": "Mejorar login",
    "description": "Anadir OAuth",
    "status": "To Do",
    "priority": "High",
    "assignee": "ana@team.com",
    "estimate": 8
  }
]
```

**Trello JSON export**: parsear `cards` -> `name` (title), `desc` (description), `idList` -> nombre de lista (status), `labels` (priority/tags)

**Asana CSV export**: parsear columnas estandar de Asana (Name, Section, Assignee, Due Date, etc.)

#### Flujo de importacion

```
1. Usuario va a Projects > Configuracion > Importar tickets
2. Sube archivo o pega texto
3. Backend parsea segun formato detectado o indicado
4. Preview: "Se importaran X tickets. Nuevos: Y, Actualizados: Z"
5. Usuario confirma
6. Upsert en TicketCache (por externalKey)
7. TicketCache.source = "csv_import" | "xml_import" | "json_import"
8. TicketCache.syncEnabled = false (no se resincronizan)
9. Tickets disponibles para la IA inmediatamente
```

### Estrategia de sync (para adapters con sync)

```
LECTURA (frecuente):
- Al abrir la app / cambiar de proyecto: sync completo (sprint actual si aplica)
- Cache en TicketCache con TTL de 15 minutos
- Forzar refresh: via API, boton en UI, o comando /refinar

ESCRITURA (con confirmacion, solo si adapter.capabilities.write):
- Refinamiento: actualizar description + AC (el dev confirma)
- Estimacion: actualizar story points (sesion cerrada)
- Propuesta aprobada: crear issue en tracker
- Comentario: anadir nota de refinamiento

SI NO HAY WRITE:
- La IA muestra el resultado (AC, estimacion) y dice:
  "No puedo actualizar el tracker automaticamente.
  Copia esto en [ticket URL]:"
  Y formatea los datos para copiar-pegar

INVALIDACION:
- TicketCache.lastSyncedAt + 15 min = expired
- Forzar con /refinar o boton refresh
- Background sync al cargar app por proyecto
- Tickets con syncEnabled=false nunca se resincronizan
```

### Tabla resumen de integraciones

| Integracion | Lectura | Escritura | Sprints | Estimates | Prioridad |
|------------|---------|-----------|---------|-----------|-----------|
| **Jira Cloud** | Sync sprint completo | Crear, actualizar, comentar | Si (nativo) | Si (story points) | P0 |
| **Linear** | Sync cycle completo | Crear, actualizar, comentar | Si (cycles) | Si (nativo) | P1 |
| **GitHub Issues** | Sync open issues | Crear, comentar, labels | Parcial (milestones) | Parcial (labels) | P2 |
| **Manual (sin tracker)** | N/A | Solo local | No | Si (local) | P0 |
| **CSV/XML/JSON import** | Importacion unica | No (solo lectura) | No | Si (si viene en datos) | P1 |
| **Trello export** | Via JSON export | No | Parcial (listas) | No | P3 |
| **Asana export** | Via CSV export | No | Parcial (sections) | No | P3 |

### Que pasa cuando NO hay integracion

Dayless funciona perfectamente sin tracker externo. La diferencia:

| Con tracker | Sin tracker |
|-------------|-------------|
| Tickets se sincronizan automaticamente | Tickets se importan manualmente o se crean via propuestas |
| Refinamiento actualiza el tracker | Refinamiento queda en TicketCache local |
| Estimacion se sube al tracker | Estimacion queda en TicketCache local |
| Propuesta aprobada crea en tracker | Propuesta aprobada crea en TicketCache local |
| Sprint/velocity desde tracker | Sprint manual (el lead define inicio/fin) |
| La IA dice "actualizado en Jira" | La IA dice "actualizado en el tablero" |

El equipo puede empezar sin nada y conectar un tracker cuando quiera. Los datos de TicketCache se mantienen y se enlazan con el tracker al configurar la integracion.

---

## 5. Fase 1: Chat Core

### Objetivo

Cada miembro del equipo tiene un chat privado 1:1 con la IA (su Scrum Master personal), separado por proyecto. La IA escucha, recuerda, coordina y actua.

### Flujo funcional

```
1. Miembro abre chat > selecciona proyecto
2. Historial de mensajes previos se carga (ultimos N mensajes)
3. Miembro escribe mensaje
4. Backend:
   a. Guarda mensaje del usuario
   b. Construye contexto completo (equipo, knowledge, Jira, otros miembros)
   c. Llama al LLM con system prompt + historial + contexto
   d. Parsea respuesta para acciones (propuestas, knowledge, etc.)
   e. Guarda respuesta de la IA
5. Frontend muestra respuesta con acciones inline si las hay
```

### Contexto que recibe la IA en cada mensaje

La calidad de las respuestas depende enteramente del contexto. Este es el contexto completo que el LLM recibe:

#### Bloque 1: Identidad y rol

```
IDENTIDAD:
Eres "Dayless.ai", un Scrum Master experimentado que coordina equipos
de desarrollo de forma asincrona. No eres un chatbot generico. Tu trabajo
es eliminar reuniones haciendo que la coordinacion suceda naturalmente
por chat.

REGLAS DE COMPORTAMIENTO:
- Hablas en espanol por defecto, pero te adaptas al idioma del usuario
- Eres directo y concreto, no verboso
- Nunca afirmas cosas que no sabes. Si no tienes informacion, preguntas
- Nunca ejecutas acciones sin confirmacion del usuario
- Cuando detectas algo relevante de otro miembro, lo compartes sin revelar
  la conversacion privada (solo el dato relevante)
```

#### Bloque 2: Contexto del equipo

```
EQUIPO: {team.name}
MIEMBROS:
- Ana Garcia (Tech Lead) - activa - puede aprobar tickets
- Carlos Lopez (Developer) - activo
- Luis Martinez (Developer) - activo
- Maria Ruiz (Product Manager) - activa - puede aprobar tickets

PROYECTO ACTUAL (este chat): {project.name}
SPRINT ACTUAL: Sprint 14 (2026-03-18 al 2026-04-01)
```

#### Bloque 3: Knowledge base

```
CONOCIMIENTO DEL EQUIPO (decisiones y acuerdos vigentes):
- **Stack backend**: Node.js + Express + PostgreSQL (decidido 2026-02-15, verificado)
- **PR reviews**: Minimo 2 approvals antes de merge (decidido 2026-01-10, verificado)
- **Deploy schedule**: Solo martes y jueves a produccion (decidido 2026-03-01, verificado)
- **API naming**: REST con kebab-case en URLs (decidido 2026-02-20, verificado)

Consulta SIEMPRE esta base de conocimiento antes de responder.
No contradigas decisiones vigentes. Si el usuario propone algo que
contradice una decision, mencionalo.
```

#### Bloque 4: Tickets del sprint (desde TicketCache)

```
TICKETS DEL SPRINT ACTUAL (desde {source: Jira | Linear | importados | manuales}):
- [PAY-123] Mejorar login - To Do - High - Asignado: Ana - Sin estimar
- [PAY-124] Fix bug checkout - In Progress - Critical - Asignado: Carlos - 3pts
- [PAY-125] Refactor API pagos - In Progress - Medium - Asignado: Luis - 5pts
- [PAY-126] Tests e2e - To Do - Low - Sin asignar - Sin estimar
- [PAY-127] Documentar API - Done - Low - Asignado: Luis - 2pts

TICKETS SIN REFINAR (sin AC o sin estimacion):
- [PAY-123] Mejorar login - Sin AC, sin estimacion
- [PAY-126] Tests e2e - Sin AC, sin estimacion
```

#### Bloque 5: Resumen cross-member (NO la conversacion)

```
CONTEXTO DE OTROS MIEMBROS (resumenes, NO conversaciones completas):
- Carlos: reporto ayer que esta bloqueado en PAY-124 por un tema de permisos
  en la pasarela de pagos. Lleva 3 dias con el ticket.
- Luis: termino PAY-127 ayer. Hoy empieza con PAY-125.
  Sin blockers reportados.
- Maria: pidio ayer que se priorizara PAY-123 antes del cierre del sprint.

BLOCKERS ACTIVOS:
- Carlos: bloqueado en PAY-124 (permisos pasarela pagos) - 3 dias

ESTIMACIONES PENDIENTES (sesiones abiertas):
- PAY-123: sesion abierta, faltan votos de Carlos y Luis

PROPUESTAS PENDIENTES DEL MIEMBRO ACTUAL:
- "Cache para API de pagos" (pending_review, propuesta hace 2 dias)
```

#### Bloque 6: Story Point Guide

```
GUIA DE STORY POINTS DEL EQUIPO:
| SP | Significa | Ejemplo |
|----|-----------|---------|
| 1  | Cambio trivial, <2h | Fix typo, cambiar copy |
| 2  | Pequeno, <medio dia | Anadir validacion |
| 3  | Medio dia a 1 dia | Feature pequena con tests |
| 5  | 2-3 dias | Feature media, integracion con servicio |
| 8  | ~1 semana | Feature compleja, multiples componentes |
| 13 | >1 semana | Debe partirse en tickets menores |
| 21 | Demasiado grande | NO estimar, hay que partir |

Usa esta guia como referencia al estimar. Cuando pidas estimacion,
sugiere tickets similares ya estimados como comparativa.
```

#### Bloque 7: Instrucciones de acciones

```
ACCIONES DISPONIBLES:

1. PROPONER TICKET:
   Cuando el usuario describe algo que deberia ser un ticket, propone
   una TicketProposal. Presenta el borrador al usuario para que confirme.
   Formato JSON al final del mensaje:
   ```json
   {
     "ticket_proposal": {
       "ready": true|false,
       "title": "...",
       "description": "...",
       "acceptanceCriteria": "- [ ] ...\n- [ ] ...",
       "priority": "medium",
       "issueType": "story",
       "estimate": null,
       "missing": []
     }
   }
   ```
   Si ready=false, lista lo que falta en "missing" y pregunta.
   Si ready=true, pide confirmacion al usuario para enviar a cola de aprobacion.

2. GUARDAR CONOCIMIENTO:
   Cuando detectes una decision o acuerdo importante, propon guardarlo:
   "He detectado una decision: [descripcion]. ¿La guardo en la base de
   conocimiento del equipo?"
   Si confirma, formato:
   ```json
   {
     "knowledge_entry": {
       "key": "titulo corto",
       "value": "descripcion completa de la decision",
       "category": "decision"
     }
   }
   ```

3. REFINAR TICKET:
   Cuando el usuario pida refinar un ticket de Jira (o tu lo sugieras):
   - Trae los detalles actuales del ticket
   - Pregunta por AC, dudas, edge cases
   - Propone AC y pide confirmacion
   - Cuando el usuario aprueba, formato:
   ```json
   {
     "ticket_update": {
       "ticketKey": "PAY-123",
       "description": "nueva descripcion...",
       "acceptanceCriteria": "- [ ] ...",
       "estimate": null,
       "comment": "Refinado en Dayless con Ana: [resumen]"
     }
   }
   ```
   El backend resuelve via adapter: si hay integracion actualiza en el tracker,
   si no actualiza en TicketCache local.

4. STANDUP RAPIDO:
   Si el usuario da un update de su dia (que hizo, que hara, blockers),
   extrae y guarda como StandupCheckin:
   ```json
   {
     "standup_checkin": {
       "yesterdayWork": "...",
       "todayPlan": "...",
       "blockers": "..." | null,
       "mood": "good"
     }
   }
   ```

NUNCA ejecutes una accion sin que el usuario confirme primero.
NUNCA inventes IDs de tickets.
NUNCA afirmes que un ticket ha sido creado hasta que el sistema lo confirme.
```

### Quick actions (slash commands del chat)

| Comando | Que hace la IA |
|---------|---------------|
| `/standup` | Abre dialogo de standup o pregunta que hiciste/haras/blockers |
| `/refinar PAY-123` | Trae ticket de Jira, inicia refinamiento conversacional |
| `/proponer` | Guia al usuario para redactar una propuesta de ticket |
| `/mis-tickets` | Lista tickets asignados al miembro en Jira |
| `/blockers` | Muestra blockers activos del equipo (cruzando chats) |
| `/decisiones` | Lista decisiones recientes del knowledge base |
| `/estimar PAY-123` | (Solo leads) Abre sesion de estimacion para ese ticket |
| `/retro` | (Solo leads) Inicia retrospectiva del sprint |

### Tareas de implementacion - Fase 1

| # | Tarea | Descripcion |
|---|-------|-------------|
| 1.1 | Refactorizar system prompt | Reescribir el prompt del chat con la estructura de 7 bloques descrita arriba |
| 1.2 | Construir contexto cross-member | Endpoint/funcion que resume lo relevante de otros miembros (blockers, updates, dependencias) SIN revelar la conversacion completa |
| 1.3 | Integrar knowledge base en prompt | Cargar knowledge entries vigentes (no expiradas) y pasarlas como contexto |
| 1.4 | Parsear acciones JSON del LLM | Detectar `ticket_proposal`, `knowledge_entry`, `ticket_update`, `standup_checkin` en la respuesta y ejecutar via adapter |
| 1.5 | Quick actions handler | Detectar slash commands y inyectar contexto especifico al prompt |
| 1.6 | Confirmacion de acciones UI | Mostrar propuestas/acciones con botones de confirmar/rechazar en el chat |
| 1.7 | Eliminar logica de tickets internos | Quitar todo el codigo de `INTERNAL_TICKET_ACTION`, `executeInternalTicketCreate`, fallbacks, etc. |

### Prompt completo para la tarea 1.2: Contexto cross-member

El contexto cross-member es la pieza clave que convierte a la IA en un coordinador real. Se construye asi:

```typescript
async function buildCrossMemberContext(
  teamId: string,
  projectId: string,
  currentMemberId: string
): Promise<string> {
  // 1. Obtener los ultimos mensajes de CADA miembro (no el actual)
  //    Solo los ultimos 5 mensajes de cada uno, de las ultimas 48h

  // 2. Para cada miembro, extraer:
  //    - Ultimo update de trabajo (que esta haciendo)
  //    - Blockers activos mencionados
  //    - Dependencias con otros (menciones de tickets, APIs, etc.)
  //    - Mood/sentimiento general (inferido del tono)

  // 3. Llamar al LLM con un prompt de resumen:

  const summaryPrompt = `
    Analiza estos mensajes recientes del equipo y genera un resumen
    conciso para dar contexto a otro miembro. NO incluyas la conversacion
    literal, solo los datos relevantes:

    Para cada miembro incluye (si hay info):
    - En que esta trabajando
    - Blockers reportados
    - Dependencias con otros miembros o tickets
    - Tiempo estimado si lo menciono

    NO incluyas: opiniones personales, quejas no-constructivas,
    contexto irrelevante al proyecto.

    Mensajes:
    ${memberMessages}
  `

  // 4. Cachear el resumen 30 minutos para no llamar al LLM en cada mensaje

  return summary
}
```

**Alternativa sin doble llamada al LLM**: En vez de llamar al LLM para resumir, se pueden extraer los datos estructuradamente de los mensajes (ultimo standup checkin, blockers en knowledge base, ticket assignments del TicketCache). Es menos preciso pero mas rapido y barato.

---

## 6. Fase 2: Sync con Tracker + Refinamiento

### Objetivo

La IA facilita el refinamiento de tickets conversacionalmente. Trae tickets del tracker (Jira, Linear, GitHub, o importados), pregunta por criterios de aceptacion, ayuda a estimar, y actualiza el tracker cuando el dev confirma (si la integracion lo permite). Si no hay integracion, el refinamiento queda en TicketCache local. El refinamiento es **iterativo** y **cross-member**: la IA lleva las opiniones de unos a otros.

### Flujo funcional del refinamiento

```
Fase A: Deteccion
  La IA detecta tickets sin refinar (sin AC, sin estimacion, descripcion vaga)
  y los propone al equipo para refinar.

Fase B: Refinamiento individual
  La IA habla con cada dev involucrado en su chat privado.
  Pregunta sobre AC, edge cases, dudas tecnicas.

Fase C: Cruce de opiniones (iterativo)
  La IA lleva las preguntas/respuestas de unos a otros.
  "Carlos pregunta si hay que soportar OAuth con Apple"
  "Ana dice que no, queda fuera de scope"

Fase D: Consolidacion
  La IA consolida AC, propone descripcion final, pide confirmacion.

Fase E: Actualizacion
  Tras confirmacion, actualiza el ticket en Jira.
  Anade comentario con el resumen del refinamiento.
```

### Ejemplo completo de refinamiento iterativo

```
--- Chat de Ana (Tech Lead) ---

IA: Hola Ana. En el sprint actual hay 2 tickets sin refinar:
    - PAY-123 "Mejorar login" - sin AC, sin estimacion
    - PAY-126 "Tests e2e" - sin AC, sin estimacion
    ¿Empezamos con PAY-123?

Ana: Si, dale con PAY-123

IA: PAY-123 "Mejorar login"
    Descripcion actual: "Mejorar el sistema de login del aplicativo"

    Esto es bastante vago. Algunas preguntas:
    1. ¿Que proveedores de OAuth? (Google, GitHub, Apple...)
    2. ¿Se requiere 2FA?
    3. ¿Hay requisitos de "remember me" / sesion persistente?
    4. ¿Hay que migrar usuarios existentes?

Ana: Google OAuth seguro. 2FA opcional con authenticator.
     Remember me si. No hay usuarios existentes, es nuevo.

IA: Perfecto. Propongo estos criterios de aceptacion:

    - [ ] Login con Google OAuth 2.0 funcional
    - [ ] 2FA opcional con TOTP (Google Authenticator / Authy)
    - [ ] Opcion "Recordarme" con sesion persistente (30 dias)
    - [ ] Pagina de setup de 2FA con QR code
    - [ ] Flujo de recuperacion si se pierde el 2FA
    - [ ] Tests unitarios para flujo OAuth y 2FA

    Antes de cerrarlo, voy a preguntar a Carlos y Luis si ven algo
    que falte. ¿Te parece?

Ana: Si, preguntales

--- Chat de Carlos (Developer) ---

IA: Carlos, estamos refinando PAY-123 "Mejorar login".
    Ana propone estos AC:
    [lista AC]

    ¿Ves algo que falte? ¿Alguna duda tecnica?

Carlos: ¿Y si el usuario se registra con email normal y luego
        quiere vincular Google? ¿O al reves?

IA: Buena pregunta. Se la traslado a Ana.

--- Chat de Ana ---

IA: Carlos pregunta: ¿que pasa si alguien se registra con email
    y luego quiere vincular su cuenta de Google? ¿O al reves?

Ana: Buen punto. Hay que permitir vincular/desvincular OAuth
     en la pagina de perfil. Anade ese AC.

--- Chat de Carlos ---

IA: Ana dice que si, se permitira vincular/desvincular OAuth
    desde el perfil. Se anade a los AC.

    ¿Algo mas que veas?

Carlos: No, por mi parte bien

--- Chat de Luis ---

IA: Luis, estamos refinando PAY-123 "Mejorar login".
    AC propuestos por Ana (con input de Carlos):
    [lista AC actualizada con el punto de vincular/desvincular]

    ¿Ves algo que falte?

Luis: ¿Rate limiting en intentos de login? Para seguridad.

--- Chat de Ana ---

IA: Luis sugiere anadir rate limiting en intentos de login.
    ¿Lo incluimos?

Ana: Si, 5 intentos, luego bloqueo 15 minutos. Anadelo.

--- Chat de Ana (consolidacion) ---

IA: AC finales para PAY-123 "Mejorar login":

    - [ ] Login con Google OAuth 2.0 funcional
    - [ ] 2FA opcional con TOTP (Google Authenticator / Authy)
    - [ ] Opcion "Recordarme" con sesion persistente (30 dias)
    - [ ] Pagina de setup de 2FA con QR code
    - [ ] Flujo de recuperacion si se pierde el 2FA
    - [ ] Vincular/desvincular Google OAuth desde perfil
    - [ ] Rate limiting: 5 intentos fallidos = bloqueo 15 min
    - [ ] Tests unitarios para flujo OAuth, 2FA y rate limiting

    Todos han dado input. ¿Actualizo el ticket?

Ana: Si, sube

IA: ✅ PAY-123 actualizado:
    - Descripcion actualizada con AC
    - Comentario anadido: "Refinado en Dayless con Ana, Carlos y Luis"
    (Si hay integracion → se actualiza en el tracker.
     Si no hay → se actualiza en TicketCache local.)

    Falta la estimacion. ¿Abro sesion de Planning Poker?

Ana: Si, abrela
```

### Tareas de implementacion - Fase 2

| # | Tarea | Descripcion |
|---|-------|-------------|
| 2.1 | Adapter layer | Implementar `src/lib/ticket-source.ts` con la interfaz comun y adapters para Jira, Linear, GitHub, Manual |
| 2.2 | Sync tickets | Endpoint `GET /api/tickets/sync?projectId=X` que usa el adapter correcto segun config del proyecto |
| 2.3 | Detalle de ticket | Endpoint `GET /api/tickets/cache/:key?projectId=X` que trae de cache o fetch directo via adapter |
| 2.4 | Actualizar ticket | Endpoint `PUT /api/tickets/cache/:key` que actualiza via adapter (si soporta write) o solo en TicketCache local |
| 2.5 | Crear comentario | Endpoint `POST /api/tickets/cache/:key/comment` via adapter si disponible |
| 2.6 | Deteccion de tickets sin refinar | Query sobre `TicketCache` que identifica tickets sin AC o sin estimacion |
| 2.7 | Estado de refinamiento en memoria | Estructura en-memoria o en BD (metadata del Message) que trackea el estado iterativo del refinamiento por ticket |
| 2.8 | Handler de `/refinar` en chat | Cuando el usuario dice `/refinar PAY-123`, traer detalle via adapter, inyectar en prompt, iniciar flujo |
| 2.9 | Parsear `ticket_update` del LLM | Detectar accion de update y ejecutar via adapter |
| 2.10 | Proactividad: notificar tickets sin refinar | Al inicio de conversacion, si hay tickets sin refinar asignados al miembro, mencionarlos |
| 2.11 | Importacion CSV/XML/JSON | Endpoint `POST /api/import/tickets` que parsea archivos y carga en `TicketCache` con syncEnabled=false |
| 2.12 | Importacion desde chat | La IA detecta cuando el usuario pega una lista de tickets y los carga en TicketCache |

### Prompt para la tarea 2.6: Estado de refinamiento

La IA necesita saber en que fase esta el refinamiento de cada ticket para no repetir preguntas ni perder contexto entre mensajes:

```
ESTADO DE REFINAMIENTO ACTIVO:
Ticket: PAY-123 "Mejorar login"
Fase: cruce_de_opiniones
Iteracion: 2
AC propuestos hasta ahora:
  - Login con Google OAuth 2.0 funcional (propuesto por Ana, ronda 1)
  - 2FA opcional con TOTP (propuesto por Ana, ronda 1)
  - Vincular/desvincular OAuth (propuesto por Carlos, ronda 2)
Miembros consultados: Ana (si), Carlos (si), Luis (pendiente)
Preguntas abiertas: ninguna
Ultimo cambio: Carlos sugirio vincular/desvincular OAuth, Ana aprobo

Continua el refinamiento segun la fase actual. Si todos los miembros
asignados al proyecto han dado input y no hay preguntas abiertas,
propone consolidar y subir a Jira.
```

---

## 7. Fase 3: Propuestas de Ticket + Aprobacion

### Objetivo

Cualquier miembro puede proponer un ticket desde el chat. La propuesta entra en cola de revision. Solo miembros con `canApproveTickets = true` pueden aprobar/rechazar. Al aprobar, se crea automaticamente en Jira.

### Flujo funcional

```
1. PROPUESTA (en el chat)
   Dev: "Necesitamos cachear las respuestas del API de pagos"
   IA: Propone borrador de ticket con titulo, descripcion, AC, prioridad
   Dev: Confirma o ajusta
   IA: Envia a cola de aprobacion

2. REVISION (vista Proposals o chat del lead)
   Lead ve propuestas pendientes
   Para cada una puede:
   a. Aprobar → se crea en Jira automaticamente
   b. Rechazar con motivo → la IA notifica al autor
   c. Editar antes de aprobar → ajustar titulo, prioridad, etc.
   d. Pedir mas info → la IA pregunta al autor en su chat

3. NOTIFICACION
   Al autor: "Tu propuesta 'Cache API pagos' fue aprobada.
   Creada como PAY-130 en Jira ✓"
   o: "Tu propuesta fue rechazada. Motivo: [motivo del lead]"
```

### Ejemplo completo

```
--- Chat de Carlos ---

Carlos: Oye, el API de pagos tarda 3 segundos en responder.
        Habria que meter una cache.

IA: Suena a que necesitamos un ticket. Te ayudo a redactarlo:

    **Propuesta de ticket (borrador)**
    Titulo: Implementar cache en API de pagos
    Descripcion: Las respuestas del endpoint /payments tardan ~3s
    en promedio. Implementar capa de cache para reducir latencia.

    Criterios de aceptacion:
    - [ ] Cache implementada (Redis o in-memory)
    - [ ] Latencia < 300ms en cache hit
    - [ ] TTL configurable por endpoint
    - [ ] Invalidacion al crear/modificar pago
    - [ ] Metricas de hit rate

    Prioridad: high
    Tipo: story

    ¿Quieres ajustar algo o lo envio a revision?

Carlos: Anade que hay que medir antes y despues para comparar

IA: Anadido:
    - [ ] Benchmark antes/despues documentado

    Envio a cola de aprobacion. ✓
    Ana o Maria (que pueden aprobar tickets) lo revisaran.

--- Chat de Ana (lead, en algun momento posterior) ---

IA: Tienes 1 propuesta de ticket pendiente de revision:

    📋 "Implementar cache en API de pagos"
    Propuesto por: Carlos (hace 2h)
    Origen: chat
    Prioridad propuesta: high

    [Ver detalle] [Aprobar] [Rechazar] [Pedir mas info]

    ¿Quieres revisarla?

Ana: Si, la veo bien. Aprueba.

IA: ✅ Propuesta aprobada.
    (Si hay integracion → "Creando en Jira/Linear/GitHub...")
    Creado: PAY-130 "Implementar cache en API de pagos"
    (Si no hay integracion → "Anadido al tablero del proyecto ✓")
    Le notifico a Carlos.

--- Chat de Carlos (automaticamente) ---

IA: Tu propuesta "Implementar cache en API de pagos" fue
    aprobada por Ana. Creada como PAY-130 ✓
```

### Endpoints API

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `GET /api/proposals?teamId=X&status=pending_review` | GET | Lista propuestas (filtrar por status, project, member) |
| `POST /api/proposals` | POST | Crear propuesta (desde chat o vista) |
| `PUT /api/proposals/:id` | PUT | Actualizar propuesta (editar antes de aprobar) |
| `POST /api/proposals/:id/approve` | POST | Aprobar propuesta (crea en tracker via adapter si disponible, o en TicketCache local. Solo `canApproveTickets`) |
| `POST /api/proposals/:id/reject` | POST | Rechazar con motivo |

### Tareas de implementacion - Fase 3

| # | Tarea | Descripcion |
|---|-------|-------------|
| 3.1 | Modelo TicketProposal en Prisma | Crear modelo, migrar schema |
| 3.2 | CRUD API de propuestas | Endpoints GET/POST/PUT |
| 3.3 | Endpoint aprobar propuesta | POST /approve que valida permisos, crea en tracker via adapter (o TicketCache si no hay), actualiza status, guarda externalKey |
| 3.4 | Endpoint rechazar propuesta | POST /reject con motivo |
| 3.5 | Parsear `ticket_proposal` del LLM | Detectar JSON de propuesta en respuesta de la IA, crear TicketProposal con status draft |
| 3.6 | Confirmacion en chat UI | Botones de confirmar/editar propuesta en la interfaz del chat |
| 3.7 | Notificacion a lead | Cuando se crea propuesta, la IA lo menciona en el proximo mensaje al lead |
| 3.8 | Notificacion al autor | Cuando se aprueba/rechaza, la IA lo menciona en el proximo mensaje al autor |
| 3.9 | Vista Proposals | UI de cola de propuestas con filtros y acciones |
| 3.10 | Validacion canApproveTickets | Middleware que verifica permisos en endpoints de aprobacion |

### Prompt inyectado cuando hay propuestas pendientes

Para el lead (en su chat):
```
PROPUESTAS PENDIENTES DE REVISION:
Tienes {count} propuestas de ticket esperando tu revision:

1. "Implementar cache en API de pagos"
   - Propuesto por: Carlos | Hace: 2h | Prioridad: high | Proyecto: Payment
   - Origen: chat (el usuario detecto un problema de rendimiento)

2. "Anadir validacion de email en registro"
   - Propuesto por: Luis | Hace: 1d | Prioridad: medium | Proyecto: Payment
   - Origen: refinamiento (detectado como AC faltante en PAY-123)

Si el usuario pregunta por propuestas pendientes o si no las ha revisado
en >24h, recuerdalo proactivamente.
```

Para el autor (en su chat):
```
TUS PROPUESTAS:
- "Cache API pagos" - pending_review (hace 2h) - pendiente de revision por Ana/Maria
- "Logging centralizado" - rejected (hace 3d) - Motivo: "Ya existe un ticket similar PAY-98"
```

---

## 8. Fase 4: Estimacion Asincrona

### Objetivo

Estimacion tipo Planning Poker pero asincrona. El lead abre una sesion de estimacion para un ticket. La IA pide a cada dev que vote en su chat privado. Los votos son ocultos hasta que todos votan. Si hay divergencia, la IA facilita la discusion y abre otra ronda. El resultado se sube a Jira.

### Flujo funcional

```
Fase A: Apertura (lead)
  Lead dice "/estimar PAY-123" o la IA sugiere estimar tras refinamiento.
  Se crea EstimationSession con status "voting".

Fase B: Votacion (cada dev, asincrono)
  La IA pregunta a cada dev en su chat privado.
  Da contexto: titulo, AC, tickets similares, story point guide.
  Dev vota con Fibonacci (1,2,3,5,8,13,21) o "?" si no sabe.
  Votos ocultos hasta que todos votan.

Fase C: Revelacion
  Cuando todos han votado, la IA revela los resultados.
  Si hay consenso (todos iguales o diferencia <= 1 paso Fibonacci):
    → Cierra con ese valor.
  Si hay divergencia:
    → La IA facilita discusion, explica las razones.
    → Abre nueva ronda.

Fase D: Cierre
  Consenso alcanzado o lead decide valor final.
  Se sube a Jira como story points.
```

### Ejemplo completo

```
--- Chat de Ana (lead) ---

Ana: /estimar PAY-123

IA: Abro sesion de estimacion para PAY-123 "Mejorar login".

    AC del ticket:
    - Login con Google OAuth 2.0
    - 2FA opcional con TOTP
    - Recordarme (sesion 30 dias)
    - Vincular/desvincular OAuth desde perfil
    - Rate limiting (5 intentos, bloqueo 15 min)
    - Tests unitarios

    Voy a pedir estimacion a: Ana, Carlos, Luis
    Los votos seran ocultos hasta que todos voten.

    ¿Tu estimacion? (1, 2, 3, 5, 8, 13, 21 o ? si necesitas mas info)

    Referencia de tickets similares:
    - PAY-100 "Login basico con email/password" = 3 pts (completado Sprint 10)
    - PAY-108 "Integracion Stripe" = 8 pts (completado Sprint 12)
    - PAY-115 "SSO con SAML" = 13 pts (completado Sprint 13)

Ana: 8

IA: Voto registrado ✓ (oculto hasta que todos voten)
    Faltan: Carlos, Luis

--- Chat de Carlos ---

IA: Hay una estimacion abierta para PAY-123 "Mejorar login".

    [mismos AC y referencia de tickets similares]

    ¿Tu estimacion? (1, 2, 3, 5, 8, 13, 21)

Carlos: Yo diria un 5. El OAuth con Google es bastante estandar
        y hay librerias que lo hacen facil.

IA: Voto registrado: 5 (con razon: OAuth estandar con librerias)
    Falta: Luis

--- Chat de Luis ---

IA: Hay una estimacion abierta para PAY-123 "Mejorar login".

    [mismos AC y referencia]

    ¿Tu estimacion?

Luis: 8, el 2FA siempre tiene edge cases

IA: Voto registrado: 8 (razon: complejidad del 2FA)
    Todos han votado ✓

--- Revelacion (chat de cada uno) ---

--- Chat de Carlos ---

IA: Resultados de estimacion PAY-123 "Mejorar login" (Ronda 1):

    | Miembro | Voto | Razon |
    |---------|------|-------|
    | Ana     | 8    | - |
    | Carlos  | 5    | OAuth estandar con librerias |
    | Luis    | 8    | Complejidad del 2FA |

    Hay divergencia: 5 vs 8
    Ana y Luis coinciden en 8, citando la complejidad del 2FA.

    Carlos, ¿mantienes el 5 o cambias?
    Ten en cuenta que el 2FA con TOTP incluye generacion de QR,
    validacion, y flujo de recuperacion.

Carlos: Tienen razon, no habia pensado en el flujo de recuperacion.
        Cambio a 8.

IA: ✅ Consenso alcanzado: PAY-123 = 8 story points

    Ronda 2: todos 8 (3/3)

    Informo a Ana.

--- Chat de Ana ---

IA: ✅ Estimacion cerrada para PAY-123 "Mejorar login":
    8 story points (consenso 3/3, ronda 2)

    Carlos inicialmente voto 5 (creia que OAuth era mas simple),
    pero cambio a 8 al considerar la complejidad del 2FA.

    ¿Actualizo el ticket con la estimacion?

Ana: Si

IA: ✅ PAY-123 actualizado: 8 story points
    (Si hay integracion → actualizado en el tracker.
     Si no → guardado en el tablero local.)
```

### Estimacion multiple (batch)

```
Ana: Hay que estimar PAY-123, PAY-124 y PAY-126

IA: Abro 3 sesiones de estimacion. Voy a pedir votos para
    cada una por separado a los devs asignados al proyecto.
    Te aviso cuando esten todas cerradas.

    Empecemos por la tuya. PAY-123 "Mejorar login":
    [AC y referencia]
    ¿Estimacion?
```

### Endpoints API

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `POST /api/estimations` | POST | Crear sesion de estimacion |
| `GET /api/estimations?projectId=X&status=voting` | GET | Listar sesiones activas |
| `GET /api/estimations/:id` | GET | Detalle de sesion con votos |
| `POST /api/estimations/:id/vote` | POST | Registrar voto (memberId, value, reasoning) |
| `POST /api/estimations/:id/reveal` | POST | Forzar revelacion (auto cuando todos votan) |
| `POST /api/estimations/:id/new-round` | POST | Abrir nueva ronda de votacion |
| `POST /api/estimations/:id/close` | POST | Cerrar sesion con valor final |
| `POST /api/estimations/:id/sync` | POST | Subir estimacion al tracker via adapter (si disponible) |

### Tareas de implementacion - Fase 4

| # | Tarea | Descripcion |
|---|-------|-------------|
| 4.1 | Modelos EstimationSession + EstimationVote | Crear en Prisma, migrar |
| 4.2 | CRUD API estimaciones | Endpoints basicos |
| 4.3 | Endpoint votar | Validar que el miembro no ha votado en esta ronda, guardar voto |
| 4.4 | Logica de revelacion | Cuando todos votan: revelar resultados, detectar consenso vs divergencia |
| 4.5 | Logica de nueva ronda | Abrir ronda N+1, resetear votos pendientes |
| 4.6 | Handler `/estimar` en chat | Detectar comando, crear sesion, notificar a miembros |
| 4.7 | Prompt de estimacion | Inyectar contexto (AC, tickets similares, guide) al pedir voto |
| 4.8 | Deteccion de consenso | Algoritmo: consenso si max - min <= 1 paso Fibonacci |
| 4.9 | Sync estimacion al tracker | Actualizar story_points via adapter (si soporta estimates). Si no, guardar solo en TicketCache local |
| 4.10 | Indicador en chat | Mostrar "Tienes N estimaciones pendientes" al abrir chat |

### Prompt inyectado cuando hay estimaciones pendientes

```
ESTIMACIONES PENDIENTES PARA ESTE MIEMBRO:
Hay {count} sesiones de estimacion esperando tu voto:

1. PAY-123 "Mejorar login" - Ronda 1 - Abierta hace 3h
   AC: [resumen corto]
   Referencia: PAY-100 (3pts), PAY-108 (8pts)

2. PAY-126 "Tests e2e" - Ronda 1 - Abierta hace 1h
   AC: [resumen corto]

Pregunta al usuario si quiere votar ahora. Da el contexto
necesario (AC completos, tickets similares, story point guide).
Valores permitidos: 1, 2, 3, 5, 8, 13, 21, ?
```

### Algoritmo de consenso

```
Fibonacci: [1, 2, 3, 5, 8, 13, 21]

Consenso perfecto: todos iguales → cerrar
Cuasi-consenso: diferencia max 1 paso en Fibonacci → sugerir el valor mayoritario
  Ej: [5, 5, 8] → sugerir 5 o 8 segun mayoria
Divergencia leve: 2 pasos → facilitar discusion, nueva ronda
  Ej: [3, 5, 8] → pedir que expliquen
Divergencia fuerte: 3+ pasos → la IA senala las perspectivas extremas
  Ej: [3, 13] → "hay una diferencia grande, veamos por que"
```

---

## 9. Fase 5: Standup Automatico

### Objetivo

La IA genera standups automaticos basados en lo que ya sabe de los chats privados. El miembro solo confirma o corrige. No tiene que rellenar un formulario.

### Flujo funcional

```
Escenario A: Standup por chat (el miembro lo da directamente)
  Dev escribe: "Ayer termine PAY-127. Hoy empiezo PAY-125. Sin blockers."
  IA: extrae automaticamente y guarda StandupCheckin

Escenario B: Standup generado (la IA propone basandose en lo que sabe)
  IA: "Buenos dias Luis. Basandome en lo que hablamos ayer,
       tu standup de hoy seria:

       Ayer: Terminaste PAY-127 (documentar API)
       Hoy: Empiezas PAY-125 (refactor API pagos)
       Blockers: Ninguno

       ¿Es correcto o quieres cambiar algo?"
  Luis: "Si, correcto"
  IA: Guarda StandupCheckin con source: "ai_extracted"

Escenario C: Standup agregado (resumen del equipo)
  Lead o la IA (al final del dia/manana siguiente):
  Genera DailyReport con el resumen de todos los standups.
```

### Generacion del resumen diario

```
STANDUP - Sprint 14 - 2026-04-01
Proyecto: Payment Module

RESUMEN EJECUTIVO:
- 5 de 5 miembros reportaron
- 2 tickets completados ayer
- 1 blocker activo (Carlos - permisos pasarela)
- Velocidad sprint: 24/42 pts completados (57%)

POR MIEMBRO:
┌──────────┬────────────────────────────┬─────────────────────────┬──────────────┐
│ Miembro  │ Ayer                       │ Hoy                     │ Blockers     │
├──────────┼────────────────────────────┼─────────────────────────┼──────────────┤
│ Ana      │ Reviso PR de Luis (PAY-127)│ Empieza PAY-123 (login) │ Ninguno      │
│ Carlos   │ Sigue con PAY-124 (dia 4) │ PAY-124                 │ Permisos     │
│          │                            │                         │ pasarela (3d)│
│ Luis     │ Cerro PAY-127              │ Empieza PAY-125         │ Ninguno      │
│ Maria    │ Reviso propuestas          │ Priorizar backlog       │ Ninguno      │
│ Pedro    │ Tests PAY-110              │ Tests PAY-111           │ Ninguno      │
└──────────┴────────────────────────────┴─────────────────────────┴──────────────┘

ALERTAS:
⚠️ Carlos lleva 4 dias con PAY-124. Blocker: permisos en pasarela de pagos.
   Recomendacion: escalar con el proveedor o buscar alternativa.
⚠️ PAY-123 empieza hoy pero aun no tiene estimacion.

DEPENDENCIAS DETECTADAS:
- PAY-125 (Luis) podria afectar a PAY-124 (Carlos) - ambos tocan /api/payments
```

### Tareas de implementacion - Fase 5

| # | Tarea | Descripcion |
|---|-------|-------------|
| 5.1 | Extraccion de standup del chat | Detectar cuando el usuario da un update tipo standup y guardarlo como StandupCheckin con source "chat_command" |
| 5.2 | Standup generado por IA | Funcion que analiza ultimos mensajes del miembro y propone standup para confirmar |
| 5.3 | Generacion de DailyReport | Endpoint que agrega todos los StandupCheckin del dia + datos de Jira y genera resumen markdown |
| 5.4 | Prompt de generacion de resumen | Prompt que recibe checkins + tickets + blockers y genera el resumen estructurado |
| 5.5 | Handler `/standup` en chat | Abrir dialogo de standup o aceptar standup inline |
| 5.6 | Handler `/standup-resumen` | Generar y mostrar resumen del equipo en el chat |
| 5.7 | Proactividad: pedir standup | Si son las 10am (configurable) y el miembro no ha dado standup, preguntarle |
| 5.8 | Vista Standup | UI que muestra el standup del dia con todos los miembros |

### Prompt para la tarea 5.2: Standup generado

```
Analiza los ultimos mensajes de este miembro (ultimas 24h) y
los cambios en sus tickets de Jira para generar un standup:

MENSAJES RECIENTES DEL MIEMBRO:
{mensajes}

TICKETS ASIGNADOS AL MIEMBRO (cambios ultimas 24h):
{ticket_changes}

Genera un standup con este formato exacto:
- yesterdayWork: que hizo ayer (resumido, max 2 frases)
- todayPlan: que hara hoy (resumido, max 2 frases)
- blockers: blockers activos (null si no hay)
- mood: inferido del tono de los mensajes (great/good/neutral/stressed/blocked)

NO inventes informacion. Si no hay datos suficientes para algún campo,
dejalo como null y pregunta al miembro.
```

### Prompt para la tarea 5.4: Resumen diario

```
Genera el resumen diario del equipo (standup report) con estos datos:

EQUIPO: {teamName}
PROYECTO: {projectName}
SPRINT: {sprintName} ({startDate} - {endDate})
FECHA: {today}

CHECKINS DE HOY:
{checkins_formatted}

TICKETS DEL SPRINT (estado actual):
{tickets_formatted}

BLOCKERS ACTIVOS:
{blockers}

VELOCITY SPRINT ACTUAL:
- Puntos completados: {completed_points} / {total_points}
- Dias restantes: {days_remaining}

Genera un resumen markdown con:
1. Resumen ejecutivo (3-4 bullets)
2. Tabla por miembro (ayer | hoy | blockers)
3. Alertas (tickets estancados, blockers >2 dias, dependencias)
4. Proyeccion: al ritmo actual, se completara el sprint?
   (calculo simple: pts_restantes / velocidad_diaria_media vs dias_restantes)
```

---

## 10. Fase 6: Deteccion Proactiva de Riesgos

### Objetivo

La IA detecta riesgos y problemas antes de que se conviertan en blockers reales. Cruza informacion de los chats, el estado de Jira, y los patrones del equipo.

### Tipos de riesgo detectables

| Tipo | Señal | Accion de la IA |
|------|-------|-----------------|
| **Ticket estancado** | Ticket en "In Progress" > N dias sin cambios | Preguntar al dev si hay problema |
| **Blocker no reportado** | Dev menciona dificultad pero no crea blocker | Sugerir crear blocker formal |
| **Dependencia cruzada** | Dos devs trabajan en la misma area / uno espera al otro | Alertar a ambos y al lead |
| **Scope creep** | AC de un ticket crecen mucho vs estimacion | Sugerir partir el ticket |
| **Sprint overload** | Puntos comprometidos > capacidad historica | Alertar al lead |
| **Miembro sobrecargado** | Dev tiene > X tickets asignados o muchos de alta prioridad | Sugerir redistribuir |
| **Miembro inactivo** | Sin mensajes ni updates en > 2 dias | Preguntar discretamente |
| **Estimacion faltante** | Ticket in sprint sin estimacion | Sugerir estimar |
| **Deadline risk** | Puntos restantes / velocidad media > dias restantes | Alertar con proyeccion |

### Flujo funcional

```
1. DETECCION (automatica, al construir contexto del chat)
   Antes de cada respuesta, el backend ejecuta checks:
   - Tickets de Jira estancados (>3 dias en In Progress)
   - Blockers activos sin resolver (>2 dias)
   - Dependencias inferidas de los chats
   - Velocity vs puntos restantes

2. ALERTA (en el chat del lead)
   La IA incluye alertas relevantes en su respuesta:
   "⚠️ He detectado 2 riesgos en el sprint:
   - Carlos lleva 4 dias con PAY-124 sin avanzar
   - PAY-125 y PAY-124 tocan el mismo endpoint
   ¿Quieres que pregunte a Carlos?"

3. ACCION (con confirmacion)
   Lead: "Si, preguntale"
   IA → Carlos: "Oye Carlos, llevas unos dias con PAY-124.
   ¿Todo bien o hay algo que te bloquea?"
```

### Tareas de implementacion - Fase 6

| # | Tarea | Descripcion |
|---|-------|-------------|
| 6.1 | Funcion de deteccion de tickets estancados | Query sobre TicketCache: status = "In Progress" AND lastSyncedAt - updatedAt > 3 dias |
| 6.2 | Funcion de deteccion de blockers viejos | Knowledge entries de categoria "blocker" con > 2 dias sin resolucion |
| 6.3 | Funcion de proyeccion de sprint | Calcular: pts_restantes / (pts_completados / dias_transcurridos) > dias_restantes? |
| 6.4 | Inyeccion de alertas en prompt | Anadir bloque ALERTAS al contexto del chat para leads |
| 6.5 | Accion de preguntar a miembro | Cuando el lead confirma, la IA incluye la pregunta en el proximo chat del dev |

### Prompt inyectado para leads (bloque de alertas)

```
ALERTAS DE RIESGO (generadas automaticamente):

🔴 CRITICO:
- PAY-124 (Carlos): 4 dias en "In Progress" sin cambios.
  Carlos menciono ayer "problemas con permisos" pero no creo blocker formal.

🟡 ATENCION:
- Sprint velocity: 24/42 pts completados, quedan 3 dias.
  Al ritmo actual se completarian ~30 pts (deficit de ~12 pts).
- PAY-123 esta en "To Do" y Ana empieza hoy, pero no tiene estimacion.
- PAY-125 (Luis) y PAY-124 (Carlos) modifican ambos /api/payments.
  Posible conflicto al mergear.

🟢 INFO:
- Luis lleva 2 tickets cerrados esta semana, por encima de su media.
  Podria tomar mas carga si hay redistribucion.

Si el lead pregunta por el estado del sprint o por riesgos, usa esta
informacion. Si no pregunta pero hay alertas criticas (🔴), mencionalo
proactivamente al inicio de tu respuesta.
```

---

## 11. Fase 7: Retrospectiva Asincrona

### Objetivo

Al final de cada sprint, la IA recoge feedback de cada miembro en privado, lo anonimiza, genera un resumen con temas recurrentes, y propone acuerdos de mejora. El lead cierra la retro y los acuerdos se guardan en el knowledge base.

### Flujo funcional

```
Fase A: Apertura (lead)
  Lead: "/retro" o la IA sugiere al final del sprint
  Se crea Retrospective con status "collecting"
  La IA pregunta a cada miembro en su chat

Fase B: Recoleccion (cada miembro, privado)
  IA: "El sprint 14 ha terminado. Me gustaria tu feedback:
       1. ¿Que fue bien?
       2. ¿Que fue mal o podria mejorar?
       3. ¿Que cambiarias para el proximo sprint?
       Tu feedback es anonimo."
  Dev responde, la IA guarda RetroFeedback

Fase C: Sintesis (la IA)
  Cuando todos han respondido (o timeout de 48h):
  La IA analiza todos los feedbacks anonimizados
  Genera resumen con temas recurrentes
  Propone acuerdos de mejora

Fase D: Cierre (lead)
  Lead revisa resumen y acuerdos propuestos
  Aprueba acuerdos → se guardan en KnowledgeEntry
  Retrospective.status = "closed"
```

### Ejemplo completo

```
--- Chat de Ana (lead) ---

Ana: /retro

IA: Abro retrospectiva del Sprint 14 (2026-03-18 al 2026-04-01).

    Datos del sprint:
    - Velocity: 34/42 pts (81%)
    - Tickets completados: 8 de 11
    - Blockers: 2 (1 resuelto, 1 abierto)
    - Media de mood del equipo: 3.2/5 (neutral-bueno)

    Voy a pedir feedback a: Ana, Carlos, Luis, Maria, Pedro
    El feedback sera anonimo.

    Empiezo contigo. ¿Que fue bien en este sprint?

Ana: El refinamiento asincrono funciono genial.
     Mucho mejor que las reuniones de antes.

IA: ¿Que fue mal o podria mejorar?

Ana: Carlos estuvo bloqueado demasiado tiempo con lo de la pasarela.
     Tendriamos que haber escalado antes.

IA: ¿Que cambiarias para el proximo sprint?

Ana: Escalar blockers automaticamente si llevan >2 dias.

IA: Feedback registrado ✓ (anonimo).
    Pregunto al resto del equipo.

--- Chat de Carlos (anonimo) ---

IA: El sprint 14 ha terminado. Retrospectiva abierta.
    Tu feedback es completamente anonimo.

    ¿Que fue bien?

Carlos: Las estimaciones estuvieron bastante acertadas.

IA: ¿Que fue mal?

Carlos: Me quede solo con el problema de la pasarela.
        Deberia haber pedido ayuda antes, pero tampoco
        sabia a quien preguntar exactamente.

IA: ¿Que cambiarias?

Carlos: Tener un canal o forma de pedir ayuda tecnica
        rapido sin tener que buscar quien sabe de que.

--- (despues de recoger feedback de todos) ---
--- Chat de Ana ---

IA: Retrospectiva del Sprint 14 - Todos han respondido.

    📊 RESUMEN (anonimizado):

    ✅ QUE FUE BIEN (temas recurrentes):
    - Refinamiento asincrono (mencionado por 4/5 miembros)
    - Estimaciones acertadas (mencionado por 3/5)
    - Buena comunicacion general

    ❌ QUE FUE MAL:
    - Blocker de la pasarela tardo demasiado en escalarse (3/5)
    - Falta un canal claro para pedir ayuda tecnica (2/5)
    - Un miembro reporto sentirse aislado trabajando en solitario

    💡 ACUERDOS PROPUESTOS:
    1. Escalar blockers automaticamente si llevan >2 dias sin resolucion
    2. Crear un mecanismo de "pedir ayuda" donde la IA conecte al dev
       con quien pueda ayudar (basandose en skills y experiencia)
    3. La IA hara check-in diario con miembros que trabajen solos
       en un ticket >2 dias

    ¿Apruebas estos acuerdos? Puedes editar o rechazar individualmente.

Ana: Apruebo los 3.

IA: ✅ Acuerdos guardados en la base de conocimiento del equipo.
    Retrospectiva cerrada.

    Los aplicare en el proximo sprint:
    - Alertare cuando un blocker lleve >2 dias
    - Ofrecere conectar devs cuando alguien pida ayuda
    - Hare check-in con miembros en tickets solitarios
```

### Tareas de implementacion - Fase 7

| # | Tarea | Descripcion |
|---|-------|-------------|
| 7.1 | Modelos Retrospective + RetroFeedback | Crear en Prisma |
| 7.2 | CRUD API retrospectiva | Crear, listar, obtener por equipo |
| 7.3 | Endpoint feedback | POST /api/retro/:id/feedback con datos anonimos |
| 7.4 | Handler `/retro` en chat | Crear Retrospective, iniciar recoleccion |
| 7.5 | Prompt de recoleccion | Preguntar que fue bien, mal, que cambiaria |
| 7.6 | Prompt de sintesis | Analizar feedbacks anonimizados, detectar temas recurrentes |
| 7.7 | Generacion de acuerdos | Proponer acuerdos basados en el feedback |
| 7.8 | Cierre y guardado en knowledge | Guardar acuerdos aprobados como KnowledgeEntry |

### Prompt para la tarea 7.6: Sintesis de retrospectiva

```
Analiza los siguientes feedbacks anonimos de la retrospectiva del
{sprintName} y genera un resumen:

FEEDBACKS (anonimos):
{feedbacks_formatted}

DATOS DEL SPRINT:
- Velocity: {completed}/{total} pts ({percentage}%)
- Tickets: {completed_tickets}/{total_tickets}
- Blockers: {blocker_count}
- Mood medio: {avg_mood}/5

Genera:
1. TEMAS RECURRENTES - que se repite en multiples feedbacks (con cuenta X/N)
2. QUE FUE BIEN - agrupado por tema, anonimo
3. QUE FUE MAL - agrupado por tema, anonimo
4. ACUERDOS PROPUESTOS - 2-4 acuerdos concretos y accionables basados en
   el feedback. Cada acuerdo debe ser:
   - Especifico (no "mejorar comunicacion" sino "hacer X cuando pase Y")
   - Medible (como sabemos si se cumple)
   - Dentro del control del equipo (no "que el cliente responda mas rapido")

IMPORTANTE:
- NUNCA reveles quien dijo que, ni directa ni indirectamente
- No incluyas detalles que identifiquen al autor (ej: "el que trabaja en
  el ticket X" puede identificar a alguien)
- Agrupa por temas, no por personas
```

---

## 12. Fase 8: Resumen para Stakeholders

### Objetivo

Generar resumenes periodicos (semanal/por sprint) para PMs, directores o stakeholders que no participan en el dia a dia. Sin jerga tecnica, enfocado en progreso, riesgos y decisiones.

### Flujo funcional

```
1. Trigger: manual (lead pide resumen) o automatico (fin de sprint/semana)
2. La IA agrega: standups, velocity, tickets, decisiones, blockers
3. Genera resumen en formato ejecutivo
4. Lead revisa y aprueba antes de compartir
```

### Formato del resumen semanal

```
📊 RESUMEN SEMANAL - Payment Module
Semana del 25 al 31 de marzo 2026 | Sprint 14 (semana 2/2)

PROGRESO:
- 8 de 11 tickets completados (73%)
- 34 de 42 story points cerrados (81%)
- Sprint goal: "Completar integracion de pagos" → EN RIESGO (3 tickets pendientes)

COMPLETADO ESTA SEMANA:
- ✅ PAY-127: Documentacion del API (Luis)
- ✅ PAY-110: Tests unitarios modulo de cobros (Pedro)
- ✅ PAY-111: Tests de integracion checkout (Pedro)
- ✅ PAY-108: Integracion Stripe completada (Ana)

EN PROGRESO:
- 🔄 PAY-124: Fix bug checkout (Carlos) - BLOQUEADO 4 dias
- 🔄 PAY-125: Refactor API pagos (Luis) - 60% estimado
- 🔄 PAY-123: Mejorar login (Ana) - empieza esta semana

RIESGOS:
- ⚠️ PAY-124 lleva 4 dias bloqueado por permisos de la pasarela.
  Impacto: si no se resuelve, el fix de checkout no entra en el sprint.
- ⚠️ 3 tickets pendientes con 3 dias restantes de sprint.
  Podria requerirse extension o mover tickets al sprint 15.

DECISIONES TOMADAS ESTA SEMANA:
- Migrar a PostgreSQL (aprobado por el equipo)
- Rate limiting en login: 5 intentos, bloqueo 15 min
- Vincular/desvincular OAuth desde perfil de usuario

PROXIMO SPRINT (preview):
- 5 tickets refinados y estimados (38 pts)
- Capacidad historica del equipo: 35 pts/sprint
- Recomendacion: ajustar scope o priorizar
```

### Tareas de implementacion - Fase 8

| # | Tarea | Descripcion |
|---|-------|-------------|
| 8.1 | Endpoint generar resumen | `POST /api/reports/weekly` que agrega datos y genera markdown |
| 8.2 | Prompt de resumen ejecutivo | Prompt que genera el resumen en formato stakeholder |
| 8.3 | Vista Reports | UI simple que muestra reportes generados con opcion de regenerar |
| 8.4 | Comando `/resumen-semanal` | En chat del lead, genera y muestra el resumen |

### Prompt para la tarea 8.2

```
Genera un resumen semanal ejecutivo para stakeholders (no tecnicos)
con estos datos:

EQUIPO: {team}
PROYECTO: {project}
SPRINT: {sprint} (semana {week_number}/{total_weeks})
PERIODO: {start_date} - {end_date}

TICKETS COMPLETADOS ESTA SEMANA:
{completed_tickets}

TICKETS EN PROGRESO:
{in_progress_tickets}

BLOCKERS ACTIVOS:
{blockers}

STANDUPS DE LA SEMANA (resumen):
{standup_summaries}

DECISIONES TOMADAS:
{knowledge_entries_this_week}

VELOCITY:
- Sprint actual: {current_velocity}/{sprint_total} pts
- Media historica: {historical_avg} pts/sprint
- Dias restantes: {days_remaining}

Genera un resumen:
- Lenguaje claro, sin jerga tecnica
- Enfocado en progreso, riesgos y decisiones
- Maximo 1 pagina
- Incluir recomendaciones si hay riesgos
- Formato: progreso > completado > en progreso > riesgos > decisiones > preview proximo sprint
```

---

## 13. Fase 9: Onboarding Contextual

### Objetivo

Cuando un nuevo miembro se une al equipo, la IA le pone al dia automaticamente con el contexto del proyecto: decisiones vigentes, sprint actual, quien hace que, y normas del equipo.

### Flujo funcional

```
1. Nuevo miembro se registra y se le anade al proyecto
2. La IA detecta que es nuevo (sin mensajes previos en ese proyecto)
3. En el primer mensaje, genera contexto de bienvenida
```

### Mensaje de bienvenida generado

```
IA: ¡Bienvenido al equipo Payment, Pedro! Soy tu Scrum Master IA.
    Te pongo al dia:

    📋 SOBRE EL PROYECTO:
    Payment Module - Integracion de sistema de pagos con Stripe.
    Stack: Node.js + Express + PostgreSQL
    Repo: github.com/empresa/payment-api
    Jira: PAY (empresa.atlassian.net)

    👥 TU EQUIPO:
    - Ana Garcia (Tech Lead) - lleva la arquitectura
    - Carlos Lopez (Developer) - frontend y checkout
    - Luis Martinez (Developer) - backend y API
    - Maria Ruiz (Product Manager) - prioridades y stakeholders

    📌 DECISIONES VIGENTES:
    - Stack: Node.js + Express + PostgreSQL
    - PRs requieren 2 approvals
    - Deploys solo martes y jueves
    - API: REST con kebab-case
    - Tests: cobertura minima 80%

    🏃 SPRINT ACTUAL (Sprint 14, termina en 3 dias):
    - Goal: Completar integracion de pagos
    - 8/11 tickets completados
    - Blocker activo: permisos pasarela (Carlos)

    📐 GUIA DE ESTIMACION:
    [story point guide del equipo]

    ¿Sobre que quieres saber mas? Puedo explicarte cualquier
    decision, mostrarte el backlog, o ayudarte con tu primer ticket.
```

### Tareas de implementacion - Fase 9

| # | Tarea | Descripcion |
|---|-------|-------------|
| 9.1 | Deteccion de miembro nuevo | Verificar si el miembro tiene mensajes previos en el proyecto |
| 9.2 | Prompt de onboarding | Construir contexto completo del proyecto para el nuevo miembro |
| 9.3 | Inyeccion automatica | Si es primer mensaje, anteponer el contexto de bienvenida |

### Prompt para la tarea 9.2

```
Este miembro ({memberName}) es NUEVO en el proyecto {projectName}.
Es su primer mensaje. Dale la bienvenida y ponle al dia con:

1. SOBRE EL PROYECTO: descripcion, stack, repos, integraciones
2. EL EQUIPO: miembros, roles, quien hace que
3. DECISIONES VIGENTES: del knowledge base (las mas importantes)
4. SPRINT ACTUAL: goal, progreso, tickets asignados al nuevo miembro (si los hay)
5. GUIA DE ESTIMACION: story point guide del equipo

Se conciso pero completo. El objetivo es que el nuevo miembro
pueda empezar a contribuir lo antes posible sin necesitar que
alguien le explique todo manualmente.

Tras la bienvenida, pregunta si tiene dudas o quiere profundizar
en algo especifico.
```

---

## 14. Fase 10: Dependency Mapping

### Objetivo

La IA detecta dependencias entre tickets y entre miembros, y alerta proactivamente para evitar que se conviertan en blockers.

### Tipos de dependencias detectables

| Tipo | Como se detecta | Ejemplo |
|------|----------------|---------|
| **Ticket-ticket** | Mencion en chat o en AC de un ticket | "PAY-125 necesita que PAY-123 este hecho primero" |
| **Miembro-miembro** | Un dev menciona que espera algo de otro | "Necesito el endpoint de Luis para avanzar" |
| **Area de codigo** | Dos tickets tocan la misma ruta/modulo | PAY-124 y PAY-125 ambos modifican /api/payments |
| **Temporal** | Deadline o dependencia de fecha | "Esto tiene que estar antes del deploy del jueves" |

### Flujo funcional

```
1. DETECCION (automatica)
   Al analizar cada mensaje, la IA detecta menciones de dependencias.
   Al analizar tickets del TicketCache, detecta areas solapadas.

2. REGISTRO
   La IA guarda dependencias detectadas como KnowledgeEntry
   con category "dependency" (o en metadata del mensaje).

3. ALERTA
   Cuando detecta un conflicto potencial:
   IA → Dev A: "Tu ticket PAY-125 toca /api/payments. Carlos
   tambien esta modificando ese modulo en PAY-124.
   Os recomiendo coordinar para evitar conflictos al mergear."

   IA → Dev B: (mismo aviso)

4. SEGUIMIENTO
   La IA recuerda dependencias y hace follow-up:
   "Luis, ayer dijiste que necesitabas el endpoint de Ana.
   Ana ya lo termino (PAY-108 esta Done). ¿Puedes avanzar?"
```

### Tareas de implementacion - Fase 10

| # | Tarea | Descripcion |
|---|-------|-------------|
| 10.1 | Deteccion de dependencias en chat | En el prompt, pedir a la IA que identifique dependencias mencionadas |
| 10.2 | Deteccion de solapamiento en Jira | Comparar campos de tickets (componentes, labels, descripcion) para detectar areas comunes |
| 10.3 | Registro como knowledge entry | Guardar dependencias detectadas con categoria "dependency" |
| 10.4 | Alerta proactiva | Inyectar dependencias relevantes en el prompt de cada dev |
| 10.5 | Follow-up automatico | Cuando una dependencia se resuelve (ticket cambia a Done), notificar al dev que esperaba |

### Prompt para deteccion de dependencias (inyectado en cada mensaje)

```
DETECCION DE DEPENDENCIAS:
Al analizar la conversacion, detecta y reporta si el usuario
menciona cualquiera de estos patrones:
- "Necesito X de [otro miembro]" → dependencia miembro-miembro
- "Esto depende de [ticket]" → dependencia ticket-ticket
- "Cuando [otro] termine X" → dependencia temporal
- "No puedo avanzar hasta que" → blocker por dependencia

Si detectas una dependencia, incluyela en tu respuesta:
"He detectado una dependencia: [descripcion].
La registro para hacer seguimiento y avisar a [miembro]
cuando sea relevante."

Formato JSON (al final del mensaje):
```json
{
  "dependency_detected": {
    "type": "member_to_member" | "ticket_to_ticket" | "code_area",
    "from": "PAY-125 / Luis",
    "to": "PAY-123 / Ana",
    "description": "Luis necesita el endpoint de pagos de Ana",
    "urgency": "medium"
  }
}
```
```

---

## 15. Mapa de Vistas UI

### Vistas principales

| Vista | Proposito | Prioridad | Quien la ve |
|-------|-----------|-----------|-------------|
| **chat** | Chat 1:1 con la IA. Core de la app. | P0 | Todos |
| **proposals** | Cola de propuestas de tickets pendientes de aprobacion | P0 | Solo leads (`canApproveTickets`) para aprobar; todos para ver estado de sus propuestas |
| **standup** | Resumen diario del equipo generado por la IA | P0 | Todos |
| **jira-board** | Vista de lectura de tickets del sprint actual desde Jira | P1 | Todos |
| **knowledge** | Decisiones, acuerdos y contexto del equipo | P1 | Todos |
| **teams** | Gestion de equipos y miembros | P2 | Leads |
| **projects** | Configuracion de proyectos, conexion Jira/Linear, importacion | P2 | Leads |
| **settings** | Ajustes: story point guide, sprint length, integraciones | P2 | Leads |
| **profile** | Perfil del usuario, avatar, notificaciones | P3 | Todos |

### Vistas ELIMINADAS respecto a la app actual

| Vista eliminada | Razon | Reemplazo |
|----------------|-------|-----------|
| `dashboard` | No aporta valor, datos mock | El chat es el punto de entrada |
| `kanban` | Duplica Jira. Los tickets estan en Jira | `jira-board` (solo lectura) |
| `tickets` | Gestion de tickets es de Jira | `jira-board` + `proposals` |
| `reports` | Reportes manuales sin valor | `standup` automatico + `/resumen-semanal` |

### Wireframe funcional del chat (vista principal)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │                    CHAT                            │
│            │                                                     │
│  💬 Chat   │  Proyecto: [Payment Module ▼]                       │
│  📋 Prop.  │                                                     │
│  📊 Stand. │  ┌─ Indicadores ────────────────────────────────┐  │
│  📌 Board  │  │ 🔔 2 estimaciones pendientes                 │  │
│  📚 Knowl. │  │ 📋 1 propuesta en revision                   │  │
│  👥 Teams  │  │ ⚠️ 1 alerta de riesgo                        │  │
│  ⚙️ Sett.  │  └──────────────────────────────────────────────┘  │
│            │                                                     │
│            │  ┌─ Mensajes ───────────────────────────────────┐  │
│            │  │ 🤖 IA: Buenos dias Ana. Tienes 2 tickets     │  │
│            │  │    sin refinar y una estimacion pendiente...  │  │
│            │  │                                               │  │
│            │  │ 👤 Ana: /refinar PAY-123                     │  │
│            │  │                                               │  │
│            │  │ 🤖 IA: PAY-123 "Mejorar login"              │  │
│            │  │    Descripcion actual: "Mejorar el sistema    │  │
│            │  │    de login." Algunas preguntas:              │  │
│            │  │    1. Proveedores OAuth?                      │  │
│            │  │    2. 2FA?                                    │  │
│            │  │                                               │  │
│            │  │ 👤 Ana: Google OAuth + 2FA con authenticator  │  │
│            │  │                                               │  │
│            │  │ 🤖 IA: Propongo estos AC:                    │  │
│            │  │    - [ ] Login con Google OAuth 2.0           │  │
│            │  │    - [ ] 2FA opcional con TOTP                │  │
│            │  │    ...                                        │  │
│            │  │    [✓ Aprobar AC] [✏️ Editar] [❌ Rechazar]    │  │
│            │  └──────────────────────────────────────────────┘  │
│            │                                                     │
│            │  ┌─ Quick Actions ──────────────────────────────┐  │
│            │  │ /standup /refinar /proponer /estimar          │  │
│            │  │ /mis-tickets /blockers /decisiones            │  │
│            │  └──────────────────────────────────────────────┘  │
│            │                                                     │
│            │  ┌─────────────────────────────────┐ [Enviar]      │
│            │  │ Escribe tu mensaje...            │               │
│            │  └─────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Apendice A: Guia de Story Points por defecto {#apendice-a}

Esta es la guia que se usa si el equipo no define la suya propia en settings:

```markdown
## Guia de Story Points

Los story points miden COMPLEJIDAD y ESFUERZO, no tiempo.
Usa la secuencia Fibonacci: 1, 2, 3, 5, 8, 13, 21

| SP | Complejidad | Incertidumbre | Ejemplo tipico |
|----|-------------|---------------|----------------|
| 1  | Trivial. Sabes exactamente que hacer y como. | Ninguna | Fix typo, cambiar copy, ajustar color |
| 2  | Simple. Un cambio pequeno y localizado. | Minima | Anadir validacion, nuevo campo en form |
| 3  | Moderado. Requiere algo de pensamiento. | Baja | Feature pequena end-to-end con tests |
| 5  | Significativo. Varias partes del sistema. | Media | Integracion con servicio externo, nuevo modulo |
| 8  | Complejo. Multiples componentes, edge cases. | Alta | Feature grande, refactor de modulo existente |
| 13 | Muy complejo. Deberia partirse. | Muy alta | Epic disfrazado de ticket. Partir antes de empezar |
| 21 | Demasiado grande. NO estimar. | Maxima | Partir obligatoriamente en tickets menores |

### Reglas:
- Si dudas entre 2 valores, elige el mayor
- "?" es valido: significa "necesito mas info para estimar"
- Si un ticket es 13+, proponer partirlo antes de estimar
- La estimacion la hace el equipo, no el PM ni el lead
- Comparar siempre con tickets ya completados del equipo
```

---

## Apendice B: Secuencia de migracion desde la app actual {#apendice-b}

### Paso 1: Schema (semana 1)

1. Anadir modelos nuevos: `TicketCache`, `TicketProposal`, `EstimationSession`, `EstimationVote`, `Retrospective`, `RetroFeedback`
2. Anadir `canApproveTickets` a `TeamMember`
3. Anadir `sprintLengthDays` a `Team`
4. Anadir campos nuevos a `Project` (Linear, jiraUserEmail)
5. Anadir `source` y `projectId` a `StandupCheckin`
6. Anadir `projectId` a `DailyReport`
7. Anadir `expiresAt` a `KnowledgeEntry`
8. Run `bun run db:push`
9. NO eliminar modelos viejos aun (Ticket, TicketWorkflow, etc.)

### Paso 2: Chat core refactor (semana 2-3)

1. Reescribir system prompt con estructura de 7 bloques
2. Implementar build de contexto cross-member
3. Implementar parseo de acciones JSON (ticket_proposal, knowledge_entry, ticket_update, standup_checkin)
4. Eliminar logica de tickets internos (INTERNAL_TICKET_ACTION, fallbacks, etc.)
5. Implementar quick actions nuevos
6. Tests manuales exhaustivos del chat

### Paso 3: Adapter layer + sync (semana 3-4)

1. Implementar `src/lib/ticket-source.ts` con interfaz comun
2. Adapter Manual (siempre disponible): CRUD local sobre TicketCache
3. Adapter Jira: sync sprint, detalle, update, create, comment
4. Adapter Linear: sync cycle, detalle, update, create, comment
5. Adapter GitHub Issues: sync open issues, create, comment
6. Importacion CSV/XML/JSON (carga directa en TicketCache)
7. Importacion desde chat (la IA parsea listas de tickets pegadas)

### Paso 4: Propuestas y estimacion (semana 4-5)

1. CRUD de TicketProposal
2. Flujo de aprobacion/rechazo
3. Vista Proposals
4. EstimationSession + EstimationVote
5. Flujo de votacion asincrona en chat
6. Logica de consenso y nueva ronda

### Paso 5: Standup y vistas (semana 5-6)

1. Standup automatico desde chat
2. Generacion de DailyReport
3. Vista Standup refactorizada
4. Vista jira-board (lectura de TicketCache)

### Paso 6: Riesgos, retro, reports (semana 6-8)

1. Deteccion de riesgos
2. Retrospectiva asincrona
3. Resumen semanal para stakeholders
4. Onboarding contextual
5. Dependency mapping

### Paso 7: Limpieza (semana 8)

1. Eliminar modelos viejos: Ticket, TicketWorkflow, TicketTransition, TicketMessage
2. Eliminar vistas: dashboard, kanban, tickets
3. Eliminar codigo de tickets internos en api.ts, types, etc.
4. Eliminar Socket.io mini-services (si no se usan)
5. Limpiar imports y dependencias no usadas

---

## Resumen de modelos y endpoints por fase

### Modelos totales (post-migracion)

| Modelo | Fase | Tipo |
|--------|------|------|
| User | existente | auth |
| Team | existente (mod) | config |
| TeamMember | existente (mod) | config |
| Project | existente (mod) | config |
| ProjectAssignment | existente | config |
| Message | existente | core (chat) |
| KnowledgeEntry | existente (mod) | core |
| DailyReport | existente (mod) | standup |
| StandupCheckin | existente (mod) | standup |
| IntegrationLog | existente | audit |
| TicketCache | **nuevo** (F2) | tracker sync / manual |
| TicketProposal | **nuevo** (F3) | propuestas |
| EstimationSession | **nuevo** (F4) | estimacion |
| EstimationVote | **nuevo** (F4) | estimacion |
| Retrospective | **nuevo** (F7) | retro |
| RetroFeedback | **nuevo** (F7) | retro |

### Endpoints totales por fase

| Fase | Endpoints nuevos |
|------|-----------------|
| F1 (Chat) | Refactor de `POST /api/chat` |
| F2 (Tracker sync) | `GET /api/tickets/sync`, `GET/PUT /api/tickets/cache/:key`, `POST /api/tickets/cache/:key/comment`, `POST /api/import/tickets` |
| F3 (Propuestas) | `GET/POST /api/proposals`, `PUT /api/proposals/:id`, `POST /api/proposals/:id/approve`, `POST /api/proposals/:id/reject` |
| F4 (Estimacion) | `POST /api/estimations`, `GET /api/estimations`, `POST /api/estimations/:id/vote`, `POST /api/estimations/:id/close`, `POST /api/estimations/:id/sync` |
| F5 (Standup) | Refactor de `POST /api/standup`, `POST /api/reports/daily` |
| F7 (Retro) | `POST /api/retro`, `GET /api/retro`, `POST /api/retro/:id/feedback`, `POST /api/retro/:id/close` |
| F8 (Reports) | `POST /api/reports/weekly` |
