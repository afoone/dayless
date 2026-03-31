'use client'

import { motion } from 'framer-motion'
import { useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  Bot,
  Bell,
  Globe,
  Clock,
  Shield,
  Palette,
  Link2,
  Github,
  Save,
  Mail,
  MessageSquare,
  Calendar,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { getMemberProjects, getProjectWorkflows, saveProjectWorkflows } from '@/lib/api'
import type { Project, TicketWorkflow } from '@/types'
import { toast } from 'sonner'

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function SettingsView() {
  const { currentMember } = useAppStore()
  const [standupTime, setStandupTime] = useState('09:00')
  const [standupReminder, setStandupReminder] = useState(true)
  const [reportTime, setReportTime] = useState('18:00')
  const [dailyReport, setDailyReport] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [workflowProjectId, setWorkflowProjectId] = useState('')
  const [workflows, setWorkflows] = useState<Array<Partial<TicketWorkflow>>>([])
  const [workflowLoading, setWorkflowLoading] = useState(false)

  useEffect(() => {
    if (!currentMember?.id) return
    getMemberProjects(currentMember.id).then((res) => {
      if (res.success && res.data && Array.isArray(res.data.projects)) {
        const list = res.data.projects as unknown as Project[]
        setProjects(list)
        if (list.length > 0) {
          setWorkflowLoading(true)
          setWorkflowProjectId((prev) => prev || list[0].id)
        }
      }
    })
  }, [currentMember?.id])

  useEffect(() => {
    if (!workflowProjectId) return
    getProjectWorkflows(workflowProjectId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const rows = (res.data as TicketWorkflow[]).map((w) => ({
            id: w.id,
            name: w.name,
            color: w.color,
            position: w.position,
            isDone: w.isDone,
            isQa: w.isQa,
          }))
          setWorkflows(rows)
        } else {
          setWorkflows([])
        }
      })
      .finally(() => setWorkflowLoading(false))
  }, [workflowProjectId])

  const addWorkflow = () => {
    setWorkflows((prev) => [
      ...prev,
      {
        name: `Nuevo estado ${prev.length + 1}`,
        color: '#10b981',
        isDone: false,
        isQa: false,
        position: prev.length,
      },
    ])
  }

  const updateWorkflow = (idx: number, patch: Partial<TicketWorkflow>) => {
    setWorkflows((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)))
  }

  const removeWorkflow = (idx: number) => {
    setWorkflows((prev) => prev.filter((_, i) => i !== idx).map((w, i) => ({ ...w, position: i })))
  }

  const moveWorkflow = (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= workflows.length) return
    const copy = [...workflows]
    const tmp = copy[idx]
    copy[idx] = copy[next]
    copy[next] = tmp
    setWorkflows(copy.map((w, i) => ({ ...w, position: i })))
  }

  const saveWorkflowConfig = async () => {
    if (!workflowProjectId) return
    const cleaned = workflows
      .map((w, i) => ({
        id: w.id,
        name: String(w.name || '').trim(),
        color: w.color || '#10b981',
        isDone: Boolean(w.isDone),
        isQa: Boolean(w.isQa),
        position: i,
      }))
      .filter((w) => w.name.length > 0)

    if (cleaned.length === 0) {
      toast.error('Debes definir al menos un estado')
      return
    }

    const res = await saveProjectWorkflows(workflowProjectId, cleaned)
    if (res.success && res.data) {
      toast.success('Workflow de tickets guardado')
      const rows = (res.data as TicketWorkflow[]).map((w) => ({
        id: w.id,
        name: w.name,
        color: w.color,
        position: w.position,
        isDone: w.isDone,
        isQa: w.isQa,
      }))
      setWorkflows(rows)
    } else {
      toast.error(res.error || 'No se pudo guardar el workflow')
    }
  }

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-3xl" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your Dayless.ai preferences</p>
      </motion.div>

      {/* AI Configuration */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50">
                <Bot className="size-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Dayless.ai</CardTitle>
                <CardDescription>Configure the AI agent behavior</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>AI Personality</Label>
              <Select defaultValue="professional">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional & Direct</SelectItem>
                  <SelectItem value="friendly">Friendly & Casual</SelectItem>
                  <SelectItem value="detailed">Detailed & Thorough</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select defaultValue="es">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="mixed">Mixed (detect automatically)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-learn from conversations</Label>
                <p className="text-xs text-slate-400">Automatically save useful info to knowledge base</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Proactive follow-ups</Label>
                <p className="text-xs text-slate-400">AI asks for updates when info is incomplete</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Standup Configuration */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50">
                <Calendar className="size-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Standup Schedule</CardTitle>
                <CardDescription>Configure daily standup reminders</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Daily Standup Reminder</Label>
                <p className="text-xs text-slate-400">Send reminder to all team members</p>
              </div>
              <Switch checked={standupReminder} onCheckedChange={setStandupReminder} />
            </div>
            {standupReminder && (
              <div className="space-y-2">
                <Label>Reminder Time</Label>
                <Input type="time" value={standupTime} onChange={e => setStandupTime(e.target.value)} className="w-40" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Standup Format</Label>
              <Select defaultValue="scrum">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrum">Standard (Yesterday, Today, Blockers)</SelectItem>
                  <SelectItem value="simple">Simple (What I did, What I will do)</SelectItem>
                  <SelectItem value="freeform">Freeform</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reports Configuration */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50">
                <MessageSquare className="size-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Daily Reports</CardTitle>
                <CardDescription>Configure automatic report generation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-generate Daily Report</Label>
                <p className="text-xs text-slate-400">Create report at end of workday</p>
              </div>
              <Switch checked={dailyReport} onCheckedChange={setDailyReport} />
            </div>
            {dailyReport && (
              <div className="space-y-2">
                <Label>Report Generation Time</Label>
                <Input type="time" value={reportTime} onChange={e => setReportTime(e.target.value)} className="w-40" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Report Delivery</Label>
              <Select defaultValue="chat">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">In-App Chat Only</SelectItem>
                  <SelectItem value="email">Email Summary</SelectItem>
                  <SelectItem value="both">Both Chat & Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Integrations */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50">
                <Link2 className="size-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">Integrations</CardTitle>
                <CardDescription>Connect external tools</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Jira */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Link2 className="size-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Jira</p>
                  <p className="text-xs text-slate-400">Track issues and sprints</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0">Connected</Badge>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
            {/* GitHub */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Github className="size-5 text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">GitHub</p>
                  <p className="text-xs text-slate-400">Pull requests and issues</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0">Connected</Badge>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
            {/* Slack */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <MessageSquare className="size-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Slack</p>
                  <p className="text-xs text-slate-400">Notifications and alerts</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">Not Connected</Badge>
                <Button variant="outline" size="sm">Connect</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Ticket Workflow Configuration */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50">
                <Calendar className="size-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Workflow de tickets</CardTitle>
                <CardDescription>Configura los estados del kanban por proyecto</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Proyecto</Label>
              <Select value={workflowProjectId} onValueChange={(v) => { setWorkflowLoading(true); setWorkflowProjectId(v) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {workflowLoading ? (
              <div className="text-sm text-slate-500">Cargando estados...</div>
            ) : workflows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                Este proyecto no tiene estados configurados todavía.
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((w, idx) => (
                  <div key={w.id || `${idx}-${w.name}`} className="rounded-lg border p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <Input
                        value={String(w.name || '')}
                        onChange={(e) => updateWorkflow(idx, { name: e.target.value })}
                        placeholder="Nombre estado"
                      />
                      <Input
                        value={String(w.color || '#10b981')}
                        onChange={(e) => updateWorkflow(idx, { color: e.target.value })}
                        placeholder="#10b981"
                      />
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Switch checked={Boolean(w.isQa)} onCheckedChange={(v) => updateWorkflow(idx, { isQa: v })} />
                        QA
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Switch checked={Boolean(w.isDone)} onCheckedChange={(v) => updateWorkflow(idx, { isDone: v })} />
                        Done
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => moveWorkflow(idx, -1)}>
                        <ArrowUp className="size-3 mr-1" /> Subir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => moveWorkflow(idx, 1)}>
                        <ArrowDown className="size-3 mr-1" /> Bajar
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600" onClick={() => removeWorkflow(idx)}>
                        <Trash2 className="size-3 mr-1" /> Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={addWorkflow}>
                <Plus className="size-4 mr-1" /> Añadir estado
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveWorkflowConfig}>
                <Save className="size-4 mr-1" /> Guardar workflow
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Save className="size-4" /> Save Changes
        </Button>
      </motion.div>
    </motion.div>
  )
}
