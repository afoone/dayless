/** IDs de proyectos que pertenecen al contexto del miembro (asignaciones + predeterminado, sin duplicados). */
export function assignedProjectIdsFromMemberContext(data: {
  projects?: Array<{ id: string }>
  defaultProject?: { id: string } | null
}): string[] {
  const ids = new Set<string>()
  for (const p of data.projects ?? []) ids.add(p.id)
  if (data.defaultProject?.id) ids.add(data.defaultProject.id)
  return [...ids]
}
