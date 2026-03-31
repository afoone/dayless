# Chat → tickets internos (persistencia)

Cuando el usuario pide crear o actualizar tickets desde el chat, el modelo puede **inventar** ids `tkt_...` sin ejecutar nada en BD.

## Comportamiento implementado en `/api/chat`

1. **JSON estructurado** (preferido para crear): al final del mensaje del modelo, un bloque \`\`\`json con \`{ "internal_ticket": { "ready": true|false, ... } }\`. Si \`ready: true\`, el servidor valida y llama a **\`executeInternalTicketCreate\`** (misma regla que el tag). Si \`ready: false\`, solo lista \`missing\` (el bloque se oculta al usuario).
2. **`INTERNAL_TICKET_ACTION`** legacy (create/update); el create se omite si ya hubo éxito vía JSON en el mismo turno.
3. **Fallback servidor** (si no hubo `✅ Ticket interno creado` por el modelo), **salvo** si el mensaje **empieza por** `/standup`, `/blocker`, `/question` o `/update` (quick actions del chat): entonces **no** se ejecutan append, creación por intención ni el fallback largo de «crea ticket» — el modelo puede seguir creando vía JSON/tag.
   - **Append**: mensajes cortos de seguimiento → se añaden a la descripción del último ticket del reporter (&lt; ~2 h).
   - **Creación por intención**: varias frases del usuario en la ventana reciente + regex de intención (urgente, despliegue, pre, ticket…) → insert real con `createdByType: system`, `createdByName: Chat (sistema)`.
4. **`findProjectByHint`**: pistas tipo "payment" resuelven al proyecto cuyo nombre las contiene.
5. **`resolveProjectForMemberInternalTicket`**: también usa hint para `project:` parcial.
6. **Post-proceso**: ids `tkt_...` en la prosa que **no** salieron de `actionResults` se sustituyen por un aviso.
7. **`update_ticket`** admite `title`, `description` (sustituye), `priority`; `note` añade al final de la descripción.
8. **Título del fallback**: filtrar líneas tipo «crea un ticket» con `isBadTicketTitleLine`; si no queda buen título, `synthesizeFallbackTitle` (p. ej. urgencia + pre → «Urgente: despliegue en preproducción»).
9. **Historial LLM**: `normalizeMessageBodyForHistory` quita `[Dayless.ai]:` y el propio prefijo duplicado para que no se encadenen `[Dayless.ai]: [Dayless.ai]:`.

Al cambiar esta lógica, mantén el orden: **JSON internal_ticket** → tags `INTERNAL_TICKET_ACTION` → append → creación por intención → fallback "crea ticket" largo.
