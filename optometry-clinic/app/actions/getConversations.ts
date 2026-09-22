'use server'

// app/actions/getConversations.ts
// Reads whatsapp_conversations and groups it into threads by phone number,
// resolving each number to a patient/lead name. Now also:
//   • enforces per-role visibility (none / preview / full)
//   • enriches each thread with takeover state + per-staff unread
//   • returns the reply context for a thread (24h window, takeover, permission)
// so the inbox UI can drive human replies and AI handoff.

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCurrentStaff, resolveAccess, type RoleAccess } from '@/lib/conversationAccess'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const WINDOW_MS = 24 * 60 * 60 * 1000

// Normalise a Nigerian number to a comparable core (last 10 digits).
function phoneCore(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.slice(-10)
}

export type ConversationThread = {
  phoneNumber: string
  displayName: string
  kind: 'patient' | 'lead' | 'unknown'
  patientId: string | null
  lastMessageAt: string
  messageCount: number
  lastMessagePreview: string
  lastMessageRole: string
  humanControlled: boolean
  hasUnread: boolean
}

export async function getConversationThreads(): Promise<{
  threads?: ConversationThread[]
  access?: RoleAccess
  error?: string
}> {
  // Who is asking, and what may they see?
  const staff = await getCurrentStaff()
  const access = await resolveAccess(staff?.role)
  if (access.view === 'none') {
    return { threads: [], access }
  }

  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('whatsapp_conversations')
    .select('phone_number, role, message, created_at')
    .order('created_at', { ascending: false })
    .limit(3000)

  if (error) return { error: error.message, access }
  if (!rows || rows.length === 0) return { threads: [], access }

  // Group by phone number
  const byPhone = new Map<string, typeof rows>()
  for (const r of rows) {
    const arr = byPhone.get(r.phone_number) ?? []
    arr.push(r)
    byPhone.set(r.phone_number, arr)
  }

  // Resolve names — patients & leads by phone core
  const { data: patients } = await supabase
    .from('patients')
    .select('id, full_name, phone, phone2')
    .is('deleted_at', null)
  const { data: leads } = await supabase
    .from('leads')
    .select('full_name, phone')

  const patientByCore = new Map<string, { id: string; name: string }>()
  for (const p of patients ?? []) {
    if (p.phone) patientByCore.set(phoneCore(p.phone), { id: p.id, name: p.full_name })
    if ((p as any).phone2) patientByCore.set(phoneCore((p as any).phone2), { id: p.id, name: p.full_name })
  }
  const leadByCore = new Map<string, string>()
  for (const l of leads ?? []) {
    if (l.phone) leadByCore.set(phoneCore(l.phone), l.full_name)
  }

  // Takeover state (small table — fetch all)
  const { data: controls } = await admin()
    .from('conversation_controls')
    .select('phone_number, human_controlled')
  const controlByPhone = new Map<string, boolean>()
  for (const c of controls ?? []) controlByPhone.set(c.phone_number, !!c.human_controlled)

  // Per-staff read state (only this staff member's rows)
  const readByPhone = new Map<string, string>()
  if (staff) {
    const { data: reads } = await admin()
      .from('conversation_reads')
      .select('phone_number, last_read_at')
      .eq('staff_id', staff.id)
    for (const r of reads ?? []) readByPhone.set(r.phone_number, r.last_read_at)
  }

  const threads: ConversationThread[] = []
  for (const [phone, msgs] of byPhone.entries()) {
    const core = phoneCore(phone)
    const patient = patientByCore.get(core)
    const leadName = leadByCore.get(core)
    const last = msgs[0] // newest-first

    // Unread = newest inbound (patient) message is newer than this staff's read mark
    const lastInbound = msgs.find(m => m.role === 'user')
    const readAt = readByPhone.get(phone)
    const hasUnread =
      !!lastInbound && (!readAt || new Date(lastInbound.created_at) > new Date(readAt))

    threads.push({
      phoneNumber: phone,
      displayName: patient?.name ?? leadName ?? phone,
      kind: patient ? 'patient' : leadName ? 'lead' : 'unknown',
      patientId: patient?.id ?? null,
      lastMessageAt: last.created_at,
      messageCount: msgs.length,
      lastMessagePreview: last.message?.slice(0, 80) ?? '',
      lastMessageRole: last.role,
      humanControlled: controlByPhone.get(phone) ?? false,
      hasUnread,
    })
  }

  threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
  return { threads, access }
}

export type ThreadContext = {
  messages?: any[]
  windowOpen: boolean          // patient messaged within last 24h → free-form replies deliver
  humanControlled: boolean
  controlledBy: string | null
  canReply: boolean
  restricted?: boolean         // true if the caller's role can't see full transcripts
  error?: string
}

export async function getConversationMessages(
  phoneNumber: string
): Promise<ThreadContext> {
  const staff = await getCurrentStaff()
  const access = await resolveAccess(staff?.role)

  // Preview / none roles cannot open the full transcript.
  if (access.view !== 'full') {
    return {
      windowOpen: false,
      humanControlled: false,
      controlledBy: null,
      canReply: false,
      restricted: true,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('id, role, message, created_at')
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    return { windowOpen: false, humanControlled: false, controlledBy: null, canReply: access.can_reply, error: error.message }
  }

  // 24h window — last inbound from pending table, fallback to latest user row
  let lastInbound: string | null = null
  const { data: pending } = await supabase
    .from('whatsapp_pending_replies')
    .select('last_message_at')
    .eq('phone_number', phoneNumber)
    .single()
  lastInbound = pending?.last_message_at ?? null
  if (!lastInbound) {
    const lastUser = (data ?? []).filter(m => m.role === 'user').slice(-1)[0]
    lastInbound = lastUser?.created_at ?? null
  }
  const windowOpen =
    lastInbound != null && Date.now() - new Date(lastInbound).getTime() < WINDOW_MS

  // Takeover state
  const { data: control } = await admin()
    .from('conversation_controls')
    .select('human_controlled, controlled_by')
    .eq('phone_number', phoneNumber)
    .single()

  return {
    messages: data ?? [],
    windowOpen,
    humanControlled: control?.human_controlled ?? false,
    controlledBy: control?.controlled_by ?? null,
    canReply: access.can_reply,
  }
}
