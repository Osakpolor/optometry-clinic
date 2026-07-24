'use server'

// app/actions/sendClinicalSummary.ts
// DOCTOR-TRIGGERED send of the clinical summary (diagnosis + prescription)
// via the existing olu_eye_clinic_visit_summary_v2 template. Fired from a
// button on the visit detail page, only after the doctor has verified the
// record. Records a timestamp so the UI can show "sent" and prevent
// accidental double-sends.

import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'
import { sendVisitSummaryWhatsApp } from '@/lib/whatsapp'

export async function sendClinicalSummary(
  visitId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Only doctors and admins may send clinical detail to a patient
  const role = await getUserRole()
  if (role !== 'doctor' && role !== 'admin') {
    return { success: false, error: 'Not authorised to send clinical summaries.' }
  }

  const { data: visit, error: visitError } = await supabase
    .from('visit_records')
    .select('patient_id, diagnosis, medications, follow_up_date, clinical_summary_sent_at')
    .eq('id', visitId)
    .single()

  if (visitError || !visit) {
    return { success: false, error: 'Visit record not found' }
  }

  // Require a diagnosis — sending clinical detail with none is pointless
  if (!visit.diagnosis || !visit.diagnosis.trim()) {
    return { success: false, error: 'Add a diagnosis before sending the clinical summary.' }
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('full_name, phone')
    .eq('id', visit.patient_id)
    .single()

  if (patientError || !patient) {
    return { success: false, error: 'Patient not found' }
  }
  if (!patient.phone) {
    return { success: false, error: 'No phone number on record for this patient.' }
  }

  const result = await sendVisitSummaryWhatsApp({
    patientName: patient.full_name,
    patientPhone: patient.phone,
    diagnosis: visit.diagnosis,
    medications: visit.medications ?? [],
    followUpDate: visit.follow_up_date,
  })

  if (result.success) {
    // Stamp the send time so the UI shows "sent" and guards re-sends
    await supabase
      .from('visit_records')
      .update({ clinical_summary_sent_at: new Date().toISOString() })
      .eq('id', visitId)
  }

  return result
}
