'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserRole, canDeleteVisits } from '@/lib/auth/roles'

export async function deleteVisit(visitId: string): Promise<{ error?: string; success?: boolean }> {
  // Doctors and admins may delete visit records
  const userRole = await getUserRole()
  if (!canDeleteVisits(userRole)) {
    return { error: 'You do not have permission to delete visit records.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the visit WITH the details we want to snapshot into the audit log,
  // plus the patient's name and file number — because after the hard delete
  // this information is gone, so the audit row must carry it.
  const { data: visit, error: fetchError } = await supabase
    .from('visit_records')
    .select(`
      id, patient_id, visit_date, diagnosis,
      patients ( full_name, file_number, legacy_id )
    `)
    .eq('id', visitId)
    .single()

  if (fetchError || !visit) {
    return { error: 'Visit record not found.' }
  }

  const patient: any = (visit as any).patients ?? {}

  // Look up the acting staff member's name for the audit trail
  let staffName: string | null = null
  if (user?.id) {
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    staffName = staff?.full_name ?? null
  }

  // Write the audit row BEFORE deleting (the visit is about to vanish).
  // details jsonb carries a human-readable snapshot of what was removed.
  await supabase.from('audit_log').insert({
    staff_id: user?.id ?? null,
    patient_id: visit.patient_id,
    action: 'DELETE',
    table_name: 'visit_records',
    record_id: visit.id,
    details: {
      deleted_by_name: staffName,
      deleted_by_role: userRole,
      patient_name: patient.full_name ?? null,
      file_number: patient.file_number ?? patient.legacy_id?.toString() ?? null,
      visit_date: visit.visit_date ?? null,
      diagnosis: visit.diagnosis ?? null,
    },
  })

  // Now perform the hard delete
  const { error: deleteError } = await supabase
    .from('visit_records')
    .delete()
    .eq('id', visitId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  return { success: true }
}
