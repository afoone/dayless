'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import {
  createTicket,
  getMemberProjects,
  getMembers,
  getTeams,
  getProjectWorkflows,
  getTicketMessages,
  getTickets,
  runTicketAiAction,
  saveProjectWorkflows,
  sendTicketMessage,
  updateTicketExternalLinks,
  updateTicket,
} from '@/lib/api'
import type { Project, TeamMember, Ticket, TicketMessage, TicketWorkflow } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { LayoutList, MessageSquare, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { ticketCreatorLine } from '@/lib/ticket-display'

const defaultWorkflowTemplate: Array<Partial<TicketWorkflow>> = [
  { name: 'Nuevo', position: 0, color: '#64748b' },
  { name: 'En curso', position: 1, color: '#10b981' },
  { name: 'Mitad', position: 2, color: '#f59e0b' },
  { name: 'QA', position: 3, color: '#8b5cf6', isQa: true },
  { name: 'Hecho', position: 4, color: '#16a34a', isDone: true },
  { name: 'Rechazado', position: 5, color: '#ef4444', isDone: true },
]

const priorities = ['low', 'medium', 'high', 'critical']

export default function KanbanView() {
  const { currentMember, setCurrentView } = useAppStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [teams, setTeams] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [workflows, setWorkflows] = useState<TicketWorkflow[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
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
    progress: '',
    assigneeMemberId: '',
    targetTeamId: '',
  })

  const grouped = useMemo(() => {
    const base: Record<string, Ticket[]> = {}
    for (const wf of workflows) base[wf.id] = []
    for (const t of tickets) {
      if (!base[t.statusId]) base[t.statusId] = []
      base[t.statusId].push(t)
    }
    for (const k of Object.keys(base)) {
      base[k] = base[k].sort((a, b) => (a.order || 0) - (b.order || 0))
    }
    return base
  }, [workflows, tickets])

  useEffect(() => {
    const teamId = currentMember?.teamId
    if (!currentMember?.id || !teamId) return
    Promise.all([getMemberProjects(currentMember.id), getMembers(teamId), getTeams()])
      .then(async ([projectsRes, membersRes, teamsRes]) => {
        if (projectsRes.success && projectsRes.data) {
          const raw = projectsRes.data.projects
          const list = Array.isArray(raw) ? (raw as unknown as Project[]) : []
          const def = projectsRes.data.defaultProject as unknown as Project | null | undefined
          const merged =
            def && !list.some((p) => p.id === def.id) ? [def, ...list] : list
          setProjects(merged)
          if (merged.length > 0 && !selectedProjectId) {
            const defId = projectsRes.data.member?.defaultProjectId
            const pick = defId ? merged.find((p) => p.id === defId) : merged[0]
            setSelectedProjectId((pick ?? merged[0]).id)
          }
        }
        if (membersRes.success && Array.isArray(membersRes.data)) {
          setMembers(membersRes.data as TeamMember[])
        }
        if (teamsRes.success && Array.isArray(teamsRes.data)) {
          setTeams(teamsRes.data as Array<{ id: string; name: string; color: string }>)
        }
      })
      .finally(() => setIsLoading(false))
  }, [currentMember?.id, currentMember?.teamId, selectedProjectId])

  useEffect(() => {
    const teamId = currentMember?.teamId
    if (!teamId || !selectedProjectId) return

    const boot = async () => {
      setIsLoading(true)
      const workflowsRes = await getProjectWorkflows(selectedProjectId)
      let statusList = (workflowsRes.success && workflowsRes.data ? workflowsRes.data : []) as TicketWorkflow[]

      if (statusList.length === 0) {
        const created = await saveProjectWorkflows(selectedProjectId, defaultWorkflowTemplate)
        statusList = (created.success && created.data ? created.data : []) as TicketWorkflow[]
      }
      setWorkflows(statusList)

      const ticketsRes = await getTickets({ teamId, projectId: selectedProjectId })
      setTickets((ticketsRes.success && Array.isArray(ticketsRes.data) ? ticketsRes.data : []) as Ticket[])
      setIsLoading(false)
    }

    boot()
  }, [currentMember?.teamId, selectedProjectId])

  const refreshProjectData = async () => {
    const teamId = currentMember?.teamId
    if (!teamId || !selectedProjectId) return
    const [workflowsRes, ticketsRes] = await Promise.all([
      getProjectWorkflows(selectedProjectId),
      getTickets({ teamId, projectId: selectedProjectId }),
    ])
    if (workflowsRes.success && workflowsRes.data) setWorkflows(workflowsRes.data)
    if (ticketsRes.success && ticketsRes.data) setTickets(ticketsRes.data)
  }

  const handleCreateTicket = async () => {
    const teamId = currentMember?.teamId
    if (!teamId || !selectedProjectId || !newTicket.title.trim()) return
    const res = await createTicket({
      teamId,
      projectId: selectedProjectId,
      title: newTicket.title.trim(),
      description: newTicket.description.trim() || undefined,
      priority: newTicket.priority,
      estimate: newTicket.estimate || undefined,
      progress: newTicket.progress || undefined,
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
        progress: '',
        assigneeMemberId: '',
        targetTeamId: '',
      })
      await refreshProjectData()
    } else {
      toast.error(res.error || 'No se pudo crear el ticket')
    }
  }

  const handleUpdateTicketStatus = async (ticket: Ticket, statusId: string) => {
    const order = grouped[statusId]?.length || 0
    const res = await updateTicket({
      id: ticket.id,
      statusId,
      order,
      transitionReason: 'Actualizado desde tablero',
      actorType: 'user',
      actorName: currentMember?.name || 'User',
    })
    if (res.success && res.data) {
      await refreshProjectData()
      if (activeTicket?.id === ticket.id) setActiveTicket(res.data)
    } else {
      toast.error(res.error || 'No se pudo actualizar el estado')
    }
  }

  const openTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket)
    setExternalRefsInput(ticket.externalRefs || '{"github":[],"jira":[]}')
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
      setTicketMessages(prev => [...prev, res.data!])
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
        await refreshProjectData()
      } else {
        toast.error(res.error || 'No se pudieron guardar los enlaces')
      }
    } catch {
      toast.error('JSON inválido en enlaces externos')
    }
  }

  const runAi = async (action: 'summarize' | 'suggest_state' | 'estimate') => {
    if (!activeTicket) return
    setIsRunningAi(true)
    const res = await runTicketAiAction(activeTicket.id, action)
    setIsRunningAi(false)
    if (!res.success || !res.data) {
      toast.error(res.error || 'No se pudo ejecutar IA')
      return
    }

    const ai = res.data as { summary?: string; suggestedStatusId?: string; needsEstimate?: boolean; estimateSuggestion?: string; nextSteps?: string[]; risks?: string[] }
    const lines: string[] = []
    if (ai.summary) lines.push(`**Resumen:** ${ai.summary}`)
    if (ai.estimateSuggestion) lines.push(`**Estimación sugerida:** ${ai.estimateSuggestion}`)
    if (Array.isArray(ai.nextSteps) && ai.nextSteps.length > 0) lines.push(`**Siguientes pasos:** ${ai.nextSteps.join(' | ')}`)
    if (Array.isArray(ai.risks) && ai.risks.length > 0) lines.push(`**Riesgos:** ${ai.risks.join(' | ')}`)
    if (ai.needsEstimate) lines.push('**Pendiente estimación**')
    if (ai.suggestedStatusId) {
      const s = workflows.find(w => w.id === ai.suggestedStatusId)
      if (s) lines.push(`**Estado sugerido:** ${s.name}`)
    }

    const aiRes = await sendTicketMessage(activeTicket.id, {
      senderName: 'Dayless.ai',
      senderType: 'ai',
      content: lines.length > 0 ? lines.join('\n\n') : 'No hay cambios sugeridos por IA.',
      metadata: ai,
    })
    if (aiRes.success && aiRes.data) {
      setTicketMessages(prev => [...prev, aiRes.data!])
      toast.success('Análisis IA completado')
    }
  }

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kanban</h1>
          <p className="text-sm text-slate-500 mt-1">Tablero por proyecto: arrastra estados y abre el detalle con chat e IA</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setCurrentView('tickets')} className="min-h-11">
            <LayoutList className="size-4 mr-1" /> Todos los tickets
          </Button>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecciona proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="size-4 mr-1" /> Nuevo Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear ticket interno</DialogTitle>
                <DialogDescription>Se guardará en el proyecto seleccionado.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={newTicket.title} onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea value={newTicket.description} onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))} rows={4} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Prioridad</Label>
                    <Select value={newTicket.priority} onValueChange={(v) => setNewTicket(prev => ({ ...prev, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estimación</Label>
                    <Input placeholder="ej. 3d / 5 pts" value={newTicket.estimate} onChange={(e) => setNewTicket(prev => ({ ...prev, estimate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Asignado a</Label>
                    <Select value={newTicket.assigneeMemberId || 'unassigned'} onValueChange={(v) => setNewTicket(prev => ({ ...prev, assigneeMemberId: v === 'unassigned' ? '' : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Equipo objetivo</Label>
                  <Select value={newTicket.targetTeamId || 'same-team'} onValueChange={(v) => setNewTicket(prev => ({ ...prev, targetTeamId: v === 'same-team' ? '' : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same-team">Sin equipo específico</SelectItem>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateTicket} className="bg-emerald-600 hover:bg-emerald-700 text-white">Crear</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : workflows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-slate-500">No hay estados configurados para este proyecto.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {workflows.map((wf) => (
            <Card key={wf.id} className="border-slate-200/80 bg-white shadow-sm min-h-[280px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: wf.color || '#10b981' }} />
                    {wf.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{grouped[wf.id]?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(grouped[wf.id] || []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openTicket(t)}
                    className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors p-3"
                  >
                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{t.title}</p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{ticketCreatorLine(t)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge className="text-[10px] bg-slate-200 text-slate-700 border-0">{t.priority}</Badge>
                      <div className="flex items-center gap-2">
                        {t.targetTeam?.name && (
                          <Badge variant="outline" className="text-[10px]">
                            {t.targetTeam.name}
                          </Badge>
                        )}
                        <span className="text-[11px] text-slate-500">{t.estimate || 'sin estimar'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!activeTicket} onOpenChange={(o) => !o && setActiveTicket(null)}>
        <SheetContent className="w-full sm:max-w-[680px] p-0">
          {activeTicket && (
            <div className="flex h-full flex-col">
              <SheetHeader className="p-6 border-b">
                <SheetTitle className="text-left">{activeTicket.title}</SheetTitle>
                <SheetDescription className="text-left">
                  Detalle, estado y chat de refinamiento del ticket
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 border-b flex flex-wrap items-center gap-2">
                <Select value={activeTicket.statusId} onValueChange={(v) => handleUpdateTicketStatus(activeTicket, v)}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workflows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => runAi('summarize')} disabled={isRunningAi}>
                  <Sparkles className="size-4 mr-1" /> Resumir
                </Button>
                <Button variant="outline" size="sm" onClick={() => runAi('suggest_state')} disabled={isRunningAi}>
                  <Sparkles className="size-4 mr-1" /> Sugerir estado
                </Button>
                <Button variant="outline" size="sm" onClick={() => runAi('estimate')} disabled={isRunningAi}>
                  <Sparkles className="size-4 mr-1" /> Estimar
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
                <Button variant="outline" size="sm" onClick={handleSaveExternalRefs}>Guardar enlaces</Button>
              </div>

              <ScrollArea className="flex-1 px-4 py-3">
                {ticketChatLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticketMessages.map((m) => (
                      <div key={m.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                          <span>{m.senderName}</span>
                          <Badge variant="outline" className="text-[10px]">{m.senderType}</Badge>
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

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={ticketMessageValue}
                    onChange={(e) => setTicketMessageValue(e.target.value)}
                    placeholder="Escribe contexto para refinamiento, estimación o QA..."
                  />
                  <Button onClick={handleSendTicketMessage} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
