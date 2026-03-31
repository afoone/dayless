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
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileBarChart,
  Download,
  Eye,
  Sparkles,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Clock,
  ChevronRight,
  Bot,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Report {
  id: string
  date: string
  title: string
  status: 'published' | 'draft'
  summary: string
  metrics: {
    tasksCompleted: number
    tasksInProgress: number
    blockers: number
    teamHealth: number
    sprintVelocity: number
  }
}

const mockReports: Report[] = [
  {
    id: '1', date: '2025-03-30', title: 'Daily Report - March 30', status: 'published',
    summary: `## Sprint 14 - Day 8

### 📊 Summary
Good progress today with 5 tasks completed. The team is on track to meet the sprint goal.

### ✅ Completed
- Payment module refactor - Stripe integration (3 tasks)
- Auth service - OAuth2 implementation (2 tasks)
- Dashboard analytics - Data visualization (1 task)

### 🔄 In Progress
- Mobile App MVP - Navigation components (2 tasks)
- CI/CD Pipeline - Staging environment setup (1 task)

### ⚠️ Blockers
1. **Auth Module**: Google Cloud Console approval pending (Carlos) - 2-3 days
2. **DB Migration**: Prisma schema conflicts in staging (Luis) - resolving today

### 🤖 AI Insights
- Sprint velocity is **15% below target**. Consider reducing scope if blockers persist.
- Recommend scheduling a sync between Frontend and Backend about API contracts.
- **Risk**: Mobile App MVP may slip to next sprint if current velocity continues.`,
    metrics: { tasksCompleted: 5, tasksInProgress: 3, blockers: 2, teamHealth: 78, sprintVelocity: 85 },
  },
  {
    id: '2', date: '2025-03-29', title: 'Daily Report - March 29', status: 'published',
    summary: `## Sprint 14 - Day 7

### 📊 Summary
Moderate progress. The team focused on bug fixes and code reviews.

### ✅ Completed
- Bug fixes in payment flow (2 tasks)
- Code reviews completed (3 PRs)
- Documentation updates

### ⚠️ Blockers
- Stripe webhook issue reported by Carlos

### 🤖 AI Insights
- Team health score improved from 72 to 78.
- Knowledge base grew by 3 entries today.`,
    metrics: { tasksCompleted: 3, tasksInProgress: 4, blockers: 1, teamHealth: 72, sprintVelocity: 82 },
  },
  {
    id: '3', date: '2025-03-31', title: 'Daily Report - March 31 (Draft)', status: 'draft',
    summary: `## Sprint 14 - Day 9

*Generating report...*

### 📊 Pending Data
Waiting for standup submissions from remaining team members.`,
    metrics: { tasksCompleted: 2, tasksInProgress: 5, blockers: 1, teamHealth: 75, sprintVelocity: 80 },
  },
]

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function ReportsView() {
  const [reports] = useState(mockReports)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  return (
    <motion.div className="space-y-6 p-4 md:p-6 lg:p-8" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">AI-generated daily sprint reports</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Sparkles className="size-4" /> Generate Report
        </Button>
      </motion.div>

      {/* Sprint Overview */}
      <motion.div variants={itemVariants}>
        <Card className="border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 shadow-md shadow-emerald-200">
                <Bot className="size-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Sprint 14 Overview</h3>
                <p className="text-xs text-slate-500">Day 9 of 10 · Ends Friday</p>
              </div>
              <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-0">On Track</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <MetricCard label="Tasks Done" value="18" icon={CheckCircle2} color="text-emerald-600" />
              <MetricCard label="In Progress" value="8" icon={Clock} color="text-amber-600" />
              <MetricCard label="Blockers" value="2" icon={AlertTriangle} color="text-red-600" />
              <MetricCard label="Team Health" value="78%" icon={Users} color="text-blue-600" />
              <MetricCard label="Velocity" value="85%" icon={TrendingUp} color="text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Reports List */}
        <div className="lg:col-span-1 space-y-3">
          {reports.map(report => (
            <motion.div key={report.id} variants={itemVariants}>
              <button
                onClick={() => setSelectedReport(report)}
                className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${
                  selectedReport?.id === report.id
                    ? 'border-emerald-300 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900 truncate">{report.title}</span>
                  <Badge variant={report.status === 'published' ? 'default' : 'secondary'} className={`shrink-0 ml-2 text-[10px] ${
                    report.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {report.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Calendar className="size-3" />
                  {report.date}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px]">
                  <span className="text-emerald-600 font-medium">{report.metrics.tasksCompleted} done</span>
                  <span className="text-amber-600 font-medium">{report.metrics.tasksInProgress} active</span>
                  {report.metrics.blockers > 0 && (
                    <span className="text-red-600 font-medium">{report.metrics.blockers} blockers</span>
                  )}
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        {/* Report Content */}
        <div className="lg:col-span-2">
          <motion.div variants={itemVariants}>
            <Card className="border-slate-200/80 bg-white min-h-[400px]">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {selectedReport ? selectedReport.title : 'Select a report'}
                    </CardTitle>
                    <CardDescription>
                      {selectedReport
                        ? `Generated by Dayless.ai · ${selectedReport.date}`
                        : 'Click on a report from the list to view its content'}
                    </CardDescription>
                  </div>
                  {selectedReport && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <Download className="size-3" /> Export
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {selectedReport ? (
                  <div className="prose prose-sm prose-slate max-w-none [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-0 [&_h2]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-700 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-sm [&_p]:text-slate-600 [&_p]:leading-relaxed [&_ul]:text-sm [&_li]:text-slate-600 [&_strong]:text-slate-800">
                    <ReactMarkdown>{selectedReport.summary}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileBarChart className="size-12 text-slate-200 mb-4" />
                    <p className="text-sm text-slate-400">No report selected</p>
                    <p className="text-xs text-slate-300 mt-1">Choose a report from the list to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="text-center">
      <Icon className={`size-4 mx-auto mb-1 ${color}`} />
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  )
}
