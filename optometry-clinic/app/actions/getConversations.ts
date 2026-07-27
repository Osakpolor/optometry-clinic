'use server'

// app/actions/getConversations.ts
// Reads the whatsapp_conversations log and groups it into threads by phone
// number, resolving each number to a patient or lead name. Read-only.

import { createClient } from '@/lib/supabase/server'

// Normalise a Nigerian number to a comparable core (last 10 digits), so
// 2348012345678, 08012345678 and +2348012345678 all match.
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
}

export async function getConversationThreads(): Promise<{
  threads?: ConversationThread[]
  error?: string
}> {
  const supabase = await createClient()

  // Pull recent conversation rows (cap to keep it fast; adjustable later)
  const { data: rows, error } = await supabase
    .from('whatsapp_conversations')
    .select('phone_number, role, message, created_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { threads: [] }

  // Group by phone number
  const byPhone = new Map<string, typeof rows>()
  for (const r of rows) {
    const arr = byPhone.get(r.phone_number) ?? []
    arr.push(r)
    byPhone.set(r.phone_number, arr)
  }

  // Resolve names — fetch all patients & leads once, match by phone core
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

  const threads: ConversationThread[] = []
  for (const [phone, msgs] of byPhone.entries()) {
    const core = phoneCore(phone)
    const patient = patientByCore.get(core)
    const leadName = leadByCore.get(core)

    // msgs are newest-first; last message is msgs[0]
    const last = msgs[0]
    threads.push({
      phoneNumber: phone,
      displayName: patient?.name ?? leadName ?? phone,
      kind: patient ? 'patient' : leadName ? 'lead' : 'unknown',
      patientId: patient?.id ?? null,
      lastMessageAt: last.created_at,
      messageCount: msgs.length,
      lastMessagePreview: last.message?.slice(0, 80) ?? '',
    })
  }

  // Sort threads by most recent activity
  threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

  return { threads }
}

export async function getConversationMessages(
  phoneNumber: string
): Promise<{ messages?: any[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('id, role, message, created_at')
    .eq('phone_number', phoneNumber)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return { error: error.message }
  return { messages: data ?? [] }
}
