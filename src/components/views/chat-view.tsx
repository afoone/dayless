'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import {
  getMessages,
  sendChatMessage,
  confirmChatTicket,
  getMembers,
  getMemberProjects,
  broadcastProjectStandup,
  getProjectStandupSummary,
  postChatThreadMessage,
} from '@/lib/api'
import type { Message, TeamMember, Project, PendingInternalTicketConfirm } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Send, Bot, MoreVertical, Phone, Video, Search, Hash,
  AlertCircle, HelpCircle, RefreshCw, Circle, Users, Ticket, ClipboardList,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

interface DisplayMessage {
  id: string
  senderName: string
  senderType: 'member' | 'ai' | 'system'
  content: string
  createdAt: Date
  pendingTicketConfirm?: PendingInternalTicketConfirm
}

const quickActions = [
  { label: 'Rellenar standup', icon: RefreshCw, prefix: '/standup' },
  { label: 'Standup al equipo', icon: Users, prefix: '/standup-equipo' },
  { label: 'Resumen standup hoy', icon: ClipboardList, prefix: '/standup-resumen' },
  { label: 'Blocker', icon: AlertCircle, prefix: '/blocker ' },
  { label: 'Question', icon: HelpCircle, prefix: '/question ' },
  { label: 'Update', icon: Hash, prefix: '/update ' },
  { label: 'Mis tickets', icon: Ticket, prefix: '/mis-tickets ' },
]

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex items-start gap-3 px-4 md:px-6">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
        <Bot className="size-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 0.15, 0.3].map((delay, i) => (
            <motion.div key={i} className="size-2 rounded-full bg-slate-400" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay }} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default function ChatView() {
  const { currentMember, contextProjectId, setContextProjectId, setCurrentView, requestOpenStandupDialog } =
    useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [confirmingTicketMessageId, setConfirmingTicketMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Proyectos del miembro + alinear contextProjectId con asignaciones
  useEffect(() => {
    const teamId = currentMember?.teamId
    const ownerId = currentMember?.id
    if (!teamId || !ownerId) {
      setProjects([])
      return
    }
    getMemberProjects(ownerId)
      .then((projectsRes) => {
        if (!projectsRes.success || !projectsRes.data) return
        const raw = projectsRes.data.projects
        const list = Array.isArray(raw) ? (raw as unknown as Project[]) : []
        const def = projectsRes.data.defaultProject as unknown as Project | null | undefined
        const merged =
          def && !list.some((p) => p.id === def.id) ? [def, ...list] : list
        setProjects(merged)
        const { contextProjectId: ctx, setContextProjectId: setCtx } = useAppStore.getState()
        const valid = Boolean(ctx && merged.some((p) => p.id === ctx))
        if (merged.length === 0) {
          setCtx(null)
        } else if (!valid) {
          const defId = projectsRes.data.member?.defaultProjectId
          const pick = defId ? merged.find((p) => p.id === defId) : merged[0]
          setCtx((pick ?? merged[0]).id)
        }
      })
      .catch(console.error)
  }, [currentMember?.teamId, currentMember?.id])

  // Historial del hilo (miembro + proyecto)
  useEffect(() => {
    const teamId = currentMember?.teamId
    const ownerId = currentMember?.id
    const projectId = contextProjectId
    if (!teamId || !ownerId || !projectId) {
      setIsLoading(false)
      setMessages([])
      return
    }
    setIsLoading(true)
    setMessages([])

    Promise.all([
      getMessages(teamId, ownerId, projectId, 100),
      getMembers(teamId),
    ]).then(([msgsResult, membersResult]) => {
      if (msgsResult.success && msgsResult.data) {
        const rawMsgs = Array.isArray(msgsResult.data) ? msgsResult.data : []
        setMessages(rawMsgs.map((m: Message) => ({
          id: m.id,
          senderName: m.senderName,
          senderType: m.senderType as 'member' | 'ai' | 'system',
          content: m.content,
          createdAt: new Date(m.createdAt),
        })))
      }
      if (membersResult.success && membersResult.data) {
        setMembers(membersResult.data)
      }
    }).catch(console.error).finally(() => setIsLoading(false))
  }, [currentMember?.teamId, currentMember?.id, contextProjectId])

  const handleDismissTicketDraft = useCallback((proposalMessageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === proposalMessageId ? { ...m, pendingTicketConfirm: undefined } : m
      )
    )
    toast.message('Borrador descartado')
  }, [])

  const handleConfirmTicketDraft = useCallback(
    async (draft: PendingInternalTicketConfirm, proposalMessageId: string) => {
      const teamId = currentMember?.teamId
      const ownerMemberId = currentMember?.id
      const projectId = contextProjectId
      if (!teamId || !ownerMemberId || !projectId) return
      setConfirmingTicketMessageId(proposalMessageId)
      try {
        const res = await confirmChatTicket(
          teamId,
          ownerMemberId,
          projectId,
          currentMember?.id || null,
          currentMember?.name || 'Usuario',
          draft
        )
        if (res.success && res.data) {
          setMessages((prev) => {
            const cleared = prev.map((m) =>
              m.id === proposalMessageId ? { ...m, pendingTicketConfirm: undefined } : m
            )
            return [
              ...cleared,
              {
                id: res.data!.userMessage.id,
                senderName: res.data!.userMessage.senderName,
                senderType: res.data!.userMessage.senderType as 'member' | 'ai' | 'system',
                content: res.data!.userMessage.content,
                createdAt: new Date(res.data!.userMessage.createdAt),
              },
              {
                id: res.data!.aiMessage.id,
                senderName: res.data!.aiMessage.senderName,
                senderType: 'ai',
                content: res.data!.aiMessage.content,
                createdAt: new Date(res.data!.aiMessage.createdAt),
              },
            ]
          })
          toast.success('Ticket creado')
        } else {
          toast.error(res.error || 'No se pudo crear el ticket')
        }
      } catch {
        toast.error('Error de conexión al crear el ticket')
      } finally {
        setConfirmingTicketMessageId(null)
      }
    },
    [currentMember, contextProjectId]
  )

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, isTyping, scrollToBottom])

  const handleSend = async () => {
    const teamId = currentMember?.teamId
    const ownerMemberId = currentMember?.id
    const projectId = contextProjectId
    const rawTrim = inputValue.trim()
    if (!rawTrim || isTyping) return

    // Solo `/standup` (sin texto extra): ir al formulario real, no al LLM
    if (/^\/standup\s*$/i.test(rawTrim)) {
      if (!teamId || !ownerMemberId) return
      setInputValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      requestOpenStandupDialog()
      setCurrentView('standup')
      toast.info('Te llevamos al formulario de standup')
      return
    }

    if (/^\/standup-equipo\s*$/i.test(rawTrim)) {
      if (!teamId || !ownerMemberId || !projectId) {
        toast.error('Elige un proyecto en el selector del chat')
        return
      }
      setInputValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      const bRes = await broadcastProjectStandup(projectId, ownerMemberId)
      if (!bRes.success || !bRes.data) {
        toast.error(bRes.error || 'No se pudo notificar al equipo')
        return
      }
      toast.success(`Aviso de standup enviado a ${bRes.data.notified} persona(s) en su chat de este proyecto`)
      return
    }

    if (/^\/standup-resumen\s*$/i.test(rawTrim)) {
      if (!teamId || !ownerMemberId || !projectId) {
        toast.error('Elige un proyecto en el selector del chat')
        return
      }
      setInputValue('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      const sRes = await getProjectStandupSummary(projectId, ownerMemberId)
      if (!sRes.success || !sRes.data) {
        toast.error(sRes.error || 'No se pudo cargar el resumen')
        return
      }
      const postRes = await postChatThreadMessage({
        teamId,
        ownerMemberId,
        projectId,
        senderName: 'Dayless',
        senderType: 'system',
        content: sRes.data.markdown,
      })
      if (postRes.success && postRes.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: postRes.data!.id,
            senderName: postRes.data!.senderName,
            senderType: 'system' as const,
            content: postRes.data!.content,
            createdAt: new Date(postRes.data!.createdAt),
          },
        ])
        toast.success('Resumen de standup añadido al hilo')
      } else {
        toast.error(postRes.error || 'No se pudo guardar el resumen en el chat')
      }
      return
    }

    if (!teamId || !ownerMemberId || !projectId) return

    const content = rawTrim
    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Optimistically add user message
    const userMsg: DisplayMessage = {
      id: `local-${Date.now()}`,
      senderName: currentMember?.name || 'Tú',
      senderType: 'member',
      content,
      createdAt: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    setIsTyping(true)
    try {
      const result = await sendChatMessage(
        teamId,
        ownerMemberId,
        projectId,
        currentMember?.id || null,
        currentMember?.name || 'User',
        content,
      )
      if (result.success && result.data) {
        // Replace optimistic message with real one, add AI response
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== userMsg.id)
          return [
            ...filtered,
            {
              id: result.data!.userMessage.id,
              senderName: result.data!.userMessage.senderName,
              senderType: result.data!.userMessage.senderType as 'member' | 'ai' | 'system',
              content: result.data!.userMessage.content,
              createdAt: new Date(result.data!.userMessage.createdAt),
            },
            {
              id: result.data!.aiMessage.id,
              senderName: result.data!.aiMessage.senderName,
              senderType: 'ai',
              content: result.data!.aiMessage.content,
              createdAt: new Date(result.data!.aiMessage.createdAt),
              pendingTicketConfirm: result.data!.pendingTicketConfirm,
            },
          ]
        })
      } else {
        setInputValue(content)
        // Show error
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          senderName: 'System',
          senderType: 'system',
          content: `Error: ${result.error || 'No se pudo conectar con el AI'}`,
          createdAt: new Date(),
        }])
      }
    } catch {
      setInputValue(content)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        senderName: 'System',
        senderType: 'system',
        content: 'Error de conexión. Intenta de nuevo.',
        createdAt: new Date(),
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  const formatTime = (date: Date) => date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const statusColors = { active: 'bg-emerald-400', away: 'bg-amber-400', offline: 'bg-slate-300' }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Members Sidebar */}
      <AnimatePresence>
        {showMembers && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex flex-col border-r border-slate-200 bg-slate-50/50 overflow-hidden shrink-0"
          >
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">Team Members ({members.length})</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {/* AI member always shown */}
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-emerald-50 text-emerald-700">
                  <div className="relative shrink-0">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-emerald-500 text-white"><Bot className="size-4" /></AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">Dayless.ai</p>
                    <p className="text-[11px] text-emerald-500 truncate">Always online</p>
                  </div>
                </div>
                {members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 hover:bg-white hover:text-slate-800 transition-colors">
                    <div className="relative shrink-0">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px] font-semibold bg-slate-200 text-slate-600">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className={cn('absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white', statusColors[member.status])} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-white">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="hidden md:flex text-slate-400 hover:text-slate-600" onClick={() => setShowMembers(!showMembers)}>
              <Users className="size-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <Avatar className="size-9">
                <AvatarFallback className="bg-emerald-500 text-white"><Bot className="size-5" /></AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Dayless.ai</h3>
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0 px-1.5">AI</Badge>
                </div>
                <p className="text-[11px] text-emerald-500">Online · Chat por proyecto</p>
              </div>
            </div>
          </div>
          {projects.length > 0 && (
            <Select
              value={contextProjectId ?? ''}
              onValueChange={setContextProjectId}
            >
              <SelectTrigger className="w-[min(100%,220px)] h-9 text-xs border-slate-200">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/30 py-4 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw className="size-4" />
                </motion.div>
                Cargando mensajes...
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-sm text-slate-500">No tienes proyectos asignados en este equipo. Asigna uno en Equipo o Proyectos para usar el chat.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="size-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <Bot className="size-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Chat con Dayless.ai</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Solo tú ves este hilo en el proyecto seleccionado. Cambia de proyecto arriba para otro historial.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center py-2">
                <Separator className="flex-1 max-w-[100px]" />
                <span className="px-3 text-[11px] font-medium text-slate-400">Today</span>
                <Separator className="flex-1 max-w-[100px]" />
              </div>
              <AnimatePresence>
                {messages.map((message, index) => {
                  const isAI = message.senderType === 'ai'
                  const isSystem = message.senderType === 'system'
                  if (isSystem) {
                    const longSystem = message.content.includes('\n') || message.content.length > 160
                    if (longSystem) {
                      return (
                        <motion.div key={message.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 md:px-6 py-2">
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm prose prose-sm prose-slate max-w-none [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_p]:mb-1 [&_ul]:my-1">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        </motion.div>
                      )
                    }
                    return (
                      <motion.div key={message.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-2">
                        <Badge variant="secondary" className="text-[11px] font-normal bg-slate-200/50 text-slate-500 max-w-[95%] whitespace-normal text-center">{message.content}</Badge>
                      </motion.div>
                    )
                  }
                  const showAvatar = index === 0 || messages[index - 1].senderName !== message.senderName
                  return (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                      className={cn('flex items-start gap-3 px-4 md:px-6', !isAI && 'flex-row-reverse')}
                    >
                      <div className="shrink-0 mt-1">
                        {showAvatar ? (
                          <Avatar className={cn('size-8', isAI && 'ring-2 ring-emerald-200')}>
                            <AvatarFallback className={cn('text-xs font-semibold', isAI ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')}>
                              {isAI ? <Bot className="size-4" /> : getInitials(message.senderName)}
                            </AvatarFallback>
                          </Avatar>
                        ) : <div className="w-8" />}
                      </div>
                      <div className={cn('max-w-[70%] min-w-0', !isAI && 'flex flex-col items-end')}>
                        {showAvatar && (
                          <div className={cn('flex items-center gap-2 mb-1', !isAI && 'flex-row-reverse')}>
                            <span className="text-xs font-medium text-slate-600">{message.senderName}</span>
                            <span className="text-[10px] text-slate-400">{formatTime(message.createdAt)}</span>
                          </div>
                        )}
                        <div className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                          isAI ? 'rounded-tl-sm bg-white text-slate-700 shadow-sm border border-slate-100' : 'rounded-tr-sm bg-emerald-600 text-white'
                        )}>
                          {isAI ? (
                            <div className="prose prose-sm prose-slate max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-slate-900 [&_code]:text-emerald-600 [&_code]:bg-emerald-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-1">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>
                        {isAI && message.pendingTicketConfirm && (
                          <div className="mt-3 w-full max-w-md space-y-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Confirmar ticket
                            </p>
                            <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                              {message.pendingTicketConfirm.title}
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-6 whitespace-pre-wrap leading-relaxed">
                              {message.pendingTicketConfirm.description}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Prioridad: <span className="font-medium text-slate-700">{message.pendingTicketConfirm.priority}</span>
                              {message.pendingTicketConfirm.project ? (
                                <> · Proyecto: <span className="font-medium text-slate-700">{message.pendingTicketConfirm.project}</span></>
                              ) : null}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                className="min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={confirmingTicketMessageId === message.id}
                                onClick={() =>
                                  handleConfirmTicketDraft(message.pendingTicketConfirm!, message.id)
                                }
                              >
                                <Ticket className="size-4 mr-1.5" />
                                Crear ticket
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 border-slate-200 text-slate-700"
                                disabled={confirmingTicketMessageId === message.id}
                                onClick={() => handleDismissTicketDraft(message.id)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </>
          )}
          <AnimatePresence>{isTyping && <TypingIndicator />}</AnimatePresence>
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            {quickActions.map(action => (
              <TooltipProvider key={action.label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setInputValue(action.prefix)}
                      className="h-7 px-2 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
                      <action.icon className="size-3 mr-1" />{action.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{action.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef} value={inputValue} onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje... (Shift+Enter para nueva línea)"
              className="flex-1 min-h-[44px] max-h-[160px] resize-none rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-400"
              rows={1}
            />
            <Button onClick={handleSend} disabled={!inputValue.trim() || isTyping || !currentMember?.teamId || !currentMember?.id || !contextProjectId}
              className="h-11 w-11 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
