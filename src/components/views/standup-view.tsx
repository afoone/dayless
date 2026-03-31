'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ClipboardCheck,
  CheckCircle2,
  Smile,
  Meh,
  Frown,
  AlertTriangle,
  Clock,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react'

interface StandupEntry {
  id: string
  member: { name: string; initials: string; role: string }
  yesterdayWork: string
  todayPlan: string
  blockers: string
  mood: 'great' | 'good' | 'neutral' | 'stressed' | 'blocked'
  submittedAt: string
}

const mockStandups: StandupEntry[] = [
  {
    id: '1',
    member: { name: 'Ana López', initials: 'AL', role: 'Tech Lead' },
    yesterdayWork: 'Completed PR review for payment module. Fixed 3 bugs in auth flow.',
    todayPlan: 'Start working on the new dashboard analytics component. Code review for Carlos.',
    blockers: 'None',
    mood: 'great',
    submittedAt: '9:02 AM',
  },
  {
    id: '2',
    member: { name: 'Carlos Rodríguez', initials: 'CR', role: 'Senior Dev' },
    yesterdayWork: 'Refactored Stripe webhook handler. Started unit tests.',
    todayPlan: 'Continue with Stripe integration tests. Ask Ana about webhook signature.',
    blockers: 'Stripe webhook signature verification failing in staging',
    mood: 'stressed',
    submittedAt: '9:15 AM',
  },
  {
    id: '3',
    member: { name: 'María García', initials: 'MG', role: 'Mid Dev' },
    yesterdayWork: 'Implemented new date picker component. Updated Storybook docs.',
    todayPlan: 'Work on the notification system UI. Pair programming with Javier.',
    blockers: 'None',
    mood: 'good',
    submittedAt: '9:30 AM',
  },
]

const pendingMembers = [
  { name: 'Luis Hernández', initials: 'LH', role: 'Backend Dev' },
  { name: 'Javier Kim', initials: 'JK', role: 'Junior Dev' },
  { name: 'Sara Gómez', initials: 'SG', role: 'Mid Dev' },
]

const moodConfig = {
  great: { icon: '😊', color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Great' },
  good: { icon: '🙂', color: 'text-blue-600', bg: 'bg-blue-50', label: 'Good' },
  neutral: { icon: '😐', color: 'text-slate-500', bg: 'bg-slate-50', label: 'Neutral' },
  stressed: { icon: '😟', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Stressed' },
  blocked: { icon: '😰', color: 'text-red-600', bg: 'bg-red-50', label: 'Blocked' },
}

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function StandupView() {
  const [standups] = useState(mockStandups)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMood, setSelectedMood] = useState<string>('good')

  const submittedCount = standups.length
  const totalMembers = standups.length + pendingMembers.length
  const blockersCount = standups.filter(s => s.blockers && s.blockers !== 'None').length

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Standup</h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700">{submittedCount}/{totalMembers} submitted</p>
            <p className="text-[11px] text-slate-400">{blockersCount} blockers reported</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <Send className="size-4" /> Submit Standup
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Daily Standup</DialogTitle>
                <DialogDescription>Share your progress with the team</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>What did you do yesterday?</Label>
                  <Textarea placeholder="Completed tasks, progress made..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>What will you do today?</Label>
                  <Textarea placeholder="Planned tasks, goals..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Any blockers?</Label>
                  <Textarea placeholder="Issues, dependencies, help needed... (leave empty if none)" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>How are you feeling?</Label>
                  <div className="flex items-center gap-2">
                    {Object.entries(moodConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedMood(key)}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          selectedMood === key
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span>{config.icon}</span>
                        <span className="hidden sm:inline">{config.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setDialogOpen(false)}>
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Progress */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Standup Progress</span>
              <span className="text-sm font-bold text-emerald-600">{Math.round((submittedCount / totalMembers) * 100)}%</span>
            </div>
            <Progress value={(submittedCount / totalMembers) * 100} className="h-2" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Standups */}
      <div className="space-y-4">
        {standups.map(standup => {
          const mood = moodConfig[standup.mood]
          return (
            <motion.div key={standup.id} variants={itemVariants}>
              <Card className="border-slate-200/80 bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="size-10 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-emerald-100 text-emerald-700">
                        {standup.member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold text-slate-900">{standup.member.name}</h3>
                        <Badge variant="secondary" className="text-[10px]">{standup.member.role}</Badge>
                        <Badge variant="outline" className={`${mood.bg} ${mood.color} border-0 text-[10px] gap-1`}>
                          {mood.icon} {mood.label}
                        </Badge>
                        <span className="text-[11px] text-slate-400 ml-auto">{standup.submittedAt}</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Yesterday
                          </p>
                          <p className="text-sm text-slate-700">{standup.yesterdayWork}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <TrendingUp className="size-3" /> Today
                          </p>
                          <p className="text-sm text-slate-700">{standup.todayPlan}</p>
                        </div>
                        {standup.blockers && standup.blockers !== 'None' && (
                          <div>
                            <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Blocker
                            </p>
                            <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{standup.blockers}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}

        {/* Pending */}
        {pendingMembers.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="border-dashed border-slate-300 bg-slate-50/50">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                  <Clock className="size-4" /> Pending ({pendingMembers.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {pendingMembers.map(member => (
                    <div key={member.name} className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[9px] font-semibold bg-slate-100 text-slate-500">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium text-slate-600">{member.name}</p>
                        <p className="text-[10px] text-slate-400">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
