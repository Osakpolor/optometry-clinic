'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/roles'

export async function deleteVisit(visitId: string): Promise<{ error?: string; success?: boolean }> {
  // Only admins can delete visit records
  const userRole = await getUserRole()
  if (userRole !== 'admin') {
    return { error: 'Only admins can delete visit records.' }
  }

  const supabase = await createClient()

  // Confirm the visit exists before attempting deletion
  const { data: visit, error: fetchError } = await supabase
    .from('visit_records')
    .select('id')
    .eq('id', visitId)
    .single()

  if (fetchError || !visit) {
    return { error: 'Visit record not found.' }
  }

  const { error: deleteError } = await supabase
    .from('visit_records')
    .delete()
    .eq('id', visitId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  return { success: true }
}