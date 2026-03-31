'use client'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import type { AppView } from '@/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  KanbanSquare,
  Ticket,
  Users,
  FolderKanban,
  Brain,
  ClipboardCheck,
  FileBarChart,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const navItems: { id: AppView; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageSquare, badge: '3' },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'knowledge', label: 'Knowledge Base', icon: Brain },
  { id: 'standup', label: 'Standup', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { currentView, setCurrentView, teams, currentMember } = useAppStore()
  const memberTeam = teams.find((t) => t.id === currentMember?.teamId)

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-700/50">
        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
          <Bot className="size-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <h1 className="text-lg font-bold text-white tracking-tight">dayless.ai</h1>
              <p className="text-[10px] text-emerald-400 font-medium -mt-0.5">AI Scrum Master</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id
            const button = (
              <Button
                key={item.id}
                variant="ghost"
                onClick={() => {
                  setCurrentView(item.id)
                  onNavigate?.()
                }}
                className={cn(
                  'w-full justify-start gap-3 h-10 px-3 text-sm font-medium transition-all duration-200',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                )}
              >
                <item.icon className={cn('size-[18px] shrink-0', isActive && 'text-emerald-400')} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!collapsed && item.badge && (
                  <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            )

            if (collapsed) {
              return (
                <TooltipProvider key={item.id} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            }

            return button
          })}
        </nav>
      </ScrollArea>

      {/* Team */}
      <div className="border-t border-slate-700/50 p-3">
        <AnimatePresence>
          {!collapsed ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex w-full items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2.5 text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-300 truncate">
                    {memberTeam?.name || 'Sin equipo'}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-center text-slate-400 hover:text-white hover:bg-slate-800">
                    <div className="size-2 rounded-full bg-emerald-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                  {memberTeam?.name || 'Sin equipo'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </AnimatePresence>
      </div>

      {/* Current User */}
      <div className="border-t border-slate-700/50 p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              {currentMember ? currentMember.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'DU'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-300 truncate">{currentMember?.name || 'Demo User'}</p>
              <p className="text-[11px] text-slate-500 truncate">{currentMember?.role || 'Developer'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      <NavContent collapsed={sidebarCollapsed} />
      <button
        onClick={toggleSidebar}
        className="absolute top-5 -right-3 z-10 hidden md:flex size-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
      >
        {sidebarCollapsed ? <PanelLeft className="size-3" /> : <PanelLeftClose className="size-3" />}
      </button>
    </aside>
  )
}

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-slate-600 hover:text-slate-900">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0 bg-slate-900 border-slate-800">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <NavContent collapsed={false} />
      </SheetContent>
    </Sheet>
  )
}
