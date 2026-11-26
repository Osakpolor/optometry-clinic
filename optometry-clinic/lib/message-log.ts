// lib/message-log.ts
// One job: record every NON-broadcast WhatsApp send into message_log, so a
// send that Meta "accepts" but never delivers is visible instead of silent
// (the 6-week billing-restriction incident). The webhook later upgrades the
// row's status from Meta's delivery receipts (sent/delivered/read/failed).
//
// Broadcasts are NOT logged here — they already have full per-recipient
// tracking in broadcast_recipients. A given wa_message_id lives in exactly one
// of the two tables.
//
// INVARIANT: logging must NEVER block or break a real send. Every call is
// wrapped in try/catch and swallows its own errors. It has its own
// service-role client so it works in server actions AND the cron.

import { createClient as createSbClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone-utils'

// The categories of outgoing message we track. Mirrors the CHECK constraint
// on message_log.kind.
export type MessageKind =
  | 'thankyou'
  | 'reminder'
  | 'summary'
  | 'booking'
  | 'manual'
  | 'iris'
  | 'other'

// The outcome of the Graph API call, as the caller observed it.
export type SendOutcome =
  | { ok: true; waMessageId: string | null }
  | {
      ok: false
      errorCode: number | null
      errorTitle: string | null
      errorDetails: string | null
    }

function admin() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Insert one message_log row for a send that actually reached the Graph API.
 *
 * Call this ONLY after an API attempt — never for a send skipped by a
 * messaging-control gate (automated-sends-off / test-mode), which makes no API
 * call and so is not a tracked send.
 *
 * Returns nothing and never throws. (The caller already has Meta's message id
 * from the API response; it does not need one back from here.)
 */
export async function logMessageSend(params: {
  phone: string
  kind: MessageKind
  templateName?: string | null
  patientId?: string | null
  outcome: SendOutcome
}): Promise<void> {
  try {
    const row = {
      // Canonical local form (e.g. 8012345678) — same key the rest of the app
      // matches on. NOTE: normalizePhone() strips the 234/leading-0, it does
      // not add a 234 prefix. Last-4 digits (used by Phase B alerts) are
      // identical either way.
      phone: normalizePhone(params.phone),
      kind: params.kind,
      template_name: params.templateName ?? null,
      patient_id: params.patientId ?? null,
      status: params.outcome.ok ? 'accepted' : 'failed',
      wa_message_id: params.outcome.ok ? params.outcome.waMessageId : null,
      error_code: params.outcome.ok ? null : params.outcome.errorCode,
      error_title: params.outcome.ok ? null : params.outcome.errorTitle,
      error_details: params.outcome.ok ? null : params.outcome.errorDetails,
      status_updated_at: new Date().toISOString(),
    }
    await admin().from('message_log').insert(row)
  } catch (err) {
    console.error('logMessageSend failed (non-blocking):', err)
  }
}
