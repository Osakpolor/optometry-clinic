'use server'

// app/actions/sendVisitWhatsApp.ts
//
// THE single shared action for the post-visit "thank-you + next appointment"
// send (utility template olu_visit_thankyou_v4). Callable from:
//   • the new-visit save (NewVisitForm)
//   • the edit-visit save (EditVisitForm)
//   • a manual "send thank-you" button (Phase 2)
//
// It owns ALL the rules so every caller behaves identically:
//   1. Hard date guard — only send when a real appointment date is set and is
//      today-or-later. No date / past date -> skip (we never say "your next
//      appointment is <blank/old>").
//   2. Once-only guard (dedup) — never double-send the thank-you for the same
//      patient + same appointment date. Implemented with the visit_records
//      `thankyou_sent_at` column under this invariant:
//
//        thankyou_sent_at IS NOT NULL  ⟺  a thank-you was already sent for THIS
//        visit's CURRENT follow_up_date.
//
//      Maintained by: stamping thankyou_sent_at after a successful send, and
//      (in EditVisitForm) clearing it whenever follow_up_date is changed, so a
//      genuinely new/changed future date can fire again. The dedup check looks
//      across ALL of the patient's visits for that date, so a SECOND same-day
//      visit with the same date is correctly suppressed, while a re-save of an
//      already-sent visit is also suppressed (it finds its own stamp).
//   3. Messaging controls (automated_sends_enabled + test-mode allowlist) are
//      enforced inside sendVisitThankYou.
//
// NOTE: `thankyou_sent_at` already exists on visit_records — no migration.

import { createClient } from '@/lib/supabase/server'
import { sendVisitThankYou } from '@/lib/whatsapp'

export type ThankYouResult = {
  success: boolean
  error?: string
  // true when we deliberately did not send because one already went out for this
  // patient + appointment date (lets callers distinguish "blocked" from "failed").
  alreadySent?: boolean
}

export async function sendVisitWhatsApp(
  patientId: string,
  visitId: string
): Promise<ThankYouResult> {
  const supabase = await createClient()

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('full_name, first_name, phone')
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
    .select('follow_up_date, thankyou_sent_at')
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
  // Has a thank-you already gone out for THIS patient and THIS date — on this
  // visit (a re-save) or any sibling visit (a second same-day visit)? If so,
  // don't send again. This is the deliberate dedup.
  const { data: alreadySentRows, error: dedupError } = await supabase
    .from('visit_records')
    .select('id')
    .eq('patient_id', patientId)
    .eq('follow_up_date', appointmentDate)
    .not('thankyou_sent_at', 'is', null)
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

  // -- Send --------------------------------------------------------------------
  const result = await sendVisitThankYou({
    patientName: patient.full_name,
    patientFirstName: patient.first_name,
    patientPhone: patient.phone,
    followUpDate: visit.follow_up_date,
  })

  // -- Stamp on success so the once-only guard holds next time -----------------
  // Only stamp on a real success; a disabled/test-mode/API failure stays
  // unstamped so a later retry can still send.
  if (result.success) {
    await supabase
      .from('visit_records')
      .update({ thankyou_sent_at: new Date().toISOString() })
      .eq('id', visitId)
  }

  return result
}
