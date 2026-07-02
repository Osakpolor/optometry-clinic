'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function deletePatient(patientId: string) {
  const supabase = await createClient()

  // Verify the requesting user is an admin — never trust the client for this
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffProfile?.role !== 'admin') {
    return { error: 'Only admins can delete patient records.' }
  }

  // Soft delete — set deleted_at instead of actually removing the row.
  // The patient's visits, appointments, and audit log entries all stay
  // intact. The patient simply disappears from all normal views.
  const { error } = await supabase
    .from('patients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', patientId)

  if (error) return { error: error.message }

  return { success: true }
}
