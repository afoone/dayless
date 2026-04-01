'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { approveProposal, getProposals, rejectProposal } from '@/lib/api'
import type { TicketProposal } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function ProposalsView() {
  const { currentMember, contextProjectId } = useAppStore()
  const [status, setStatus] = useState<string>('pending_review')
  const [items, setItems] = useState<TicketProposal[]>([])
  const [loading, setLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('No encaja con el objetivo actual del sprint')

  const isLead = currentMember?.teamRole === 'lead'

  const load = async () => {
    if (!currentMember?.teamId) return
    setLoading(true)
    const result = await getProposals({
      teamId: currentMember.teamId,
      status: status === 'all' ? undefined : status,
      projectId: contextProjectId || undefined,
    })
    if (result.success && Array.isArray(result.data)) {
      setItems(result.data)
    } else {
      setItems([])
    }
    setLoading(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [currentMember?.teamId, contextProjectId, status])

  const title = useMemo(() => (isLead ? 'Propuestas pendientes' : 'Mis propuestas'), [isLead])

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">Cola de propuestas y decisiones de aprobación.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending_review">Pendiente</SelectItem>
              <SelectItem value="approved">Aprobado</SelectItem>
              <SelectItem value="rejected">Rechazado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.map((proposal) => (
          <Card key={proposal.id}>
            <CardHeader>
              <CardTitle className="text-base">{proposal.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">{proposal.description}</p>
              <p className="text-xs text-slate-500">
                Estado: {proposal.status} · Prioridad: {proposal.priority}
                {proposal.externalKey ? ` · Ticket: ${proposal.externalKey}` : ''}
              </p>
              {isLead && proposal.status === 'pending_review' && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={async () => {
                      await approveProposal(proposal.id)
                      await load()
                    }}
                  >
                    Aprobar
                  </Button>
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await rejectProposal(proposal.id, rejectReason)
                      await load()
                    }}
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-500">
              No hay propuestas para mostrar con los filtros actuales.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
