'use client'

import { useAppStore } from '@/store/app-store'
import { MobileSidebar } from './sidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, Search, Moon, Sun, User, LogOut, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'

const viewLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  chat: 'Chat',
  teams: 'Teams',
  projects: 'Projects',
  knowledge: 'Knowledge Base',
  standup: 'Daily Standup',
  reports: 'Reports',
  settings: 'Settings',
}

export function AppHeader() {
  const { currentView, currentMember } = useAppStore()
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    sessionStorage.removeItem('dayless-user')
    window.location.href = '/'
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 md:px-6">
      <MobileSidebar />
      
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {viewLabels[currentView] || 'Dashboard'}
        </h2>
        <Badge variant="outline" className="hidden sm:flex border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">
          Sprint 14
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hidden sm:flex">
          <Search className="size-4" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-slate-400 hover:text-slate-600"
        >
          <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-slate-600">
          <Bell className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            2
          </span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-1 hover:bg-slate-100">
              <Avatar className="size-7">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                  {currentMember
                    ? currentMember.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                    : 'DU'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-slate-700">
                {currentMember?.name || 'Demo User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <User className="size-4 mr-2" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useAppStore.getState().setCurrentView('settings')}>
              <Settings className="size-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
              <LogOut className="size-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
