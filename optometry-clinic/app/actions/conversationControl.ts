'use server'

// app/actions/conversationControl.ts
// Take over / hand back a conversation, and mark a thread read.
// Takeover pauses Iris for that number; handing back resumes her.

import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCurrentStaff, resolveAccess } from '@/lib/conversationAccess'
import { formatNigerianPhone } from '@/lib/whatsapp'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Explicit take over (without sending a message yet) — e.g. a staff member
// wants to answer this one personally. Requires reply permission.
export async function takeOverConversation(
  phoneNumber: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: 'Not signed in' }
  const access = await resolveAccess(staff.role)
  if (!access.can_reply) return { ok: false, error: 'No permission' }

  const to = formatNigerianPhone(phoneNumber) ?? phoneNumber.replace(/\D/g, '')
  await admin().from('conversation_controls').upsert(
    {
      phone_number: to,
      human_controlled: true,
      controlled_by: staff.full_name,
      controlled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone_number' }
  )
  return { ok: true }
}

// Hand back to Iris — she resumes auto-replying to this number.
export async function handBackToIris(
  phoneNumber: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: 'Not signed in' }
  const access = await resolveAccess(staff.role)
  if (!access.can_reply) return { ok: false, error: 'No permission' }

  const to = formatNigerianPhone(phoneNumber) ?? phoneNumber.replace(/\D/g, '')
  await admin().from('conversation_controls').upsert(
    {
      phone_number: to,
      human_controlled: false,
      controlled_by: null,
      controlled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'phone_number' }
  )
  return { ok: true }
}

// Mark a thread read for the current staff member (per-person unread state).
export async function markThreadRead(
  phoneNumber: string
): Promise<{ ok: boolean }> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false }
  const to = formatNigerianPhone(phoneNumber) ?? phoneNumber.replace(/\D/g, '')
  await admin().from('conversation_reads').upsert(
    {
      staff_id: staff.id,
      phone_number: to,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'staff_id,phone_number' }
  )
  return { ok: true }
}
