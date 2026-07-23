'use server'

// app/actions/sendVisitWhatsApp.ts
// Server action that fetches patient details and fires the WhatsApp
// post-visit summary. Called from NewVisitForm after a successful save.

import { createClient } from '@/lib/supabase/server'
import { sendVisitSummaryWhatsApp } from '@/lib/whatsapp'

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
    .select('diagnosis, medications, follow_up_date')
    .eq('id', visitId)
    .single()

  if (visitError || !visit) {
    return { success: false, error: 'Visit record not found' }
  }

  // Guard: don't message the patient unless there's an actual diagnosis.
  // The template reads "you are diagnosed of {{2}}", so without a real
  // diagnosis the message is meaningless ("diagnosed of See clinic notes").
  // A visit saved without a diagnosis is almost always incomplete — the
  // doctor will finish it via Edit visit, and can trigger the summary then.
  if (!visit.diagnosis || !visit.diagnosis.trim()) {
    return { success: false, error: 'No diagnosis recorded — summary not sent' }
  }

  return sendVisitSummaryWhatsApp({
    patientName: patient.full_name,
    patientPhone: patient.phone,
    diagnosis: visit.diagnosis,
    medications: visit.medications ?? [],
    followUpDate: visit.follow_up_date,
  })
}