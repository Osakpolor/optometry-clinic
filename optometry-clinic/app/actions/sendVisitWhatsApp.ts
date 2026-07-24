'use server'

// app/actions/sendVisitWhatsApp.ts
// AUTO-SEND after a new visit is saved. Now sends the warm thank-you
// (no clinical detail). The diagnosis + prescription is sent separately,
// only when the doctor explicitly triggers it from the visit detail page.

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

  // Thank-you always sends (no diagnosis gate) — it contains no clinical
  // detail, just gratitude + appointment + review button.
  return sendVisitThankYou({
    patientName: patient.full_name,
    patientPhone: patient.phone,
    followUpDate: visit.follow_up_date,
  })
}
