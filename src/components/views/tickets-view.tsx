'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import {
  createTicket,
  getMembers,
  getProjects,
  getProjectWorkflows,
  getTeams,
  getTicket,
  getTicketMessages,
  getTickets,
  runTicketAiAction,
  sendTicketMessage,
  updateTicketExternalLinks,
  updateTicket,
} from '@/lib/api'
import type { Project, TeamMember, Ticket, TicketMessage, TicketWorkflow } from '@/types'
import { ticketCreatorLine } from '@/lib/ticket-display'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { LayoutGrid, MessageSquare, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const priorities = ['low', 'medium', 'high', 'critical']

export default function TicketsView() {
  const { currentMember, setCurrentView } = useAppStore()

  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [teamProjects, setTeamProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createProjectId, setCreateProjectId] = useState('')
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [detailWorkflows, setDetailWorkflows] = useState<TicketWorkflow[]>([])
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([])
  const [ticketMessageValue, setTicketMessageValue] = useState('')
  const [externalRefsInput, setExternalRefsInput] = useState('')
  const [ticketChatLoading, setTicketChatLoading] = useState(false)
  const [isRunningAi, setIsRunningAi] = useState(false)

  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium',
    estimate: '',
    assigneeMemberId: '',
    targetTeamId: '',
  })

  const teamId = currentMember?.teamId

  useEffect(() => {
    if (projectFilter === 'all') return
    if (teamProjects.length > 0 && !teamProjects.some((p) => p.id === projectFilter)) {
      setProjectFilter('all')
    }
  }, [teamProjects, projectFilter])

  useEffect(() => {
    setProjectFilter('all')
    setSearch('')
    setAllTickets([])
    if (!teamId) {
      setIsLoading(false)
      return
    }
    const run = async () => {
      setIsLoading(true)
      try {
        const [tRes, pRes, mRes, teamsRes] = await Promise.all([
          getTickets({ teamId }),
          getProjects(teamId),
          getMembers(teamId),
          getTeams(),
        ])
        if (tRes.success && Array.isArray(tRes.data)) setAllTickets(tRes.data as Ticket[])
        else setAllTickets([])
        if (pRes.success && Array.isArray(pRes.data)) {
          const pl = pRes.data as Project[]
          setTeamProjects(pl)
          setCreateProjectId((prev) => {
            if (prev && pl.some((p) => p.id === prev)) return prev
            return pl[0]?.id || ''
          })
        }
        if (mRes.success && Array.isArray(mRes.data)) setMembers(mRes.data as TeamMember[])
        if (teamsRes.success && Array.isArray(teamsRes.data)) {
          setTeams(
            (teamsRes.data as Array<{ id: string; name: string }>).map((x) => ({ id: x.id, name: x.name }))
          )
        }
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [teamId])

  const filtered = useMemo(() => {
    let rows = allTickets
    if (projectFilter !== 'all') rows = rows.filter((t) => t.projectId === projectFilter)
    const q = search.trim().toLowerCase()
    if (q)
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.project?.name || '').toLowerCase().includes(q)
      )
    return [...rows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [allTickets, projectFilter, search])

  const refreshListOnly = async () => {
    if (!teamId) return
    const tRes = await getTickets({ teamId })
    if (tRes.success && Array.isArray(tRes.data)) setAllTickets(tRes.data as Ticket[])
  }

  const handleCreateTicket = async () => {
    if (!teamId || !createProjectId || !newTicket.title.trim()) return
    const res = await createTicket({
      teamId,
      projectId: createProjectId,
      title: newTicket.title.trim(),
      description: newTicket.description.trim() || undefined,
      priority: newTicket.priority,
      estimate: newTicket.estimate || undefined,
      assigneeMemberId: newTicket.assigneeMemberId || undefined,
      targetTeamId: newTicket.targetTeamId || undefined,
      reporterMemberId: currentMember?.id || undefined,
      createdByType: 'member',
    })
    if (res.success) {
      toast.success('Ticket creado')
      setIsCreateOpen(false)
      setNewTicket({
        title: '',
        description: '',
        priority: 'medium',
        estimate: '',
        assigneeMemberId: '',
        targetTeamId: '',
      })
      await refreshListOnly()
    } else {
      toast.error(res.error || 'No se pudo crear el ticket')
    }
  }

  const handleUpdateTicketStatus = async (ticket: Ticket, statusId: string) => {
    const order = allTickets.filter(
      (x) => x.projectId === ticket.projectId && x.statusId === statusId && x.id !== ticket.id
    ).length
    const res = await updateTicket({
      id: ticket.id,
      statusId,
      order,
      transitionReason: 'Actualizado desde listado',
      actorType: 'user',
      actorName: currentMember?.name || 'User',
    })
    if (res.success && res.data) {
      await refreshListOnly()
      if (activeTicket?.id === ticket.id) setActiveTicket(res.data as Ticket)
    } else {
      toast.error(res.error || 'No se pudo actualizar el estado')
    }
  }

  const openTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket)
    setExternalRefsInput(ticket.externalRefs || '{"github":[],"jira":[]}')
    const wRes = await getProjectWorkflows(ticket.projectId)
    setDetailWorkflows(
      wRes.success && Array.isArray(wRes.data) ? (wRes.data as TicketWorkflow[]) : []
    )
    setTicketChatLoading(true)
    const msgs = await getTicketMessages(ticket.id)
    setTicketMessages((msgs.success && Array.isArray(msgs.data) ? msgs.data : []) as TicketMessage[])
    setTicketChatLoading(false)
  }

  const handleSendTicketMessage = async () => {
    if (!activeTicket || !ticketMessageValue.trim()) return
    const res = await sendTicketMessage(activeTicket.id, {
      senderId: currentMember?.id || null,
      senderName: currentMember?.name || 'User',
      senderType: 'member',
      content: ticketMessageValue.trim(),
    })
    if (res.success && res.data) {
      setTicketMessages((prev) => [...prev, res.data!])
      setTicketMessageValue('')
    } else {
      toast.error(res.error || 'No se pudo enviar el mensaje')
    }
  }

  const handleSaveExternalRefs = async () => {
    if (!activeTicket) return
    try {
      const parsed = JSON.parse(externalRefsInput)
      const res = await updateTicketExternalLinks(activeTicket.id, parsed)
      if (res.success) {
        toast.success('Enlaces externos actualizados')
        await refreshListOnly()
      } else {
        toast.error(res.error || 'No se pudieron guardar los enlaces')
      }
    } catch {
      toast.error('JSON inválido en enlaces externos')
    }
  }

  const runAi = async (action: 'summarize' | 'suggest_state' | 'estimate' | 'refine_description') => {
    if (!activeTicket) return
    const applyToTicket = action === 'estimate' || action === 'refine_description'
    setIsRunningAi(true)
    const res = await runTicketAiAction(activeTicket.id, action, { applyToTicket })
    setIsRunningAi(false)
    if (!res.success || !res.data) {
      toast.error(res.error || 'No se pudo ejecutar IA')
      return
    }

    const ai = res.data as {
      summary?: string
      suggestedStatusId?: string
      needsEstimate?: boolean
      estimateSuggestion?: string
      nextSteps?: string[]
      risks?: string[]
      refinedDescription?: string
      applied?: { estimate?: string; description?: string }
    }
    const lines: string[] = []
    if (ai.summary) lines.push(`**Resumen:** ${ai.summary}`)
    if (ai.refinedDescription) {
      lines.push(
        `**Descripción refinada:**\n\n${ai.refinedDescription}`
      )
    }
    if (ai.estimateSuggestion) lines.push(`**Estimación sugerida:** ${ai.estimateSuggestion}`)
    if (ai.applied?.estimate) lines.push(`*(Estimación guardada en el ticket: ${ai.applied.estimate})*`)
    if (ai.applied?.description) lines.push('*(Descripción del ticket actualizada.)*')
    if (Array.isArray(ai.nextSteps) && ai.nextSteps.length > 0)
      lines.push(`**Siguientes pasos:** ${ai.nextSteps.join(' | ')}`)
    if (Array.isArray(ai.risks) && ai.risks.length > 0)
      lines.push(`**Riesgos:** ${ai.risks.join(' | ')}`)
    if (ai.needsEstimate) lines.push('**Pendiente estimación**')
    if (ai.suggestedStatusId) {
      const s = detailWorkflows.find((w) => w.id === ai.suggestedStatusId)
      if (s) lines.push(`**Estado sugerido:** ${s.name}`)
    }

    if (applyToTicket && (ai.applied?.description || ai.applied?.estimate)) {
      const tRes = await getTicket(activeTicket.id)
      if (tRes.success && tRes.data) setActiveTicket(tRes.data as Ticket)
      await refreshListOnly()
    }

    const aiRes = await sendTicketMessage(activeTicket.id, {
      senderName: 'Dayless.ai',
      senderType: 'ai',
      content: lines.length > 0 ? lines.join('\n\n') : 'No hay cambios sugeridos por IA.',
      metadata: ai,
    })
    if (aiRes.success && aiRes.data) {
      setTicketMessages((prev) => [...prev, aiRes.data!])
      toast.success(action === 'refine_description' ? 'Descripción refinada' : 'Análisis IA completado')
    }
  }

  if (!teamId) {
    return (
      <div className="p-6 text-sm text-slate-500">Selecciona un equipo para ver los tickets.</div>
    )
  }

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Todos los tickets del equipo, de todos los proyectos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCurrentView('kanban')} className="touch-manipulation min-h-11">
            <LayoutGrid className="size-4 mr-1" /> Kanban
          </Button>
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-48 min-h-11"
          />
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[200px] min-h-11">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {teamProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-11">
                <Plus className="size-4 mr-1" /> Nuevo ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear ticket</DialogTitle>
                <DialogDescription>Elige el proyecto y los datos del ticket.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Proyecto</Label>
                  <Select value={createProjectId} onValueChange={setCreateProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={newTicket.title}
                    onChange={(e) => setNewTicket((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea
                    value={newTicket.description}
                    onChange={(e) => setNewTicket((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Prioridad</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(v) => setNewTicket((prev) => ({ ...prev, priority: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estimación</Label>
                    <Input
                      placeholder="ej. 3d"
                      value={newTicket.estimate}
                      onChange={(e) => setNewTicket((prev) => ({ ...prev, estimate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Asignado a</Label>
                    <Select
                      value={newTicket.assigneeMemberId || 'unassigned'}
                      onValueChange={(v) =>
                        setNewTicket((prev) => ({ ...prev, assigneeMemberId: v === 'unassigned' ? '' : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Equipo objetivo</Label>
                    <Select
                      value={newTicket.targetTeamId || 'same-team'}
                      onValueChange={(v) =>
                        setNewTicket((prev) => ({ ...prev, targetTeamId: v === 'same-team' ? '' : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same-team">Sin equipo específico</SelectItem>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateTicket} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              {allTickets.length === 0 ? (
                <p className="text-sm text-slate-500">No hay tickets en este equipo. Crea uno con «Nuevo ticket» o desde el chat.</p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    Ningún ticket coincide con el proyecto o la búsqueda activos.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 touch-manipulation"
                    onClick={() => {
                      setSearch('')
                      setProjectFilter('all')
                    }}
                  >
                    Quitar filtros
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="font-semibold text-slate-900 min-w-[200px]">Ticket</TableHead>
                    <TableHead className="font-semibold text-slate-900">Proyecto</TableHead>
                    <TableHead className="font-semibold text-slate-900">Estado</TableHead>
                    <TableHead className="font-semibold text-slate-900">Prioridad</TableHead>
                    <TableHead className="font-semibold text-slate-900 min-w-[160px]">Origen</TableHead>
                    <TableHead className="font-semibold text-slate-900 text-right">Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-slate-50/90"
                      onClick={() => openTicket(t)}
                    >
                      <TableCell>
                        <span className="font-medium text-slate-900 line-clamp-2">{t.title}</span>
                        <span className="block text-[11px] text-slate-400 font-mono mt-0.5">{t.id}</span>
                      </TableCell>
                      <TableCell className="text-slate-700">{t.project?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {t.status?.name || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="text-[10px] bg-slate-200 text-slate-700 border-0">{t.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{ticketCreatorLine(t)}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500 whitespace-nowrap">
                        {new Date(t.updatedAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!activeTicket} onOpenChange={(o) => !o && setActiveTicket(null)}>
        <SheetContent className="w-full sm:max-w-[680px] p-0">
          {activeTicket && (
            <div className="flex h-full flex-col">
              <SheetHeader className="p-6 border-b">
                <SheetTitle className="text-left">{activeTicket.title}</SheetTitle>
                <SheetDescription className="text-left space-y-1">
                  <span className="block">
                    {activeTicket.project?.name ? `Proyecto: ${activeTicket.project.name}` : ''}
                  </span>
                  Chat visible para el equipo. La IA interviene solo con Estimar / Refinar (y aplica al ticket).
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 border-b flex flex-wrap items-center gap-2">
                {detailWorkflows.length > 0 ? (
                  <Select
                    value={activeTicket.statusId}
                    onValueChange={(v) => handleUpdateTicketStatus(activeTicket, v)}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {detailWorkflows.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">Cargando estados…</Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => runAi('summarize')} disabled={isRunningAi}>
                  <Sparkles className="size-4 mr-1" /> Resumir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAi('suggest_state')}
                  disabled={isRunningAi}
                >
                  <Sparkles className="size-4 mr-1" /> Sugerir estado
                </Button>
                <Button variant="outline" size="sm" onClick={() => runAi('estimate')} disabled={isRunningAi}>
                  <Sparkles className="size-4 mr-1" /> Estimar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAi('refine_description')}
                  disabled={isRunningAi}
                >
                  <Sparkles className="size-4 mr-1" /> Refinar descripción
                </Button>
              </div>

              <div className="px-4 py-3 border-b space-y-2">
                <p className="text-xs text-slate-500">{ticketCreatorLine(activeTicket)}</p>
                <p className="text-sm text-slate-700">{activeTicket.description || 'Sin descripción'}</p>
              </div>

              <div className="px-4 py-3 border-b space-y-2">
                <Label className="text-xs text-slate-600">External refs (GitHub/Jira)</Label>
                <Textarea
                  rows={3}
                  value={externalRefsInput}
                  onChange={(e) => setExternalRefsInput(e.target.value)}
                  placeholder='{"github":[{"repo":"org/repo","number":12}],"jira":[{"key":"PROJ-123"}]}'
                  className="text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleSaveExternalRefs}>
                  Guardar enlaces
                </Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-3 min-h-[200px]">
                {ticketChatLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticketMessages.map((m) => (
                      <div key={m.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                          <span>{m.senderName}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {m.senderType}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))}
                    {ticketMessages.length === 0 && (
                      <div className="text-sm text-slate-500">No hay mensajes todavía para este ticket.</div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t mt-auto">
                <div className="flex gap-2">
                  <Input
                    value={ticketMessageValue}
                    onChange={(e) => setTicketMessageValue(e.target.value)}
                    placeholder="Escribe contexto para refinamiento..."
                    className="min-h-11"
                  />
                  <Button
                    onClick={handleSendTicketMessage}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 min-h-11 min-w-11 px-4"
                  >
                    <MessageSquare className="size-4 mr-1" /> Enviar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
