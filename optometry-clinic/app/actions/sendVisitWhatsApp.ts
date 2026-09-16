'use server'

// app/actions/sendVisitWhatsApp.ts
// AUTO-SEND after a new visit is saved: the warm thank-you only (no clinical
// detail — gratitude + next appointment). The diagnosis + prescription is sent
// separately, only when the doctor explicitly triggers it from the visit
// detail page.
//
// HARD RULE: the thank-you is sent ONLY when a real, upcoming appointment date
// is set. No date -> no send. A date in the past (stale) -> no send. This keeps
// us from telling a patient "your next appointment is <blank/old date>".

import { createClient } from '@/lib/supabase/server'
import { sendVisitThankYou } from '@/lib/whatsapp'

export async function sendVisitWhatsApp(
  patientId: string,
  visitId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('full_name, phone')
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

  // -- HARD appointment-date guard --------------------------
  // Only send when there's a real appointment date that is today or later.
  if (!visit.follow_up_date) {
    return { success: false, error: 'No appointment date set — thank-you skipped' }
  }

  // Compare on calendar dates in WAT (UTC+1). follow_up_date is 'YYYY-MM-DD'
  // (take the first 10 chars in case it ever carries a time). YYYY-MM-DD
  // strings compare chronologically, so a plain string compare is correct.
  const appointmentDate = String(visit.follow_up_date).slice(0, 10)
  const todayWat = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)

  if (appointmentDate < todayWat) {
    return {
      success: false,
      error: `Appointment date ${appointmentDate} is in the past — thank-you skipped`,
    }
  }

  // Passed the guard: real, upcoming (or today) appointment → send the thank-you.
  return sendVisitThankYou({
    patientName: patient.full_name,
    patientPhone: patient.phone,
    followUpDate: visit.follow_up_date,
  })
}
