// ============================================================
// Dayless.ai - TypeScript Types
// Mirrors the Prisma schema at prisma/schema.prisma
// ============================================================

// --------------- View Types ---------------

export type AppView =
  | "dashboard"
  | "chat"
  | "tickets"
  | "kanban"
  | "profile"
  | "teams"
  | "projects"
  | "knowledge"
  | "reports"
  | "standup"
  | "settings";

// --------------- Prisma Model Types ---------------

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  memberships?: TeamMember[];
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  /** Guía de story points (markdown) definida en Ajustes del equipo. */
  storyPointGuide?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: TeamMember[];
  projects?: Project[];
  messages?: Message[];
  knowledge?: KnowledgeEntry[];
  reports?: DailyReport[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId?: string | null;
  defaultProjectId?: string | null;
  name: string;
  role: string;
  email: string | null;
  avatar: string | null;
  status: "active" | "away" | "offline";
  createdAt: string;
  updatedAt: string;
  team?: Team;
  standups?: StandupCheckin[];
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  status: "active" | "paused" | "completed";
  jiraProjectKey: string | null;
  jiraBaseUrl: string | null;
  jiraToken: string | null;
  githubRepo: string | null;
  githubToken: string | null;
  createdAt: string;
  updatedAt: string;
  team?: Team;
  workflows?: TicketWorkflow[];
  tickets?: Ticket[];
}

export interface TicketWorkflow {
  id: string;
  projectId: string;
  name: string;
  position: number;
  color: string;
  isDone: boolean;
  isQa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  teamId: string;
  targetTeamId: string | null;
  projectId: string;
  statusId: string;
  title: string;
  description: string | null;
  priority: string;
  estimate: string | null;
  progress: string | null;
  order: number;
  externalRefs: string | null;
  metadata: string | null;
  assigneeMemberId: string | null;
  reporterMemberId: string | null;
  /** member | ai | system */
  createdByType: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  status?: TicketWorkflow;
  targetTeam?: Team | null;
  assignee?: TeamMember | null;
  reporter?: TeamMember | null;
  project?: { id: string; name: string };
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string | null;
  senderName: string;
  senderType: "member" | "ai" | "system";
  content: string;
  metadata: string | null;
  createdAt: string;
}

export interface TicketTransition {
  id: string;
  ticketId: string;
  fromStatusId: string | null;
  toStatusId: string;
  reason: string | null;
  actorType: string;
  actorName: string | null;
  createdAt: string;
  fromStatus?: TicketWorkflow | null;
  toStatus?: TicketWorkflow;
}

export interface Message {
  id: string;
  teamId: string;
  ownerMemberId: string;
  projectId: string;
  senderId: string | null;
  senderName: string;
  senderType: "member" | "ai" | "system";
  content: string;
  metadata: string | null;
  createdAt: string;
  team?: Team;
}

export interface KnowledgeEntry {
  id: string;
  teamId: string;
  key: string;
  value: string;
  source: string | null;
  category: "general" | "technical" | "process" | "blocker" | "decision";
  confidence: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  team?: Team;
}

export interface DailyReport {
  id: string;
  teamId: string;
  date: string;
  summary: string;
  status: "draft" | "published";
  createdAt: string;
  team?: Team;
}

export interface StandupCheckin {
  id: string;
  memberId: string;
  date: string;
  yesterdayWork: string | null;
  todayPlan: string | null;
  blockers: string | null;
  mood: "great" | "good" | "neutral" | "stressed" | "blocked";
  createdAt: string;
  member?: TeamMember;
}

export interface IntegrationLog {
  id: string;
  teamId: string;
  type: "jira" | "github";
  action: string;
  externalId: string | null;
  data: string | null;
  status: "success" | "error";
  createdAt: string;
}

// --------------- API Types ---------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/** Borrador listo para confirmar con botones en el chat (no se crea en BD hasta confirmar). */
export interface PendingInternalTicketConfirm {
  project?: string;
  title: string;
  description: string;
  priority: string;
  estimate?: string;
  assigneeEmail?: string;
  targetTeam?: string;
}

// --------------- Create / Update Input Types ---------------

export interface CreateTeamInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTeamInput {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  storyPointGuide?: string | null;
}

export interface CreateMemberInput {
  teamId: string;
  name: string;
  role?: string;
  email?: string;
  avatar?: string;
}

export interface UpdateMemberInput {
  id: string;
  name?: string;
  role?: string;
  email?: string;
  avatar?: string;
  status?: "active" | "away" | "offline";
}

export interface CreateProjectInput {
  teamId: string;
  name: string;
  description?: string;
  status?: "active" | "paused" | "completed";
  jiraProjectKey?: string;
  jiraBaseUrl?: string;
  jiraToken?: string;
  githubRepo?: string;
  githubToken?: string;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string;
  status?: "active" | "paused" | "completed";
  jiraProjectKey?: string;
  jiraBaseUrl?: string;
  jiraToken?: string;
  githubRepo?: string;
  githubToken?: string;
}

export interface CreateTicketInput {
  teamId: string;
  targetTeamId?: string;
  projectId: string;
  title: string;
  description?: string;
  statusId?: string;
  priority?: string;
  estimate?: string;
  progress?: string;
  assigneeMemberId?: string;
  reporterMemberId?: string;
  createdByType?: "member" | "ai" | "system";
  createdByName?: string | null;
  externalRefs?: unknown;
  metadata?: unknown;
}

export interface UpdateTicketInput {
  id: string;
  title?: string;
  description?: string;
  statusId?: string;
  priority?: string;
  estimate?: string;
  progress?: string;
  order?: number;
  targetTeamId?: string;
  assigneeMemberId?: string;
  reporterMemberId?: string;
  externalRefs?: unknown;
  metadata?: unknown;
  transitionReason?: string;
  actorType?: string;
  actorName?: string;
}

export interface SendMessageInput {
  teamId: string;
  ownerMemberId: string;
  projectId: string;
  senderId?: string;
  senderName: string;
  senderType?: "member" | "ai" | "system";
  content: string;
  metadata?: string;
}

export interface CreateKnowledgeInput {
  teamId: string;
  key: string;
  value: string;
  source?: string;
  category?: "general" | "technical" | "process" | "blocker" | "decision";
  confidence?: number;
  isVerified?: boolean;
}

export interface UpdateKnowledgeInput {
  id: string;
  key?: string;
  value?: string;
  source?: string;
  category?: "general" | "technical" | "process" | "blocker" | "decision";
  confidence?: number;
  isVerified?: boolean;
}

export interface SubmitStandupInput {
  memberId: string;
  date: string;
  yesterdayWork?: string;
  todayPlan?: string;
  blockers?: string;
  mood?: "great" | "good" | "neutral" | "stressed" | "blocked";
}

export interface GenerateReportInput {
  teamId: string;
  date: string;
}
