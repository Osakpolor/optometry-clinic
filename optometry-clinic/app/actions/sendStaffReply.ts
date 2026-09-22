'use server'

// app/actions/sendStaffReply.ts
// A staff member types a reply to a patient from the Conversations inbox.
// This is the human side of the AI+human shared inbox.
//
// Hard rules enforced here (server-side, never trust the UI):
//   1. Permission — only admin, or a role whose conv_visibility grants
//      can_reply, may send.
//   2. WhatsApp 24-hour window — free-form messages ONLY deliver within 24h
//      of the patient's LAST inbound message. Outside that window Meta rejects
//      free-form text (error 131047); the caller must use a template instead.
//      We block here and tell the UI, rather than firing a doomed send.
//   3. Taking over pauses Iris — sending a staff reply flips
//      conversation_controls.human_controlled = true for this number, so the
//      webhook stops auto-replying until a human hands it back.

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { sendWhatsAppMessage, formatNigerianPhone } from '@/lib/whatsapp'
import { getCurrentStaff, resolveAccess } from '@/lib/conversationAccess'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const WINDOW_MS = 24 * 60 * 60 * 1000

export async function sendStaffReply(
  phoneNumber: string,
  text: string
): Promise<{ ok: boolean; error?: string; outsideWindow?: boolean }> {
  const body = (text ?? '').trim()
  if (!body) return { ok: false, error: 'Message is empty' }

  // 1. Permission
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: 'Not signed in' }
  const access = await resolveAccess(staff.role)
  if (!access.can_reply) {
    return { ok: false, error: 'You do not have permission to reply' }
  }

  const supabase = await createClient()

  // 2. 24-hour window — the patient's last inbound sets the clock. We use
  //    whatsapp_pending_replies.last_message_at (updated on every inbound);
  //    fall back to the latest 'user' row if that table has no entry.
  let lastInbound: string | null = null
  const { data: pending } = await supabase
    .from('whatsapp_pending_replies')
    .select('last_message_at')
    .eq('phone_number', phoneNumber)
    .single()
  lastInbound = pending?.last_message_at ?? null

  if (!lastInbound) {
    const { data: lastUser } = await supabase
      .from('whatsapp_conversations')
      .select('created_at')
      .eq('phone_number', phoneNumber)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    lastInbound = lastUser?.created_at ?? null
  }

  const withinWindow =
    lastInbound != null && Date.now() - new Date(lastInbound).getTime() < WINDOW_MS

  if (!withinWindow) {
    return {
      ok: false,
      outsideWindow: true,
      error:
        'This patient last messaged more than 24 hours ago, so WhatsApp will ' +
        'not deliver a typed reply. Send an approved template instead.',
    }
  }

  // 3. Send free-form. formatNigerianPhone normalises the number.
  const to = formatNigerianPhone(phoneNumber) ?? phoneNumber.replace(/\D/g, '')
  const result = await sendWhatsAppMessage(to, body)
  if (!result.success) {
    return { ok: false, error: result.error ?? 'WhatsApp send failed' }
  }

  // Log the staff message (role 'staff') and take over the conversation, so
  // Iris pauses. Both via the admin client (bypasses RLS, works reliably).
  const sb = admin()
  await sb.from('whatsapp_conversations').insert({
    phone_number: to,
    role: 'staff',
    message: body,
    // If your table has a 'sent_by' or similar column, you can store
    // staff.full_name there. We prefix nothing so the patient-facing text is
    // exactly what was typed; staff identity lives in the audit/history.
  })
  await sb.from('conversation_controls').upsert(
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
