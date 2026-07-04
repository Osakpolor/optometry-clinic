'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const VALID_ROLES = ['admin', 'doctor', 'receptionist'] as const
type Role = typeof VALID_ROLES[number]

export async function inviteStaffMember(
  email: string,
  fullName: string,
  role: Role
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffProfile?.role !== 'admin') {
    return { error: 'Only admins can invite staff members.' }
  }

  if (!email || !fullName || !role) {
    return { error: 'Email, name and role are all required.' }
  }

  if (!VALID_ROLES.includes(role)) {
    return { error: 'Invalid role.' }
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role },
      redirectTo: `${siteUrl}/auth/confirm`,
    })

  if (inviteError) {
    if (inviteError.message.includes('already been registered')) {
      return { error: 'A staff member with this email already exists.' }
    }
    return { error: inviteError.message }
  }

  // Use upsert so a re-invite for an existing auth user updates the row
  // instead of colliding on the primary key.
  const { error: profileError } = await adminClient
    .from('staff_profiles')
    .upsert({
      id: inviteData.user.id,
      full_name: fullName,
      email,
      role,
      is_active: true,
    })

  // If the profile row fails, surface it instead of hiding it — otherwise
  // the user can log in but has no role, leads, or follow-ups.
  if (profileError) {
    return {
      error: `Invite email was sent, but creating the staff profile failed: ${profileError.message}. The account will not work until this is fixed.`,
    }
  }

  return { success: true }
}

export async function updateStaffRole(staffId: string, newRole: Role) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffProfile?.role !== 'admin') {
    return { error: 'Only admins can change roles.' }
  }

  if (staffId === user.id) {
    return { error: 'You cannot change your own role.' }
  }

  if (!VALID_ROLES.includes(newRole)) {
    return { error: 'Invalid role.' }
  }

  const { error } = await supabase
    .from('staff_profiles')
    .update({ role: newRole })
    .eq('id', staffId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function toggleStaffActive(staffId: string, isActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffProfile?.role !== 'admin') {
    return { error: 'Only admins can deactivate staff.' }
  }

  if (staffId === user.id) {
    return { error: 'You cannot deactivate your own account.' }
  }

  const { error } = await supabase
    .from('staff_profiles')
    .update({ is_active: isActive })
    .eq('id', staffId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteStaffMember(staffId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Only admins can delete staff
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (staffProfile?.role !== 'admin') {
    return { error: 'Only admins can delete staff members.' }
  }

  // An admin cannot delete themselves
  if (staffId === user.id) {
    return { error: 'You cannot delete your own account.' }
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // SAFETY CHECK (Option A): block deletion if this staff member has
  // recorded any clinical visits. Their doctor_id is attached to real
  // patient medical records, which must never be orphaned or lost.
  const { count: visitCount, error: visitError } = await adminClient
    .from('visit_records')
    .select('id', { count: 'exact', head: true })
    .eq('doctor_id', staffId)

  if (visitError) {
    return { error: `Could not verify clinical records: ${visitError.message}` }
  }

  if ((visitCount ?? 0) > 0) {
    return {
      error:
        `This staff member has recorded ${visitCount} clinical visit(s) and cannot be deleted, ` +
        `because their name is attached to patient medical records. ` +
        `Deactivate them instead to preserve those records.`,
    }
  }

  // No clinical history — safe to delete.
  // 1. Delete the auth user. Because staff_profiles.id references
  //    auth.users(id) ON DELETE CASCADE, removing the auth user also
  //    removes the staff_profiles row automatically. And audit_log.staff_id
  //    is now ON DELETE SET NULL, so audit history is preserved.
  const { error: authDeleteError } =
    await adminClient.auth.admin.deleteUser(staffId)

  if (authDeleteError) {
    return { error: `Failed to delete staff account: ${authDeleteError.message}` }
  }

  return { success: true }
}