import type {
  ApiResponse,
  Team,
  TeamMember,
  Project,
  Ticket,
  TicketWorkflow,
  TicketMessage,
  TicketTransition,
  Message,
  KnowledgeEntry,
  DailyReport,
  StandupCheckin,
  CreateTeamInput,
  UpdateTeamInput,
  CreateMemberInput,
  UpdateMemberInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTicketInput,
  UpdateTicketInput,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  SubmitStandupInput,
  PendingInternalTicketConfirm,
} from "@/types";

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`/api/${endpoint}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    const json = await response.json();
    // API routes already return { success, data, error } — pass through directly
    if (!response.ok) {
      return { success: false, data: null, error: json.error || `Request failed` };
    }
    if (typeof json.success === 'boolean') {
      return json as ApiResponse<T>;
    }
    return { success: true, data: json as T, error: null };
  } catch (error) {
    return { success: false, data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// --- Teams ---
export const getTeams = () => apiFetch<Team[]>("teams");
export const getTeam = (id: string) => apiFetch<Team & { members?: TeamMember[] }>(`teams/${encodeURIComponent(id)}`);
export const createTeam = (input: CreateTeamInput) => apiFetch<Team>("teams", { method: "POST", body: JSON.stringify(input) });
export const updateTeam = (input: UpdateTeamInput) => apiFetch<Team>(`teams/${encodeURIComponent(input.id)}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteTeam = (id: string) => apiFetch<null>(`teams/${encodeURIComponent(id)}`, { method: "DELETE" });

// --- Members ---
export const getMembers = (teamId?: string) => {
  const params = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetch<TeamMember[]>(`members${params}`);
};
export const createMember = (input: CreateMemberInput) => apiFetch<TeamMember>("members", { method: "POST", body: JSON.stringify(input) });
export const updateMember = (input: UpdateMemberInput) => apiFetch<TeamMember>(`members/${encodeURIComponent(input.id)}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteMember = (id: string) => apiFetch<null>(`members/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getMemberProjects = (memberOrUserId: string) =>
  apiFetch<{
    member: { id: string; name: string; role: string; email: string | null; teamId: string; defaultProjectId: string | null };
    defaultProject: {
      id: string;
      name: string;
      description: string | null;
      status: string;
      teamId: string;
      githubRepo: string | null;
      jiraProjectKey: string | null;
      teamName: string;
    } | null;
    projects: Array<{
      id: string;
      name: string;
      description: string | null;
      status: string;
      teamId: string;
      githubRepo: string | null;
      jiraProjectKey: string | null;
      teamName: string;
    }>;
  }>(`members/${encodeURIComponent(memberOrUserId)}/projects`);

// --- Projects ---
export const getProjects = (teamId?: string) => {
  const params = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetch<Project[]>(`projects${params}`);
};
export const createProject = (input: CreateProjectInput) => apiFetch<Project>("projects", { method: "POST", body: JSON.stringify(input) });
export const updateProject = (input: UpdateProjectInput) => apiFetch<Project>(`projects/${encodeURIComponent(input.id)}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteProject = (id: string) => apiFetch<null>(`projects/${encodeURIComponent(id)}`, { method: "DELETE" });

// --- Ticket Workflows ---
export const getProjectWorkflows = (projectId: string) =>
  apiFetch<TicketWorkflow[]>(`ticket-workflows?projectId=${encodeURIComponent(projectId)}`);
export const saveProjectWorkflows = (projectId: string, workflows: Partial<TicketWorkflow>[]) =>
  apiFetch<TicketWorkflow[]>("ticket-workflows", {
    method: "POST",
    body: JSON.stringify({ projectId, workflows }),
  });

// --- Tickets ---
export const getTickets = (filters?: { teamId?: string; projectId?: string; targetTeamId?: string }) => {
  const params = new URLSearchParams();
  if (filters?.teamId) params.set("teamId", filters.teamId);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.targetTeamId) params.set("targetTeamId", filters.targetTeamId);
  const qs = params.toString();
  return apiFetch<Ticket[]>(`tickets${qs ? `?${qs}` : ""}`);
};
export const getTicket = (id: string) => apiFetch<Ticket & { transitions?: TicketTransition[] }>(`tickets/${encodeURIComponent(id)}`);
export const createTicket = (input: CreateTicketInput) =>
  apiFetch<Ticket>("tickets", { method: "POST", body: JSON.stringify(input) });
export const updateTicket = (input: UpdateTicketInput) =>
  apiFetch<Ticket>(`tickets/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const deleteTicket = (id: string) => apiFetch<null>(`tickets/${encodeURIComponent(id)}`, { method: "DELETE" });
export const moveTicket = (id: string, statusId: string, order: number, reason?: string) =>
  apiFetch<Ticket>(`tickets/${encodeURIComponent(id)}/move`, {
    method: "PATCH",
    body: JSON.stringify({ statusId, order, reason }),
  });

// --- Ticket Messages ---
export const getTicketMessages = (ticketId: string, limit = 100) =>
  apiFetch<TicketMessage[]>(`tickets/${encodeURIComponent(ticketId)}/messages?limit=${limit}`);
export const sendTicketMessage = (
  ticketId: string,
  payload: { senderId?: string | null; senderName: string; senderType?: "member" | "ai" | "system"; content: string; metadata?: unknown }
) =>
  apiFetch<TicketMessage>(`tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const runTicketAiAction = (
  ticketId: string,
  action: string,
  options?: { applyToTicket?: boolean }
) =>
  apiFetch<any>(`tickets/${encodeURIComponent(ticketId)}/ai`, {
    method: "POST",
    body: JSON.stringify({ action, applyToTicket: options?.applyToTicket }),
  });
export const getTicketExternalLinks = (ticketId: string) =>
  apiFetch<{ github: Array<{ repo: string; number: number; url?: string }>; jira: Array<{ key: string; url?: string }> }>(
    `tickets/${encodeURIComponent(ticketId)}/external-links`
  );
export const updateTicketExternalLinks = (ticketId: string, externalRefs: unknown) =>
  apiFetch<any>(`tickets/${encodeURIComponent(ticketId)}/external-links`, {
    method: "PATCH",
    body: JSON.stringify({ externalRefs }),
  });

// --- Messages ---
export const getMessages = (teamId: string, ownerMemberId: string, projectId: string, limit = 50) =>
  apiFetch<Message[] & { meta?: { total: number } }>(
    `messages?teamId=${encodeURIComponent(teamId)}&ownerMemberId=${encodeURIComponent(ownerMemberId)}&projectId=${encodeURIComponent(projectId)}&limit=${limit}`
  );
export const deleteMessage = (id: string) => apiFetch<null>(`messages/${encodeURIComponent(id)}`, { method: "DELETE" });

export const postChatThreadMessage = (payload: {
  teamId: string;
  ownerMemberId: string;
  projectId: string;
  senderId?: string | null;
  senderName: string;
  senderType?: "member" | "ai" | "system";
  content: string;
  metadata?: unknown;
}) => apiFetch<Message>("messages", { method: "POST", body: JSON.stringify(payload) });

export const broadcastProjectStandup = (projectId: string, initiatorMemberId: string) =>
  apiFetch<{ notified: number; memberIds: string[] }>("project-standup/broadcast", {
    method: "POST",
    body: JSON.stringify({ projectId, initiatorMemberId }),
  });

export type ProjectStandupSummary = {
  date: string;
  projectName: string;
  markdown: string;
  members: Array<{
    memberId: string;
    name: string;
    submitted: boolean;
    checkin: StandupCheckin | null;
  }>;
};

export const getProjectStandupSummary = (
  projectId: string,
  requesterMemberId: string,
  date?: string
) => {
  const params = new URLSearchParams({
    projectId,
    requesterMemberId,
  });
  if (date) params.set("date", date);
  return apiFetch<ProjectStandupSummary>(`project-standup/summary?${params.toString()}`);
};

// --- Notifications ---
export type NotificationItem = {
  id: string
  memberId: string
  teamId: string
  type: string
  title: string
  body: string | null
  metadata: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export const getNotifications = (memberId: string, unreadOnly = false, limit = 50) =>
  apiFetch<NotificationItem[]>(
    `notifications?memberId=${encodeURIComponent(memberId)}&unreadOnly=${unreadOnly ? 'true' : 'false'}&limit=${limit}`
  )

export const getNotificationCount = (memberId: string) =>
  apiFetch<{ unreadCount: number }>(`notifications/count?memberId=${encodeURIComponent(memberId)}`)

export const markNotificationRead = (id: string) =>
  apiFetch<NotificationItem | { alreadyRead: true }>(`notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  })

export const markAllNotificationsRead = (memberId: string) =>
  apiFetch<{ updated: number }>(`notifications?memberId=${encodeURIComponent(memberId)}`, {
    method: 'POST',
  })

// --- Knowledge ---
export const getKnowledge = (teamId?: string, category?: string) => {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (category) params.set('category', category);
  const qs = params.toString();
  return apiFetch<KnowledgeEntry[]>(`knowledge${qs ? `?${qs}` : ''}`);
};
export const createKnowledge = (input: CreateKnowledgeInput) => apiFetch<KnowledgeEntry>("knowledge", { method: "POST", body: JSON.stringify(input) });
export const updateKnowledge = (input: UpdateKnowledgeInput) => apiFetch<KnowledgeEntry>(`knowledge/${encodeURIComponent(input.id)}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteKnowledge = (id: string) => apiFetch<null>(`knowledge/${encodeURIComponent(id)}`, { method: "DELETE" });

// --- Standup ---
export const getStandups = (teamId?: string, date?: string) => {
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (date) params.set('date', date);
  const qs = params.toString();
  return apiFetch<StandupCheckin[]>(`standup${qs ? `?${qs}` : ''}`);
};
export const submitStandup = (input: SubmitStandupInput) => apiFetch<StandupCheckin>("standup", { method: "POST", body: JSON.stringify(input) });

// --- Reports ---
export const getReports = (teamId?: string) => {
  const params = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetch<DailyReport[]>(`reports${params}`);
};
export const generateReport = (teamId: string, date: string) => apiFetch<DailyReport>("reports", { method: "POST", body: JSON.stringify({ teamId, date }) });

// --- Chat with AI ---
export interface ChatResponse {
  userMessage: Message;
  aiMessage: Message;
  pendingTicketConfirm?: PendingInternalTicketConfirm;
}
export const sendChatMessage = (
  teamId: string,
  ownerMemberId: string,
  projectId: string,
  senderId: string | null,
  senderName: string,
  content: string
) =>
  apiFetch<ChatResponse>("chat", {
    method: "POST",
    body: JSON.stringify({
      teamId,
      ownerMemberId,
      projectId,
      senderId,
      senderName,
      senderType: "member",
      content,
    }),
  });

export const confirmChatTicket = (
  teamId: string,
  ownerMemberId: string,
  projectId: string,
  senderId: string | null,
  senderName: string,
  draft: PendingInternalTicketConfirm
) =>
  apiFetch<ChatResponse>("chat", {
    method: "POST",
    body: JSON.stringify({
      teamId,
      ownerMemberId,
      projectId,
      senderId,
      senderName,
      confirmInternalTicket: draft,
    }),
  });

// --- Seed ---
export const seedDemoData = () => apiFetch<{ teams: number; members: number; projects: number; knowledge: number; messages: number; standups: number }>("seed", { method: "POST" });

// --- GitHub Issues ---
export interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  labels: { name: string; color: string }[]
  assignee: { login: string; avatar_url: string } | null
  created_at: string
  updated_at: string
  comments: number
}

export const getGitHubIssues = (projectId: string, params?: { state?: string; per_page?: number; page?: number }) => {
  const qs = new URLSearchParams({ projectId, state: params?.state || 'open', per_page: String(params?.per_page || 20), page: String(params?.page || 1) })
  return apiFetch<GitHubIssue[]>(`github/issues?${qs}`)
}
export const getGitHubIssue = (projectId: string, issueId: string, withComments = false) => {
  const qs = new URLSearchParams({ projectId })
  if (withComments) qs.set('comments', 'true')
  return apiFetch<any>(`github/${encodeURIComponent(issueId)}?${qs}`)
}
export const createGitHubIssue = (projectId: string, data: { title: string; body?: string; labels?: string[] }) =>
  apiFetch<GitHubIssue>(`github/issues?projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: JSON.stringify(data) })
export const updateGitHubIssue = (projectId: string, issueId: string, data: { title?: string; state?: string; labels?: string[] }) =>
  apiFetch<GitHubIssue>(`github/${encodeURIComponent(issueId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify(data) })
export const commentGitHubIssue = (projectId: string, issueId: string, body: string) =>
  apiFetch<any>(`github/${encodeURIComponent(issueId)}?projectId=${encodeURIComponent(projectId)}&comment=true`, { method: 'POST', body: JSON.stringify({ body }) })

// --- Jira Issues ---
export interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    status: { name: string; statusCategory: { colorName: string } }
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null
    priority: { name: string } | null
    issuetype: { name: string; iconUrl: string }
    labels: string[]
    created: string
    updated: string
    description: any
  }
  self: string
}

export const getJiraIssues = (projectId: string, params?: { status?: string; maxResults?: number }) => {
  const qs = new URLSearchParams({ projectId, status: params?.status || 'open', maxResults: String(params?.maxResults || 20) })
  return apiFetch<{ issues: JiraIssue[]; total: number }>(`jira/issues?${qs}`)
}
export const getJiraIssue = (projectId: string, issueKey: string) =>
  apiFetch<JiraIssue>(`jira/${encodeURIComponent(issueKey)}?projectId=${encodeURIComponent(projectId)}`)
export const createJiraIssue = (projectId: string, data: { summary: string; description?: string; issueType?: string; priority?: string; labels?: string[] }) =>
  apiFetch<JiraIssue>(`jira/issues?projectId=${encodeURIComponent(projectId)}`, { method: 'POST', body: JSON.stringify(data) })
export const updateJiraIssue = (projectId: string, issueKey: string, data: { summary?: string; status?: string; priority?: string }) =>
  apiFetch<JiraIssue>(`jira/${encodeURIComponent(issueKey)}?projectId=${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify(data) })
export const commentJiraIssue = (projectId: string, issueKey: string, body: string) =>
  apiFetch<any>(`jira/${encodeURIComponent(issueKey)}?projectId=${encodeURIComponent(projectId)}&comment=true`, { method: 'POST', body: JSON.stringify({ body }) })
