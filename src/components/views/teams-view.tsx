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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  MoreVertical,
  Mail,
  Circle,
  Edit,
  Trash2,
  UserPlus,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MockTeam {
  id: string
  name: string
  description: string
  color: string
  members: MockMember[]
  progress: number
}

interface MockMember {
  id: string
  name: string
  role: string
  email: string
  status: 'active' | 'away' | 'offline'
}

const mockTeams: MockTeam[] = [
  {
    id: '1',
    name: 'Frontend Team',
    description: 'UI/UX development and component library',
    color: '#10b981',
    progress: 65,
    members: [
      { id: 'm1', name: 'Ana López', role: 'Tech Lead', email: 'ana@team.com', status: 'active' },
      { id: 'm2', name: 'Carlos Rodríguez', role: 'Senior Dev', email: 'carlos@team.com', status: 'active' },
      { id: 'm3', name: 'María García', role: 'Mid Dev', email: 'maria@team.com', status: 'active' },
      { id: 'm4', name: 'Javier Kim', role: 'Junior Dev', email: 'javier@team.com', status: 'away' },
      { id: 'm5', name: 'Tina Santos', role: 'Designer', email: 'tina@team.com', status: 'active' },
    ],
  },
  {
    id: '2',
    name: 'Backend Team',
    description: 'API development, database, and infrastructure',
    color: '#8b5cf6',
    progress: 80,
    members: [
      { id: 'm6', name: 'Luis Hernández', role: 'Tech Lead', email: 'luis@team.com', status: 'active' },
      { id: 'm7', name: 'Pablo Navarro', role: 'Senior Dev', email: 'pablo@team.com', status: 'away' },
      { id: 'm8', name: 'Sara Gómez', role: 'Mid Dev', email: 'sara@team.com', status: 'active' },
      { id: 'm9', name: 'Diego Ruiz', role: 'DevOps', email: 'diego@team.com', status: 'active' },
    ],
  },
  {
    id: '3',
    name: 'DevOps Team',
    description: 'CI/CD, monitoring, and cloud infrastructure',
    color: '#f59e0b',
    progress: 45,
    members: [
      { id: 'm10', name: 'Raúl Martínez', role: 'SRE Lead', email: 'raul@team.com', status: 'active' },
      { id: 'm11', name: 'Karen Wu', role: 'Cloud Engineer', email: 'karen@team.com', status: 'active' },
      { id: 'm12', name: 'Víctor Torres', role: 'Platform Dev', email: 'victor@team.com', status: 'offline' },
    ],
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export default function TeamsView() {
  const [teams, setTeams] = useState(mockTeams)
  const [selectedTeam, setSelectedTeam] = useState<MockTeam | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')

  const statusColors = {
    active: 'bg-emerald-400',
    away: 'bg-amber-400',
    offline: 'bg-slate-300',
  }

  return (
    <motion.div
      className="space-y-6 p-4 md:p-6 lg:p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your teams and members</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="size-4" /> New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>Add a new team to your organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input id="team-name" placeholder="e.g. Mobile Team" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-desc">Description</Label>
                <Input id="team-desc" placeholder="What does this team do?" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateDialogOpen(false)}>Create Team</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {teams.map(team => (
          <motion.div key={team.id} variants={itemVariants}>
            <Card className="border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: team.color + '20' }}>
                      <Users className="size-5" style={{ color: team.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-base text-slate-900">{team.name}</CardTitle>
                      <CardDescription className="text-xs">{team.description}</CardDescription>
                    </div>
                  </div>
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
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sprint Progress */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-500">Sprint Progress</span>
                    <span className="text-xs font-bold text-slate-700">{team.progress}%</span>
                  </div>
                  <Progress value={team.progress} className="h-1.5" />
                </div>

                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Members ({team.members.length})</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                      onClick={() => setSelectedTeam(team)}
                    >
                      <UserPlus className="size-3" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {team.members.slice(0, 4).map(member => (
                      <div key={member.id} className="flex items-center gap-2.5">
                        <div className="relative">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${statusColors[member.status]}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 truncate">{member.name}</p>
                          <p className="text-[10px] text-slate-400">{member.role}</p>
                        </div>
                        <Mail className="size-3 text-slate-300 shrink-0" />
                      </div>
                    ))}
                    {team.members.length > 4 && (
                      <button
                        onClick={() => setSelectedTeam(team)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        +{team.members.length - 4} more members
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
