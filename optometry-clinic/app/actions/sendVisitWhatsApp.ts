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
//      patient + same appointment date. Keyed on `thankyou_sent_for_date`: the
//      DATE a thank-you was actually sent FOR (recorded at send time). Dedup is
//      simply "does any visit for this patient have thankyou_sent_for_date =
//      targetDate?" This is fully server-authoritative and needs NO client-side
//      date comparison (the previous approach compared the incoming date to the
//      client's STALE originally-loaded value and re-sent on every re-save):
//        • re-saving the same date  -> row already has that sent-for-date -> skip
//        • a genuinely new/changed date -> no row has it yet -> send
//        • a 2nd same-day visit, same date -> the 1st visit's row has it -> skip
//      No clearing is ever required, so a re-save can never wipe the marker.
//      (`thankyou_sent_at` is kept purely as an audit timestamp of WHEN.)
//   3. Messaging controls (automated_sends_enabled + test-mode allowlist) are
//      enforced inside sendVisitThankYou.
//
// NOTE: `thankyou_sent_for_date` is an additive migration (see supabase/
// migrations). `thankyou_sent_at` already existed.

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
  // Has a thank-you already gone out for THIS patient FOR THIS date — on this
  // visit (a re-save) or any sibling visit (a second same-day visit)? Keyed on
  // the recorded sent-for-date, so this never depends on client state and a
  // re-save can never wipe it. If found, don't send again.
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
      .update({
        thankyou_sent_for_date: appointmentDate,       // dedup key
        thankyou_sent_at: new Date().toISOString(),     // audit: when
      })
      .eq('id', visitId)
  }

  return result
}
