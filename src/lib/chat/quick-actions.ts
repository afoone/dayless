export type QuickActionCommand =
  | 'standup'
  | 'standup_team'
  | 'standup_summary'
  | 'mis_tickets'
  | 'blockers'
  | 'question'
  | 'update'
  | 'refinar'
  | 'proponer'
  | 'estimar'
  | 'retro'

export function parseQuickAction(input: string): { command: QuickActionCommand; args: string } | null {
  const text = input.trim()
  const rules: Array<{ re: RegExp; command: QuickActionCommand }> = [
    { re: /^\/standup-equipo\b/i, command: 'standup_team' },
    { re: /^\/standup-resumen\b/i, command: 'standup_summary' },
    { re: /^\/standup\b/i, command: 'standup' },
    { re: /^\/mis-tickets\b/i, command: 'mis_tickets' },
    { re: /^\/blockers?\b/i, command: 'blockers' },
    { re: /^\/question\b/i, command: 'question' },
    { re: /^\/update\b/i, command: 'update' },
    { re: /^\/refinar\b/i, command: 'refinar' },
    { re: /^\/proponer\b/i, command: 'proponer' },
    { re: /^\/estimar\b/i, command: 'estimar' },
    { re: /^\/retro\b/i, command: 'retro' },
  ]
  for (const rule of rules) {
    const match = text.match(rule.re)
    if (match) {
      return { command: rule.command, args: text.slice(match[0].length).trim() }
    }
  }
  return null
}
