import { create } from "zustand";
import type { AppView, Team, TeamMember } from "@/types";

// ============================================================
// Dayless.ai - Zustand Application Store
// ============================================================

interface AppState {
  // --- Navigation ---
  currentView: AppView;
  sidebarCollapsed: boolean;

  // --- Current User ---
  currentMember: TeamMember | null;

  /** Proyecto de contexto (Kanban + Chat con IA comparten el mismo hilo por proyecto). */
  contextProjectId: string | null;

  /** Tras /standup en el chat: abrir una vez el diálogo de check-in en StandupView. */
  pendingOpenStandupDialog: boolean;

  teams: Team[];
  unreadNotifications: number;

  // --- Actions: Navigation ---
  setCurrentView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // --- Actions: Current User ---
  setCurrentMember: (member: TeamMember | null) => void;
  setContextProjectId: (id: string | null) => void;

  requestOpenStandupDialog: () => void;
  clearPendingStandupDialog: () => void;

  setTeams: (teams: Team[]) => void;
  setUnreadNotifications: (count: number) => void;
  incrementUnreadNotifications: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // --- Initial State ---
  currentView: "dashboard",
  sidebarCollapsed: false,
  currentMember: null,
  contextProjectId: null,
  pendingOpenStandupDialog: false,
  teams: [],
  unreadNotifications: 0,

  // --- Navigation Actions ---
  setCurrentView: (view) => set({ currentView: view }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  // --- Current User Actions ---
  setCurrentMember: (member) =>
    set((state) => {
      const prev = state.currentMember
      const changed =
        (!member && prev) ||
        (member && !prev) ||
        (member &&
          prev &&
          (prev.id !== member.id || prev.teamId !== member.teamId))
      if (!member) {
        return { currentMember: null, contextProjectId: null }
      }
      if (changed) {
        return {
          currentMember: member,
          contextProjectId: member.defaultProjectId ?? null,
        }
      }
      return { currentMember: member }
    }),

  setContextProjectId: (id) => set({ contextProjectId: id }),

  requestOpenStandupDialog: () => set({ pendingOpenStandupDialog: true }),
  clearPendingStandupDialog: () => set({ pendingOpenStandupDialog: false }),

  setTeams: (teams) => set({ teams }),
  setUnreadNotifications: (count) => set({ unreadNotifications: Math.max(0, count) }),
  incrementUnreadNotifications: () =>
    set((state) => ({ unreadNotifications: state.unreadNotifications + 1 })),
}));
