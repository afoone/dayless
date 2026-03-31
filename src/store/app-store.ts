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

  // --- Team Context ---
  selectedTeamId: string | null;
  teams: Team[];

  // --- Actions: Navigation ---
  setCurrentView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // --- Actions: Current User ---
  setCurrentMember: (member: TeamMember | null) => void;

  // --- Actions: Team Context ---
  selectTeam: (teamId: string | null) => void;
  setTeams: (teams: Team[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // --- Initial State ---
  currentView: "dashboard",
  sidebarCollapsed: false,
  currentMember: null,
  selectedTeamId: null,
  teams: [],

  // --- Navigation Actions ---
  setCurrentView: (view) => set({ currentView: view }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  // --- Current User Actions ---
  setCurrentMember: (member) => set({ currentMember: member }),

  // --- Team Context Actions ---
  selectTeam: (teamId) => set({ selectedTeamId: teamId }),

  setTeams: (teams) => set({ teams }),
}));
