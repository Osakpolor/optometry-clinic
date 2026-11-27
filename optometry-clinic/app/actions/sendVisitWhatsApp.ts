'use server'

// app/actions/sendVisitWhatsApp.ts
//
// THE single shared action for the post-visit "thank-you + next appointment"
// send. Callable from:
//   • the new-visit save (NewVisitForm)
//   • the edit-visit save (EditVisitForm)
//   • a manual "send thank-you" button (Phase 2)
//
// It owns ALL the rules so every caller behaves identically:
//   1. Hard date guard — only send when a real appointment date is set and is
//      today-or-later. No date / past date -> skip (we never say "your next
//      appointment is <blank/old>").
//   2. Once-only guard (dedup) — never double-send the thank-you for the same
//      patient + same appointment date. Keyed on `thankyou_sent_for_date`: the
//      DATE a thank-you was actually sent FOR (recorded at send time). Dedup is
//      simply "does any visit for this patient have thankyou_sent_for_date =
//      targetDate?" Fully server-authoritative, needs NO client-side date
//      comparison, and a re-save can never wipe the marker.
//      (`thankyou_sent_at` is kept purely as an audit timestamp of WHEN.)
//   3. Messaging controls (automated_sends_enabled + test-mode allowlist) are
//      enforced inside sendVisitThankYou.
//   4. REVIEW LINK (admin setting "Review link in thank-you"): decides whether
//      this thank-you asks for a Google review (template v5) or not (v4):
//        • 'always'   — always ask
//        • 'once'     — ask only if the patient has never been asked
//        • 'interval' — ask again once it's been N days since last asked
//      We stamp patients.review_request_sent_at ("last asked") ONLY when the
//      review link actually went out (v5 accepted). If v5 was capped/failed and
//      fell back to v4, we do NOT stamp, so the patient is asked again next time.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendVisitThankYou } from '@/lib/whatsapp'
import { getSettings } from '@/lib/settings'

export type ThankYouResult = {
  success: boolean
  error?: string
  // true when we deliberately did not send because one already went out for this
  // patient + appointment date (lets callers distinguish "blocked" from "failed").
  alreadySent?: boolean
}

// Decide whether THIS thank-you should carry the review link, from the admin
// setting + when the patient was last asked.
function shouldAskForReview(
  mode: 'always' | 'once' | 'interval',
  intervalDays: number,
  lastAskedAt: string | null
): boolean {
  if (mode === 'always') return true
  if (lastAskedAt == null) return true          // never asked → ask (once + interval)
  if (mode === 'once') return false             // asked before → never again
  // interval: ask again only once enough time has passed since last asked.
  const last = new Date(lastAskedAt).getTime()
  if (Number.isNaN(last)) return true
  return Date.now() - last >= intervalDays * 24 * 60 * 60 * 1000
}

export async function sendVisitWhatsApp(
  patientId: string,
  visitId: string
): Promise<ThankYouResult> {
  const supabase = await createClient()

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('full_name, first_name, phone, review_request_sent_at')
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    return { success: false, error: 'Patient not found' }
  }
  if (!patient.phone) {
    return { success: false, error: 'No phone number on record' }
  }

  const { data: visit, error: visitError } = await supabase
    .from('visit_records')
    .select('follow_up_date')
    .eq('id', visitId)
    .single()

  if (visitError || !visit) {
    return { success: false, error: 'Visit record not found' }
  }

  // -- Guard 1: real, upcoming appointment date --------------------------------
  if (!visit.follow_up_date) {
    return { success: false, error: 'No appointment date set — thank-you skipped' }
  }

  // follow_up_date is 'YYYY-MM-DD' (take 10 chars in case it carries a time).
  // YYYY-MM-DD strings compare chronologically, so plain string compare works.
  const appointmentDate = String(visit.follow_up_date).slice(0, 10)
  const todayWat = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)

  if (appointmentDate < todayWat) {
    return {
      success: false,
      error: `Appointment date ${appointmentDate} is in the past — thank-you skipped`,
    }
  }

  // -- Guard 2: once-only (patient + appointment date) -------------------------
  const { data: alreadySentRows, error: dedupError } = await supabase
    .from('visit_records')
    .select('id')
    .eq('patient_id', patientId)
    .eq('thankyou_sent_for_date', appointmentDate)
    .limit(1)

  if (dedupError) {
    return { success: false, error: `Dedup check failed: ${dedupError.message}` }
  }
  if (alreadySentRows && alreadySentRows.length > 0) {
    return {
      success: false,
      alreadySent: true,
      error: `Thank-you already sent for this patient on ${appointmentDate} — not re-sending`,
    }
  }

  // -- Review-link decision ----------------------------------------------------
  const settings = await getSettings()
  const withReviewLink = shouldAskForReview(
    settings.review_link_mode,
    settings.review_link_interval_days,
    patient.review_request_sent_at ?? null
  )

  // -- Send --------------------------------------------------------------------
  const result = await sendVisitThankYou({
    patientName: patient.full_name,
    patientFirstName: patient.first_name,
    patientPhone: patient.phone,
    followUpDate: visit.follow_up_date,
    withReviewLink,
    patientId,
    visitId,
  })

  // -- Stamp on success so the guards hold next time ---------------------------
  // Only stamp on a real success; a disabled/test-mode/API failure stays
  // unstamped so a later retry can still send.
  if (result.success) {
    await supabase
      .from('visit_records')
      .update({
        thankyou_sent_for_date: appointmentDate,     // dedup key
        thankyou_sent_at: new Date().toISOString(),   // audit: when
      })
      .eq('id', visitId)

    // Stamp "last asked" ONLY when the review link actually went out (v5
    // accepted). A v4 fallback (capped/failed v5) leaves this null/unchanged so
    // the patient is asked again next time. Written with the service-role client
    // so the stamp can't be silently dropped by RLS — it's a system marker the
    // once/interval modes depend on.
    if (result.reviewLinkSent) {
      await createAdminClient()
        .from('patients')
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq('id', patientId)
    }
  }

  return result
}
