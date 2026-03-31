'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { getProjects, getGitHubIssues, createGitHubIssue, getJiraIssues, createJiraIssue, getMemberProjects, type GitHubIssue, type JiraIssue } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  FolderKanban, Plus, ExternalLink, Github, Link2, Settings,
  Circle, MoreVertical, Edit, Trash2, CheckCircle2, Clock,
  AlertCircle, MessageSquare, Loader2, GitPullRequest, X, Ticket,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { Project } from '@/types'
import { assignedProjectIdsFromMemberContext } from '@/lib/member-projects'

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

const statusConfig = {
  active: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Active' },
  paused: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Paused' },
  completed: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Completed' },
}

const labelColors: Record<string, string> = {
  bug: 'bg-red-100 text-red-700',
  feature: 'bg-emerald-100 text-emerald-700',
  blocker: 'bg-amber-100 text-amber-700',
  enhancement: 'bg-blue-100 text-blue-700',
  documentation: 'bg-slate-100 text-slate-700',
  question: 'bg-purple-100 text-purple-700',
}

export default function ProjectsView() {
  const { currentMember } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [issues, setIssues] = useState<Record<string, GitHubIssue[]>>({})
  const [jiraIssues, setJiraIssues] = useState<Record<string, JiraIssue[]>>({})
  const [issuesLoading, setIssuesLoading] = useState<Record<string, boolean>>({})
  const [jiraIssuesLoading, setJiraIssuesLoading] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<string>('all')
  const [createIssueOpen, setCreateIssueOpen] = useState(false)
  const [newIssue, setNewIssue] = useState({ title: '', body: '', labels: '' })
  const [createIssueProject, setCreateIssueProject] = useState<Project | null>(null)
  const [creatingIssue, setCreatingIssue] = useState(false)

  useEffect(() => {
    if (!currentMember?.id) return
    setLoading(true)
    Promise.all([getMemberProjects(currentMember.id), getProjects()])
      .then(([memberProjectsRes, allProjectsRes]) => {
        if (!memberProjectsRes.success || !memberProjectsRes.data || !allProjectsRes.success || !Array.isArray(allProjectsRes.data)) {
          setProjects([])
          return
        }
        const assignedIds = new Set(assignedProjectIdsFromMemberContext(memberProjectsRes.data))
        const assigned = (allProjectsRes.data as unknown as Project[]).filter((p) => assignedIds.has(p.id))
        setProjects(assigned)
      })
      .finally(() => setLoading(false))
  }, [currentMember?.id])

  const loadIssues = async (project: Project) => {
    if (project.githubRepo && project.githubToken) {
      setIssuesLoading(prev => ({ ...prev, [project.id]: true }))
      try {
        const res = await getGitHubIssues(project.id, { state: 'open', per_page: 10 })
        if (res.success && Array.isArray(res.data)) setIssues(prev => ({ ...prev, [project.id]: res.data as unknown as GitHubIssue[] }))
        else if (res.error) toast.error(res.error)
      } catch { toast.error('Failed to connect to GitHub') }
      finally { setIssuesLoading(prev => ({ ...prev, [project.id]: false })) }
    }
    if (project.jiraBaseUrl && project.jiraProjectKey && project.jiraToken) {
      setJiraIssuesLoading(prev => ({ ...prev, [project.id]: true }))
      try {
        const res = await getJiraIssues(project.id, { maxResults: 10 })
        if (res.success && res.data) {
          const data = res.data as unknown as { issues: JiraIssue[] }
          setJiraIssues(prev => ({ ...prev, [project.id]: data.issues || [] }))
        } else if (res.error) toast.error(res.error)
      } catch { toast.error('Failed to connect to Jira') }
      finally { setJiraIssuesLoading(prev => ({ ...prev, [project.id]: false })) }
    }
  }

  const handleToggleExpand = (project: Project) => {
    if (expandedProject === project.id) {
      setExpandedProject(null)
    } else {
      setExpandedProject(project.id)
      if ((project.githubRepo && project.githubToken && !issues[project.id]) || (project.jiraBaseUrl && project.jiraProjectKey && !jiraIssues[project.id])) {
        loadIssues(project)
      }
    }
  }

  const handleCreateIssue = async () => {
    if (!createIssueProject || !newIssue.title.trim()) return
    setCreatingIssue(true)
    try {
      const labels = newIssue.labels.split(',').map(l => l.trim()).filter(Boolean)
      const res = await createGitHubIssue(createIssueProject.id, {
        title: newIssue.title.trim(),
        body: newIssue.body.trim() || undefined,
        labels: labels.length > 0 ? labels : undefined,
      })
      if (res.success && res.data) {
        toast.success(`Issue #${(res.data as GitHubIssue).number} created!`)
        setCreateIssueOpen(false)
        setNewIssue({ title: '', body: '', labels: '' })
        loadIssues(createIssueProject)
      } else {
        toast.error(res.error || 'Failed to create issue')
      }
    } catch {
      toast.error('Error creating issue')
    } finally {
      setCreatingIssue(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  const filteredProjects = filter === 'all' ? projects : projects.filter((p) => p.status === filter)

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Los mismos proyectos que en Perfil; aquí puedes filtrar solo por estado.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {filter !== 'all' && (
            <p className="text-[11px] text-slate-400 max-w-[220px] text-right">
              Perfil lista todos los estados; con &quot;{filter}&quot; aquí verás menos filas.
            </p>
          )}
        </div>
      </motion.div>

      {/* Projects List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-slate-200/80 bg-white">
              <CardContent className="p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-72 mb-3" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredProjects.length === 0 ? (
          <Card className="border-slate-200/80 bg-white">
            <CardContent className="p-8 text-center">
              <FolderKanban className="size-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                {projects.length === 0 ? 'No tienes proyectos asignados.' : 'Ningún proyecto con este filtro de estado.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map(project => {
            const status = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active
            const hasGitHub = !!(project.githubRepo && project.githubToken)
            const hasJira = !!(project.jiraBaseUrl && project.jiraProjectKey && project.jiraToken)
            const isExpanded = expandedProject === project.id
            const projectIssues = issues[project.id] || []
            const projectJiraIssues = jiraIssues[project.id] || []
            const isLoadingIssues = issuesLoading[project.id]
            const isLoadingJira = jiraIssuesLoading[project.id]

            return (
              <motion.div key={project.id} variants={itemVariants}>
                <Card className="border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <FolderKanban className="size-5 text-slate-400 shrink-0" />
                          <h3 className="text-base font-semibold text-slate-900 truncate">{project.name}</h3>
                          <Badge variant="outline" className={`${status.bg} ${status.color} border-0 text-[10px]`}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 ml-8 mb-3">{project.description || 'No description'}</p>
                        <div className="flex flex-wrap items-center gap-3 ml-8">
                          {project.jiraKey && (
                            <Badge variant="outline" className="text-[11px] gap-1">
                              <Link2 className="size-3" /> {project.jiraKey}
                            </Badge>
                          )}
                          {project.githubRepo && (
                            <Badge variant={hasGitHub ? 'default' : 'secondary'} className="text-[11px] gap-1">
                              <Github className="size-3" /> {project.githubRepo}
                              {hasGitHub ? ' ✓' : ' (no token)'}
                            </Badge>
                          )}
                          {project.jiraProjectKey && (
                            <Badge variant={hasJira ? 'default' : 'secondary'} className="text-[11px] gap-1">
                              <Ticket className="size-3" /> {project.jiraProjectKey}
                              {hasJira ? ' ✓' : ' (no token)'}
                            </Badge>
                          )}
                          {(hasGitHub || hasJira) && (
                            <Badge variant="outline" className="text-[11px] gap-1 text-emerald-600 border-emerald-200">
                              <GitPullRequest className="size-3" />
                              {(projectIssues.length || 0) + (projectJiraIssues.length || 0)} open
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(hasGitHub || hasJira) && (
                          <Button variant="outline" size="sm" onClick={() => handleToggleExpand(project)} className="text-xs gap-1">
                            <GitPullRequest className="size-3" />
                            {isExpanded ? 'Hide' : 'Tickets'}
                          </Button>
                        )}
                        {hasGitHub && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => { setCreateIssueProject(project); setCreateIssueOpen(true) }}
                            className="text-xs gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          >
                            <Plus className="size-3" /> New Issue
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 text-slate-400">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Edit className="size-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600"><Trash2 className="size-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>

                  {/* Expanded: GitHub Issues */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {hasGitHub && (
                        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <Github className="size-4" />
                              GitHub Issues
                              {project.githubRepo && (
                                <a
                                  href={`https://github.com/${project.githubRepo}/issues`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"
                                >
                                  <ExternalLink className="size-3" /> View on GitHub
                                </a>
                              )}
                            </h4>
                            <Button variant="ghost" size="sm" onClick={() => loadIssues(project)} className="text-xs gap-1">
                              <Loader2 className={cn('size-3', isLoadingIssues && 'animate-spin')} />
                              Refresh
                            </Button>
                          </div>

                          {isLoadingIssues ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-lg" />
                              ))}
                            </div>
                          ) : projectIssues.length === 0 ? (
                            <div className="text-center py-6 text-slate-400">
                              <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-300" />
                              <p className="text-sm">No open issues 🎉</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {projectIssues.map(issue => (
                                <a
                                  key={issue.id}
                                  href={issue.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-200 hover:shadow-sm transition-all group"
                                >
                                  <Circle className="size-4 text-emerald-500 shrink-0 mt-0.5 fill-emerald-500" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 truncate">
                                      {issue.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[11px] text-slate-400">#{issue.number}</span>
                                      <span className="text-[11px] text-slate-400">·</span>
                                      <span className="text-[11px] text-slate-400">{formatDate(issue.created_at)}</span>
                                      {issue.comments > 0 && (
                                        <>
                                          <span className="text-[11px] text-slate-400">·</span>
                                          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                                            <MessageSquare className="size-2.5" /> {issue.comments}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {issue.labels.slice(0, 3).map(label => (
                                      <Badge
                                        key={label.name}
                                        className={cn(
                                          'text-[9px] px-1.5 py-0 border-0',
                                          labelColors[label.name.toLowerCase()] || 'bg-slate-100 text-slate-600'
                                        )}
                                      >
                                        {label.name}
                                      </Badge>
                                    ))}
                                    {issue.labels.length > 3 && (
                                      <span className="text-[9px] text-slate-400">+{issue.labels.length - 3}</span>
                                    )}
                                    {issue.assignee && (
                                      <img
                                        src={issue.assignee.avatar_url}
                                        alt={issue.assignee.login}
                                        className="size-5 rounded-full ml-1"
                                      />
                                    )}
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Jira Issues */}
                      {hasJira && (
                        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/30">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <Ticket className="size-4 text-blue-600" />
                              Jira Tickets ({project.jiraProjectKey})
                            </h4>
                            <Button variant="ghost" size="sm" onClick={() => loadIssues(project)} className="text-xs gap-1">
                              <Loader2 className={cn('size-3', isLoadingJira && 'animate-spin')} />
                              Refresh
                            </Button>
                          </div>
                          {isLoadingJira ? (
                            <div className="space-y-2">
                              {Array.from({ length: 2 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-lg" />
                              ))}
                            </div>
                          ) : projectJiraIssues.length === 0 ? (
                            <div className="text-center py-4 text-slate-400">
                              <CheckCircle2 className="size-6 mx-auto mb-1 text-blue-300" />
                              <p className="text-xs">No open tickets 🎉</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {projectJiraIssues.map(issue => (
                                <div
                                  key={issue.id}
                                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-200 hover:shadow-sm transition-all"
                                >
                                  <div className={cn(
                                    'size-4 rounded shrink-0 mt-0.5 border-2',
                                    issue.fields.status?.statusCategory?.colorName === 'green' ? 'border-emerald-300 bg-emerald-50' :
                                    issue.fields.status?.statusCategory?.colorName === 'yellow' ? 'border-amber-300 bg-amber-50' :
                                    issue.fields.status?.statusCategory?.colorName === 'blue' ? 'border-blue-300 bg-blue-50' :
                                    'border-slate-300 bg-slate-50',
                                    issue.fields.status?.statusCategory?.colorName === 'green' && 'fill-emerald-400',
                                  )} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 truncate">
                                      <span className="text-blue-600 mr-1">{issue.key}</span>
                                      {issue.fields.summary}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[11px] text-slate-400">{issue.fields.status?.name}</span>
                                      {issue.fields.priority && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0">{issue.fields.priority.name}</Badge>
                                      )}
                                      <span className="text-[11px] text-slate-400">{formatDate(issue.fields.updated)}</span>
                                      {issue.fields.assignee && (
                                        <span className="text-[11px] text-slate-500">{issue.fields.assignee.displayName}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                  </motion.div>
                  )}
                </AnimatePresence>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Create Issue Dialog */}
      <Dialog open={createIssueOpen} onOpenChange={setCreateIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create GitHub Issue</DialogTitle>
            <DialogDescription>
              Create a new issue in <span className="font-medium">{createIssueProject?.githubRepo}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Brief description of the issue"
                value={newIssue.title}
                onChange={e => setNewIssue(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Detailed description (supports markdown)..."
                rows={4}
                value={newIssue.body}
                onChange={e => setNewIssue(prev => ({ ...prev, body: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Labels (comma-separated)</Label>
              <Input
                placeholder="e.g. bug, blocker, frontend"
                value={newIssue.labels}
                onChange={e => setNewIssue(prev => ({ ...prev, labels: e.target.value }))}
              />
              <div className="flex flex-wrap gap-1">
                {['bug', 'feature', 'blocker', 'enhancement', 'documentation'].map(label => (
                  <button
                    key={label}
                    onClick={() => {
                      const current = newIssue.labels.split(',').map(l => l.trim()).filter(Boolean)
                      if (current.includes(label)) {
                        setNewIssue(prev => ({ ...prev, labels: current.filter(l => l !== label).join(', ') }))
                      } else {
                        setNewIssue(prev => ({ ...prev, labels: [...current, label].join(', ') }))
                      }
                    }}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer',
                      newIssue.labels.split(',').map(l => l.trim()).includes(label)
                        ? labelColors[label] || 'bg-slate-100 text-slate-600'
                        : 'border-slate-200 text-slate-400 hover:border-slate-400'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateIssueOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateIssue}
              disabled={!newIssue.title.trim() || creatingIssue}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {creatingIssue ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
