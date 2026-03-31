'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { getMemberProjects } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, User, Briefcase, Star } from 'lucide-react'
import { assignedProjectIdsFromMemberContext } from '@/lib/member-projects'

type ProfileProject = {
  id: string
  name: string
  description: string | null
  status: string
  teamId: string
  githubRepo: string | null
  jiraProjectKey: string | null
  teamName: string
}

type MemberProjectContext = {
  member: { id: string; name: string; role: string; email: string | null; teamId: string; defaultProjectId: string | null }
  defaultProject: ProfileProject | null
  projects: ProfileProject[]
}

export default function ProfileView() {
  const { currentMember, teams } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MemberProjectContext | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (!currentMember?.id) {
        if (!cancelled) setLoading(false)
        return
      }
      if (!cancelled) setLoading(true)
      try {
        const res = await getMemberProjects(currentMember.id)
        if (!cancelled && res.success && res.data) setData(res.data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentMember?.id])

  const otherAssignedProjects = useMemo(() => {
    if (!data?.projects?.length) return []
    const defId = data.defaultProject?.id
    if (!defId) return data.projects
    return data.projects.filter((p) => p.id !== defId)
  }, [data])

  const totalDistinctCount = useMemo(() => (data ? assignedProjectIdsFromMemberContext(data).length : 0), [data])

  const team = teams.find((t) => t.id === currentMember?.teamId)
  const initials = currentMember?.name
    ? currentMember.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DU'

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-4xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Identidad del usuario y contexto de proyectos asignados</p>
      </div>

      <Card className="border-slate-200/80 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Usuario actual</CardTitle>
          <CardDescription>Datos del miembro autenticado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-base font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold text-slate-900">{currentMember?.name || 'Usuario'}</p>
              <p className="text-sm text-slate-500">{currentMember?.role || 'Role'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="size-3" /> Email</p>
              <p className="text-sm text-slate-800 mt-1">{currentMember?.email || '-'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-slate-500 flex items-center gap-1"><User className="size-3" /> Equipo</p>
              <p className="text-sm text-slate-800 mt-1">{team?.name || 'Sin equipo'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-slate-500 flex items-center gap-1"><Briefcase className="size-3" /> Estado</p>
              <p className="text-sm text-slate-800 mt-1 capitalize">{currentMember?.status || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Proyectos asignados</CardTitle>
          <CardDescription>
            Mismos proyectos que en la vista Projects con filtro «All» (activo, pausado y completado). El predeterminado va arriba; debajo, el resto sin repetir id.
            {totalDistinctCount > 0 && (
              <span className="block mt-1 text-slate-600">{totalDistinctCount} proyecto(s) distinto(s) en total.</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !data ? (
            <p className="text-sm text-slate-500">No se pudo cargar el contexto de proyectos.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs text-emerald-700 flex items-center gap-1"><Star className="size-3" /> Proyecto por defecto</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-sm font-medium text-slate-900">{data.defaultProject?.name || 'No definido'}</p>
                  {data.defaultProject && (
                    <Badge variant="outline" className="text-[10px] shrink-0">{data.defaultProject.status}</Badge>
                  )}
                </div>
                {data.defaultProject && (
                  <p className="text-xs text-slate-500 mt-1">{data.defaultProject.teamName}</p>
                )}
                {data.defaultProject && (data.defaultProject.githubRepo || data.defaultProject.jiraProjectKey) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {data.defaultProject.githubRepo && (
                      <Badge variant="secondary" className="text-[10px] font-mono">{data.defaultProject.githubRepo}</Badge>
                    )}
                    {data.defaultProject.jiraProjectKey && (
                      <Badge variant="secondary" className="text-[10px] font-mono">Jira {data.defaultProject.jiraProjectKey}</Badge>
                    )}
                  </div>
                )}
              </div>
              {data.projects.length === 0 && !data.defaultProject ? (
                <p className="text-sm text-slate-500">Sin proyectos asignados.</p>
              ) : otherAssignedProjects.length === 0 ? (
                <p className="text-sm text-slate-500">No hay otros proyectos asignados además del predeterminado.</p>
              ) : (
                otherAssignedProjects.map((p) => (
                  <div key={p.id} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.teamName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.description || 'Sin descripción'}</p>
                      {(p.githubRepo || p.jiraProjectKey) && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.githubRepo && (
                            <Badge variant="outline" className="text-[10px] font-mono text-slate-600">{p.githubRepo}</Badge>
                          )}
                          {p.jiraProjectKey && (
                            <Badge variant="outline" className="text-[10px] font-mono text-slate-600">Jira {p.jiraProjectKey}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{p.status}</Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
