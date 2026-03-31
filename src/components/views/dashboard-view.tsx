'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  TrendingUp,
  Users,
  FolderKanban,
  MessageSquare,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Activity,
  Zap,
  BarChart3,
  Play,
  FileText,
  MessageCircle,
  ShieldAlert,
  Lightbulb,
  Info,
  Bot,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

// --- Animation variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

const cardHoverProps = {
  whileHover: { scale: 1.01, y: -2 },
  transition: { type: 'spring', stiffness: 300, damping: 20 },
}

// --- Data ---
const statsCards = [
  {
    title: 'Active Teams',
    value: '8',
    icon: Users,
    trend: '+2 this week',
    trendUp: true,
    color: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    iconRing: 'ring-emerald-100',
  },
  {
    title: 'Open Projects',
    value: '12',
    icon: FolderKanban,
    trend: '3 on track',
    trendUp: true,
    color: 'text-blue-600',
    iconBg: 'bg-blue-50',
    iconRing: 'ring-blue-100',
  },
  {
    title: 'Messages Today',
    value: '47',
    icon: MessageSquare,
    trend: null,
    trendUp: true,
    color: 'text-violet-600',
    iconBg: 'bg-violet-50',
    iconRing: 'ring-violet-100',
  },
  {
    title: 'Knowledge Base',
    value: '156',
    icon: Brain,
    trend: '12 new entries',
    trendUp: true,
    color: 'text-amber-600',
    iconBg: 'bg-amber-50',
    iconRing: 'ring-amber-100',
  },
]

const recentActivities = [
  {
    icon: Bot,
    description: 'Dayless.ai asked about sprint progress',
    time: '5 min ago',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: CheckCircle2,
    description: 'Carlos completed JIRA-123',
    time: '15 min ago',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Brain,
    description: 'New knowledge: API rate limit is 100 req/min',
    time: '1h ago',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: Clock,
    description: 'Sprint review scheduled for Friday',
    time: '2h ago',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: AlertTriangle,
    description: 'Ana reported blocker on authentication module',
    time: '3h ago',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
]

const teams = [
  {
    name: 'Frontend Team',
    members: 5,
    activeTasks: 3,
    progress: 65,
    initials: ['AL', 'CR', 'MR', 'JK', 'TS'],
    color: 'text-emerald-600',
  },
  {
    name: 'Backend Team',
    members: 4,
    activeTasks: 2,
    progress: 80,
    initials: ['LH', 'PN', 'SG', 'DR'],
    color: 'text-blue-600',
  },
  {
    name: 'DevOps Team',
    members: 3,
    activeTasks: 1,
    progress: 45,
    initials: ['RM', 'KW', 'VT'],
    color: 'text-amber-600',
  },
]

const quickActions = [
  {
    label: 'Start Daily Standup',
    icon: Play,
    variant: 'default' as const,
    className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    label: 'Generate Report',
    icon: FileText,
    variant: 'outline' as const,
    className: 'border-slate-200 hover:bg-slate-50',
  },
  {
    label: 'Ask Dayless.ai',
    icon: MessageCircle,
    variant: 'outline' as const,
    className: 'border-slate-200 hover:bg-slate-50',
  },
  {
    label: 'Review Blockers',
    icon: ShieldAlert,
    variant: 'outline' as const,
    className: 'border-slate-200 hover:bg-slate-50',
  },
]

const aiInsights = [
  {
    icon: AlertTriangle,
    emoji: '⚠️',
    text: 'Sprint velocity is 15% below target. Consider reducing scope.',
    type: 'warning' as const,
  },
  {
    icon: Info,
    emoji: '📌',
    text: '2 blockers need attention: Auth module (Ana), DB migration (Luis)',
    type: 'info' as const,
  },
  {
    icon: Lightbulb,
    emoji: '💡',
    text: 'Suggestion: Schedule a sync between Frontend and Backend teams about API contracts.',
    type: 'suggestion' as const,
  },
]

const insightTypeStyles = {
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    badgeBg: 'bg-amber-100 text-amber-700',
    badgeText: 'Warning',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    badgeBg: 'bg-blue-100 text-blue-700',
    badgeText: 'Attention',
  },
  suggestion: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-700',
    badgeText: 'Suggestion',
  },
}

export default function DashboardView() {
  const [isLoaded, setIsLoaded] = useState(false)

  // Trigger entrance animations after mount
  useState(() => {
    setIsLoaded(true)
  })

  return (
    <AnimatePresence mode="wait">
      {isLoaded && (
        <motion.div
          className="space-y-6 p-4 md:p-6 lg:p-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Page Header */}
          <motion.div variants={itemVariants} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Dashboard
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Overview of your team&apos;s progress and AI insights.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 gap-1.5">
                <Activity className="size-3" />
                Live
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                Sprint 14
              </Badge>
            </div>
          </motion.div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((stat) => (
              <motion.div key={stat.title} variants={itemVariants} {...cardHoverProps}>
                <Card className="h-full border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                        <p className="text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                        {stat.trend && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className={`size-3.5 ${stat.trendUp ? 'text-emerald-500' : 'text-red-500'}`} />
                            <span className={`text-xs font-medium ${stat.trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                              {stat.trend}
                            </span>
                          </div>
                        )}
                      </div>
                      <div
                        className={`flex size-12 items-center justify-center rounded-xl ${stat.iconBg} ring-4 ${stat.iconRing}`}
                      >
                        <stat.icon className={`size-6 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Main Content Area - 2 Columns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column - Recent Activity */}
            <motion.div variants={itemVariants} {...cardHoverProps}>
              <Card className="h-full border-slate-200/80 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50">
                        <Activity className="size-4 text-emerald-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">Recent Activity</CardTitle>
                        <CardDescription className="text-xs text-slate-500">Latest team updates</CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-emerald-600">
                      View all
                      <ArrowRight className="ml-1 size-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                    {recentActivities.map((activity, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.06 }}
                        className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-slate-50"
                      >
                        <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${activity.bg}`}>
                          <activity.icon className={`size-4 ${activity.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700 leading-snug">{activity.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{activity.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column - Team Status + Quick Actions */}
            <div className="space-y-6">
              {/* Team Status */}
              <motion.div variants={itemVariants} {...cardHoverProps}>
                <Card className="h-full border-slate-200/80 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50">
                          <Users className="size-4 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold text-slate-900">Team Status</CardTitle>
                          <CardDescription className="text-xs text-slate-500">Active team progress</CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-emerald-600">
                        View all
                        <ArrowRight className="ml-1 size-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    {teams.map((team, index) => (
                      <motion.div
                        key={team.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + index * 0.08 }}
                        className="rounded-lg border border-slate-100 p-4 transition-colors hover:bg-slate-50/50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h4 className="text-sm font-semibold text-slate-800">{team.name}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {team.members} members
                            </Badge>
                          </div>
                          <span className={`text-xs font-semibold ${team.color}`}>
                            {team.activeTasks} active
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={team.progress} className="h-2 flex-1" />
                          <span className="text-xs font-medium text-slate-500 w-10 text-right">
                            {team.progress}%
                          </span>
                        </div>
                        <div className="flex items-center mt-3 -space-x-2">
                          {team.initials.map((initials, i) => (
                            <Avatar key={i} className="size-6 ring-2 ring-white border-0">
                              <AvatarFallback className="text-[10px] font-medium bg-slate-100 text-slate-600">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Actions */}
              <motion.div variants={itemVariants} {...cardHoverProps}>
                <Card className="border-slate-200/80 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50">
                        <Zap className="size-4 text-violet-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">Quick Actions</CardTitle>
                        <CardDescription className="text-xs text-slate-500">Common team operations</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {quickActions.map((action) => (
                        <motion.div
                          key={action.label}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant={action.variant}
                            className={`w-full justify-start gap-2 h-auto py-3 px-4 text-sm font-medium ${action.className}`}
                          >
                            <action.icon className="size-4" />
                            {action.label}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* AI Insights Card - Full Width */}
          <motion.div variants={itemVariants} {...cardHoverProps}>
            <Card className="border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-200">
                      <Bot className="size-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        AI Insights
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                          Powered by AI
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Intelligent analysis of your team&apos;s performance
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-emerald-600">
                    View all insights
                    <ArrowRight className="ml-1 size-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {aiInsights.map((insight, index) => {
                    const styles = insightTypeStyles[insight.type]
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                        className={`rounded-xl border p-4 transition-all hover:shadow-sm ${styles.bg} ${styles.border}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <span className="text-lg">{insight.emoji}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <Badge className={`mb-2 text-[10px] px-1.5 py-0 border-0 ${styles.badgeBg}`}>
                              {styles.badgeText}
                            </Badge>
                            <p className="text-sm text-slate-700 leading-relaxed">{insight.text}</p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Inline scrollbar styles */}
          <style jsx global>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background-color: #e2e8f0;
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background-color: #cbd5e1;
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
