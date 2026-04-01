'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  TrendingUp,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { getStandups, getMembers, submitStandup } from '@/lib/api'
import type { StandupCheckin, TeamMember } from '@/types'
import { toast } from 'sonner'

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const moodConfig = {
  great: { icon: '😊', color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Genial' },
  good: { icon: '🙂', color: 'text-teal-600', bg: 'bg-teal-50', label: 'Bien' },
  neutral: { icon: '😐', color: 'text-slate-500', bg: 'bg-slate-50', label: 'Neutral' },
  stressed: { icon: '😟', color: 'text-amber-600', bg: 'bg-amber-50', label: 'Tenso' },
  blocked: { icon: '😰', color: 'text-red-600', bg: 'bg-red-50', label: 'Bloqueado' },
} as const

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export default function StandupView() {
  const { currentMember, pendingOpenStandupDialog, clearPendingStandupDialog } = useAppStore()
  const teamId = currentMember?.teamId
  const dateKey = todayYmd()

  const [standups, setStandups] = useState<StandupCheckin[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [yesterdayWork, setYesterdayWork] = useState('')
  const [todayPlan, setTodayPlan] = useState('')
  const [blockersInput, setBlockersInput] = useState('')
  const [selectedMood, setSelectedMood] = useState<string>('good')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!teamId) {
        if (!cancelled) {
          setStandups([])
          setTeamMembers([])
          setIsLoading(false)
        }
        return
      }
      if (!cancelled) setIsLoading(true)
      const [standRes, membersRes] = await Promise.all([
        getStandups(teamId, dateKey),
        getMembers(teamId),
      ])
      if (cancelled) return
      if (standRes.success && Array.isArray(standRes.data)) {
        setStandups(standRes.data as StandupCheckin[])
      } else {
        setStandups([])
      }
      if (membersRes.success && Array.isArray(membersRes.data)) {
        setTeamMembers(membersRes.data as TeamMember[])
      } else {
        setTeamMembers([])
      }
      setIsLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [teamId, dateKey])

  const openStandupDialog = useCallback(() => {
    if (currentMember) {
      const mine = standups.find((s) => s.memberId === currentMember.id)
      if (mine) {
        setYesterdayWork(mine.yesterdayWork || '')
        setTodayPlan(mine.todayPlan || '')
        setBlockersInput(mine.blockers || '')
        setSelectedMood(mine.mood)
      } else {
        setYesterdayWork('')
        setTodayPlan('')
        setBlockersInput('')
        setSelectedMood('good')
      }
    }
    setDialogOpen(true)
  }, [standups, currentMember])

  useEffect(() => {
    if (!pendingOpenStandupDialog || isLoading || !teamId) return
    clearPendingStandupDialog()
    const id = requestAnimationFrame(() => {
      openStandupDialog()
    })
    return () => cancelAnimationFrame(id)
  }, [
    pendingOpenStandupDialog,
    isLoading,
    teamId,
    clearPendingStandupDialog,
    openStandupDialog,
  ])

  const submittedIds = new Set(standups.map((s) => s.memberId))
  const pendingMembers = teamMembers.filter((m) => !submittedIds.has(m.id))
  const submittedCount = standups.length
  const totalMembers = teamMembers.length
  const progressPct =
    totalMembers > 0 ? Math.round((submittedCount / totalMembers) * 100) : 0
  const blockersCount = standups.filter(
    (s) => (s.blockers || '').trim().length > 0
  ).length

  const handleSubmitStandup = async () => {
    if (!currentMember?.id) {
      toast.error('Necesitas un perfil de miembro del equipo')
      return
    }
    const y = yesterdayWork.trim()
    const t = todayPlan.trim()
    if (y.length < 2 && t.length < 2) {
      toast.error('Describe al menos ayer o hoy')
      return
    }
    setIsSubmitting(true)
    const res = await submitStandup({
      memberId: currentMember.id,
      date: dateKey,
      yesterdayWork: y || undefined,
      todayPlan: t || undefined,
      blockers: blockersInput.trim() || undefined,
      mood: selectedMood as StandupCheckin['mood'],
    })
    setIsSubmitting(false)
    if (res.success) {
      toast.success('Standup guardado')
      setDialogOpen(false)
      void (async () => {
        if (!teamId) return
        const [standRes, membersRes] = await Promise.all([
          getStandups(teamId, dateKey),
          getMembers(teamId),
        ])
        if (standRes.success && Array.isArray(standRes.data)) {
          setStandups(standRes.data as StandupCheckin[])
        }
        if (membersRes.success && Array.isArray(membersRes.data)) {
          setTeamMembers(membersRes.data as TeamMember[])
        }
      })()
    } else {
      toast.error(res.error || 'No se pudo guardar')
    }
  }

  return (
    <motion.div
      className="space-y-6 p-4 md:p-6 lg:p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daily Standup</h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Día {dateKey}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700">
              {submittedCount}/{Math.max(totalMembers, 1)} enviados
            </p>
            <p className="text-[11px] text-slate-400">{blockersCount} con blockers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button
              type="button"
              className="min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              disabled={!currentMember?.id}
              onClick={() => openStandupDialog()}
            >
              <Send className="size-4" /> Enviar standup
            </Button>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Daily standup</DialogTitle>
                <DialogDescription>
                  Comparte tu progreso con el equipo (se guarda para hoy).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>¿Qué hiciste ayer?</Label>
                  <Textarea
                    value={yesterdayWork}
                    onChange={(e) => setYesterdayWork(e.target.value)}
                    placeholder="Tareas completadas, avances..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>¿Qué harás hoy?</Label>
                  <Textarea
                    value={todayPlan}
                    onChange={(e) => setTodayPlan(e.target.value)}
                    placeholder="Objetivos del día..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>¿Algún bloqueo?</Label>
                  <Textarea
                    value={blockersInput}
                    onChange={(e) => setBlockersInput(e.target.value)}
                    placeholder="Dependencias, ayuda... (vacío si no hay)"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado de ánimo</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.entries(moodConfig).map(([key, config]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedMood(key)}
                        className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors touch-manipulation ${
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
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  className="min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => void handleSubmitStandup()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {!teamId && (
        <p className="text-sm text-slate-500">
          Inicia sesión con una cuenta enlazada a un miembro del equipo para ver el standup del equipo.
        </p>
      )}

      {isLoading && teamId ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {!isLoading && teamId && (
        <>
          <motion.div variants={itemVariants}>
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    Progreso del equipo
                  </span>
                  <span className="text-sm font-bold text-emerald-600">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </CardContent>
            </Card>
          </motion.div>

          <div className="space-y-4">
            {standups.map((standup) => {
              const mood = moodConfig[standup.mood]
              const name = standup.member?.name || 'Miembro'
              const role = standup.member?.role || '—'
              const initials = memberInitials(name)
              const blockers = (standup.blockers || '').trim()
              const submittedAt = new Date(standup.createdAt).toLocaleTimeString(
                'es-ES',
                { hour: '2-digit', minute: '2-digit' }
              )
              return (
                <motion.div key={standup.id} variants={itemVariants}>
                  <Card className="border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="size-10 shrink-0">
                          <AvatarFallback className="text-xs font-semibold bg-emerald-100 text-emerald-700">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
                            <Badge variant="secondary" className="text-[10px]">
                              {role}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`${mood.bg} ${mood.color} border-0 text-[10px] gap-1`}
                            >
                              {mood.icon} {mood.label}
                            </Badge>
                            <span className="text-[11px] text-slate-400 ml-auto">{submittedAt}</span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> Ayer
                              </p>
                              <p className="text-sm text-slate-700">
                                {standup.yesterdayWork?.trim() || '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <TrendingUp className="size-3" /> Hoy
                              </p>
                              <p className="text-sm text-slate-700">
                                {standup.todayPlan?.trim() || '—'}
                              </p>
                            </div>
                            {blockers.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <AlertTriangle className="size-3" /> Blocker
                                </p>
                                <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{blockers}</p>
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

            {pendingMembers.length > 0 && (
              <motion.div variants={itemVariants}>
                <Card className="border-dashed border-slate-300 bg-slate-50/50">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                      <Clock className="size-4" /> Pendientes ({pendingMembers.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {pendingMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2"
                        >
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[9px] font-semibold bg-slate-100 text-slate-500">
                              {memberInitials(member.name)}
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

            {!isLoading && standups.length === 0 && teamMembers.length === 0 && teamId && (
              <p className="text-sm text-slate-500">No hay miembros en este equipo.</p>
            )}

            {!isLoading && standups.length === 0 && teamMembers.length > 0 && (
              <p className="text-sm text-slate-500">
                Nadie ha enviado standup hoy. Sé el primero.
              </p>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
