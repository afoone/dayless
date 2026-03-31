import type { Ticket } from '@/types'

export function ticketCreatorLine(t: Ticket): string {
  const type = t.createdByType || 'member'
  if (type === 'member') {
    return t.reporter?.name ? `Creado por ${t.reporter.name}` : 'Creado desde el tablero'
  }
  if (type === 'ai') {
    const label = t.createdByName || 'Dayless.ai'
    return t.reporter?.name ? `${label} · solicitud de ${t.reporter.name}` : `Creado por ${label}`
  }
  const label = t.createdByName || 'Sistema'
  return t.reporter?.name ? `${label} · ${t.reporter.name}` : label
}
