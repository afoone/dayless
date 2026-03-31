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

  teams: Team[];

  // --- Actions: Navigation ---
  setCurrentView: (view: AppView) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // --- Actions: Current User ---
  setCurrentMember: (member: TeamMember | null) => void;

  setTeams: (teams: Team[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // --- Initial State ---
  currentView: "dashboard",
  sidebarCollapsed: false,
  currentMember: null,
  teams: [],

  // --- Navigation Actions ---
  setCurrentView: (view) => set({ currentView: view }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  // --- Current User Actions ---
  setCurrentMember: (member) => set({ currentMember: member }),

  setTeams: (teams) => set({ teams }),
}));
