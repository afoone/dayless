'use client'

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
} from 'lucide-react'
import { useState } from 'react'

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function SettingsView() {
  const [standupTime, setStandupTime] = useState('09:00')
  const [standupReminder, setStandupReminder] = useState(true)
  const [reportTime, setReportTime] = useState('18:00')
  const [dailyReport, setDailyReport] = useState(true)

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

      {/* Save */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Save className="size-4" /> Save Changes
        </Button>
      </motion.div>
    </motion.div>
  )
}
