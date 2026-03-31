'use client'

import { useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/store/app-store'
import { AuthGate } from '@/components/auth/auth-gate'
import { AppSidebar } from '@/components/layout/sidebar'
import { AppHeader } from '@/components/layout/header'
import { AnimatePresence, motion } from 'framer-motion'
import DashboardView from '@/components/views/dashboard-view'
import ChatView from '@/components/views/chat-view'
import TeamsView from '@/components/views/teams-view'
import ProjectsView from '@/components/views/projects-view'
import KnowledgeView from '@/components/views/knowledge-view'
import StandupView from '@/components/views/standup-view'
import ReportsView from '@/components/views/reports-view'
import SettingsView from '@/components/views/settings-view'
import { getTeams, getMembers } from '@/lib/api'
import type { AppView, Team, TeamMember } from '@/types'

const viewComponents: Record<AppView, React.ComponentType> = {
  dashboard: DashboardView,
  chat: ChatView,
  teams: TeamsView,
  projects: ProjectsView,
  knowledge: KnowledgeView,
  standup: StandupView,
  reports: ReportsView,
  settings: SettingsView,
}

function AppShell() {
  const { data: session } = useSession()
  const { currentView, setTeams, selectTeam, setCurrentMember, selectedTeamId } = useAppStore()
  const ViewComponent = viewComponents[currentView]

  // Load teams
  const loadTeams = useCallback(async () => {
    try {
      const teamsResult = await getTeams()
      if (teamsResult.success && Array.isArray(teamsResult.data)) {
        const teamsList = teamsResult.data as unknown as Team[]
        setTeams(teamsList)
        if (teamsList.length > 0 && !selectedTeamId) {
          selectTeam(teamsList[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }, [setTeams, selectTeam, selectedTeamId])

  // Find and set the current member identity
  const resolveMember = useCallback(async () => {
    if (!session?.user?.email) return

    try {
      const teamId = selectedTeamId || useAppStore.getState().selectedTeamId
      const params = teamId ? `?teamId=${teamId}` : ''
      const membersResult = await getMembers(teamId || undefined)

      if (membersResult.success && Array.isArray(membersResult.data)) {
        const membersList = membersResult.data as unknown as TeamMember[]
        const matching = membersList.find(
          (m) => m.email?.toLowerCase() === session.user.email?.toLowerCase()
        )
        if (matching) {
          setCurrentMember(matching)
          return
        }
      }

      // Fallback: set identity from session
      if (!useAppStore.getState().currentMember) {
        setCurrentMember({
          id: session.user.id,
          teamId: selectedTeamId || '',
          name: session.user.name || 'User',
          role: 'Developer',
          email: session.user.email,
          avatar: session.user.image,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to resolve member:', error)
    }
  }, [session, selectedTeamId, setCurrentMember])

  // Load teams once on mount
  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  // Resolve member when session or team changes
  useEffect(() => {
    resolveMember()
  }, [resolveMember])

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ViewComponent />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  )
}
