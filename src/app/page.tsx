'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/store/app-store'
import { AuthGate } from '@/components/auth/auth-gate'
import { AppSidebar } from '@/components/layout/sidebar'
import { AppHeader } from '@/components/layout/header'
import { AnimatePresence, motion } from 'framer-motion'
import DashboardView from '@/components/views/dashboard-view'
import ChatView from '@/components/views/chat-view'
import TicketsView from '@/components/views/tickets-view'
import KanbanView from '@/components/views/kanban-view'
import ProfileView from '@/components/views/profile-view'
import TeamsView from '@/components/views/teams-view'
import ProjectsView from '@/components/views/projects-view'
import ProposalsView from '@/components/views/proposals-view'
import KnowledgeView from '@/components/views/knowledge-view'
import StandupView from '@/components/views/standup-view'
import ReportsView from '@/components/views/reports-view'
import SettingsView from '@/components/views/settings-view'
import { getTeams, getMembers, getNotificationCount } from '@/lib/api'
import type { AppView, Team, TeamMember } from '@/types'

const viewComponents: Record<AppView, React.ComponentType> = {
  dashboard: DashboardView,
  chat: ChatView,
  tickets: TicketsView,
  kanban: KanbanView,
  profile: ProfileView,
  teams: TeamsView,
  projects: ProjectsView,
  proposals: ProposalsView,
  knowledge: KnowledgeView,
  standup: StandupView,
  reports: ReportsView,
  settings: SettingsView,
}

function AppShell() {
  const { data: session } = useSession()
  const {
    currentView,
    setTeams,
    setCurrentMember,
    currentMember,
    setUnreadNotifications,
    incrementUnreadNotifications,
  } = useAppStore()
  const ViewComponent = viewComponents[currentView]
  const eventSourceRef = useRef<EventSource | null>(null)

  // Load teams
  const loadTeams = useCallback(async () => {
    try {
      const teamsResult = await getTeams()
      if (teamsResult.success && Array.isArray(teamsResult.data)) {
        const teamsList = teamsResult.data as unknown as Team[]
        setTeams(teamsList)
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    }
  }, [setTeams])

  // Find and set the current member identity from authenticated user
  const resolveMember = useCallback(async () => {
    if (!session?.user?.email) return

    try {
      const membersResult = await getMembers()

      if (membersResult.success && Array.isArray(membersResult.data)) {
        const membersList = membersResult.data as unknown as TeamMember[]
        const uid = session.user.id
        const byUserId = membersList.filter((m) => m.userId && m.userId === uid)
        if (byUserId.length === 1) {
          setCurrentMember(byUserId[0])
          return
        }
        if (byUserId.length > 1) {
          byUserId.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          setCurrentMember(byUserId[0])
          return
        }
        const sameEmail = membersList.filter(
          (m) => m.email?.toLowerCase() === session.user.email?.toLowerCase()
        )
        const matching = sameEmail[0]
        if (matching) {
          setCurrentMember(matching)
          return
        }
      }

      // No TeamMember row yet: expose User id so /api/members/[id]/projects can resolve via userId
      setCurrentMember({
        id: session.user.id,
        teamId: '',
        name: session.user.name || 'User',
        role: 'Developer',
        email: session.user.email ?? null,
        avatar: session.user.image ?? null,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to resolve member:', error)
    }
  }, [session, setCurrentMember])

  const loadNotificationCount = useCallback(async () => {
    if (!currentMember?.id || !currentMember?.teamId) {
      setUnreadNotifications(0)
      return
    }
    const result = await getNotificationCount(currentMember.id)
    if (result.success && result.data) {
      setUnreadNotifications(result.data.unreadCount)
    }
  }, [currentMember, setUnreadNotifications])

  // Load teams once on mount
  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  // Resolve member when session or team changes
  useEffect(() => {
    resolveMember()
  }, [resolveMember])

  useEffect(() => {
    loadNotificationCount()
  }, [loadNotificationCount])

  useEffect(() => {
    if (!currentMember?.id || !currentMember?.teamId) return

    eventSourceRef.current?.close()
    const source = new EventSource(`/api/events/stream?memberId=${encodeURIComponent(currentMember.id)}`)
    eventSourceRef.current = source

    source.addEventListener('notification', () => {
      incrementUnreadNotifications()
    })
    source.addEventListener('message', () => {
      incrementUnreadNotifications()
    })

    source.onerror = () => {
      // browser auto-reconnects for SSE
    }

    return () => {
      source.close()
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null
      }
    }
  }, [currentMember, incrementUnreadNotifications])

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
