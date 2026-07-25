'use server'

// app/actions/getPatientVisits.ts
// Lightweight fetch of a patient's past visits for the Past Visits panel.
// Lazy-called only when the doctor opens the panel. Excludes the current
// visit (when editing) so they only see prior history.

import { createClient } from '@/lib/supabase/server'

export async function getPatientVisits(
  patientId: string,
  excludeVisitId?: string
): Promise<{ visits?: any[]; error?: string }> {
  const supabase = await createClient()

  let query = supabase
    .from('visit_records')
    .select(`
      id, visit_date, diagnosis, reason_for_visit,
      eye_test_results, refraction, anterior_segment,
      posterior_segment, medications, notes,
      doctor:staff_profiles!visit_records_doctor_id_fkey(full_name)
    `)
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false })

  if (excludeVisitId) {
    query = query.neq('id', excludeVisitId)
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return { visits: data ?? [] }
}
