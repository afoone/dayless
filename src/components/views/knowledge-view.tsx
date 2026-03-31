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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Brain,
  Plus,
  Search,
  Filter,
  Tag,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Settings,
  BookOpen,
  Shield,
  Zap,
} from 'lucide-react'

interface KnowledgeItem {
  id: string
  key: string
  value: string
  category: 'general' | 'technical' | 'process' | 'blocker' | 'decision'
  source: string
  confidence: number
  isVerified: boolean
  createdAt: string
}

const mockKnowledge: KnowledgeItem[] = [
  {
    id: '1', key: 'Stripe Webhook Endpoint', value: 'The Stripe webhook verification is done at `/api/webhooks/stripe`. Uses stripe-webhook-header for signature validation.',
    category: 'technical', source: 'Ana López', confidence: 95, isVerified: true, createdAt: '2 hours ago',
  },
  {
    id: '2', key: 'API Rate Limit', value: 'The API rate limit is 100 requests per minute per user. Exceeding returns HTTP 429.',
    category: 'technical', source: 'System (Jira)', confidence: 100, isVerified: true, createdAt: '1 day ago',
  },
  {
    id: '3', key: 'Sprint Duration', value: 'Sprints are 2 weeks long. Starts on Monday, ends on Friday with a demo/review session.',
    category: 'process', source: 'Dayless.ai', confidence: 90, isVerified: true, createdAt: '3 days ago',
  },
  {
    id: '4', key: 'Auth Module Blocker', value: 'The OAuth2 integration is blocked because Google Cloud Console approval is pending. Expected resolution: 2-3 days.',
    category: 'blocker', source: 'Carlos Rodríguez', confidence: 80, isVerified: false, createdAt: '5 hours ago',
  },
  {
    id: '5', key: 'Database Migration Strategy', value: 'Decided to use Prisma Migrate for all schema changes. No raw SQL migrations allowed. Review in PR required.',
    category: 'decision', source: 'Team Decision', confidence: 100, isVerified: true, createdAt: '1 week ago',
  },
  {
    id: '6', key: 'Code Review Policy', value: 'All PRs require at least 2 approvals before merging. One must be from a Tech Lead.',
    category: 'process', source: 'Dayless.ai', confidence: 95, isVerified: true, createdAt: '2 weeks ago',
  },
  {
    id: '7', key: 'Deployment Schedule', value: 'Deployments to production happen on Tuesdays and Thursdays at 10:00 AM CET. Emergency deploys require CTO approval.',
    category: 'general', source: 'DevOps Team', confidence: 90, isVerified: true, createdAt: '1 week ago',
  },
  {
    id: '8', key: 'Frontend Testing', value: 'Use Vitest for unit tests and Playwright for E2E. Minimum 80% coverage for new code.',
    category: 'technical', source: 'Frontend Team Lead', confidence: 85, isVerified: true, createdAt: '4 days ago',
  },
]

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const itemVariants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

const categoryConfig = {
  general: { icon: BookOpen, color: 'text-slate-600', bg: 'bg-slate-100', label: 'General' },
  technical: { icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'Technical' },
  process: { icon: Settings, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Process' },
  blocker: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Blocker' },
  decision: { icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Decision' },
}

export default function KnowledgeView() {
  const [knowledge] = useState(mockKnowledge)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filtered = knowledge.filter(item => {
    const matchesSearch = !searchQuery || 
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const stats = {
    total: knowledge.length,
    verified: knowledge.filter(k => k.isVerified).length,
    categories: new Set(knowledge.map(k => k.category)).size,
    avgConfidence: Math.round(knowledge.reduce((sum, k) => sum + k.confidence, 0) / knowledge.length),
  }

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-1">Information learned by Dayless.ai from team interactions</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="size-4" /> Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Knowledge Entry</DialogTitle>
              <DialogDescription>Manually add information to the knowledge base</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Key / Title</Label>
                <Input placeholder="e.g. API Rate Limit Policy" />
              </div>
              <div className="space-y-2">
                <Label>Value / Description</Label>
                <Textarea placeholder="Detailed information..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="process">Process</SelectItem>
                      <SelectItem value="blocker">Blocker</SelectItem>
                      <SelectItem value="decision">Decision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input placeholder="Who provided this?" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-slate-200/80 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Total Entries</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.verified}</p>
            <p className="text-xs text-slate-500">Verified</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.categories}</p>
            <p className="text-xs text-slate-500">Categories</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.avgConfidence}%</p>
            <p className="text-xs text-slate-500">Avg. Confidence</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'general', 'technical', 'process', 'blocker', 'decision'].map(cat => {
            const config = categoryConfig[cat as keyof typeof categoryConfig]
            return (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'text-xs h-7',
                  categoryFilter === cat
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'border-slate-200 text-slate-600'
                )}
              >
                {cat === 'all' ? 'All' : config.label}
              </Button>
            )
          })}
        </div>
      </motion.div>

      {/* Knowledge List */}
      <div className="space-y-3">
        {filtered.map(item => {
          const cat = categoryConfig[item.category]
          return (
            <motion.div key={item.id} variants={itemVariants}>
              <Card className="border-slate-200/80 bg-white hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${cat.bg}`}>
                      <cat.icon className={`size-4 ${cat.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-900">{item.key}</h3>
                        {item.isVerified && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[9px] border-0 px-1.5 py-0 gap-0.5">
                            <Shield className="size-2.5" /> Verified
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{cat.label}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed mb-2">{item.value}</p>
                      <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        <span>Source: <span className="text-slate-600 font-medium">{item.source}</span></span>
                        <span>Confidence: <span className="font-medium" style={{ color: item.confidence >= 90 ? '#10b981' : item.confidence >= 70 ? '#f59e0b' : '#ef4444' }}>{item.confidence}%</span></span>
                        <span>{item.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function cn(...inputs: (string | undefined | false)[]) {
  return inputs.filter(Boolean).join(' ')
}
