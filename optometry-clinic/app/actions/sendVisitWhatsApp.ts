'use server'

// app/actions/sendVisitWhatsApp.ts
// Server action that fetches patient details and fires the WhatsApp
// post-visit summary. Called from NewVisitForm after a successful save.
// Running this server-side keeps the WhatsApp token off the client.

import { createClient } from '@/lib/supabase/server'
import { sendVisitSummaryWhatsApp } from '@/lib/whatsapp'

export async function sendVisitWhatsApp(
  patientId: string,
  visitId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Fetch the patient's name and phone number
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('full_name, phone')
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    return { success: false, error: 'Patient not found' }
  }

  // No phone number — skip silently, don't block the visit save flow
  if (!patient.phone) {
    return { success: false, error: 'No phone number on record' }
  }

  // Fetch the visit record for diagnosis, medications, and follow-up date
  const { data: visit, error: visitError } = await supabase
    .from('visit_records')
    .select('diagnosis, medications, follow_up_date')
    .eq('id', visitId)
    .single()

  if (visitError || !visit) {
    return { success: false, error: 'Visit record not found' }
  }

  return sendVisitSummaryWhatsApp({
    patientName: patient.full_name,
    patientPhone: patient.phone,
    diagnosis: visit.diagnosis,
    medications: visit.medications ?? [],
    followUpDate: visit.follow_up_date,
  })
}