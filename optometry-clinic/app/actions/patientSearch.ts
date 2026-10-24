'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, canManageAppointments } from '@/lib/auth/roles'

export type PatientHit = {
  id: string
  full_name: string | null
  file_number: string | null
  phone: string | null
}

// Typeahead for the calendar's "Book on this day" flow. Read-only and
// role-guarded (the real gate — the booking itself is guarded again by
// bookAppointment). Uses the service-role client for the same reason the
// Patients page does: patient reads are otherwise RLS-restricted by role, and
// front-desk staff legitimately need to find any patient to book them.
export async function searchPatients(
  query: string
): Promise<{ error?: string; results: PatientHit[] }> {
  const role = await getUserRole()
  if (!canManageAppointments(role)) {
    return { error: 'You do not have permission to search patients.', results: [] }
  }

  const q = query.trim()
  if (q.length < 2) return { results: [] }

  // Escape PostgREST reserved characters so a stray comma/paren in the query
  // can't break out of the filter expression.
  const safe = q.replace(/[,()*]/g, ' ').trim()
  if (!safe) return { results: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('patients')
    .select('id, full_name, file_number, phone')
    .is('deleted_at', null)
    .or(`full_name.ilike.%${safe}%,file_number.ilike.%${safe}%`)
    .limit(8)

  if (error) return { error: error.message, results: [] }
  return { results: data ?? [] }
}
