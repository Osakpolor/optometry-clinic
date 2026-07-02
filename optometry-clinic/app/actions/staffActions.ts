'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Valid roles for staff members
const VALID_ROLES = ['admin', 'doctor', 'receptionist'] as const
type Role = typeof VALID_ROLES[number]

export async function inviteStaffMember(
  email: string,
  fullName: string,
  role: Role
) {
  // 1. Verify the requesting user is an admin
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

  // 2. Validate inputs
  if (!email || !fullName || !role) {
    return { error: 'Email, name and role are all required.' }
  }
  if (!VALID_ROLES.includes(role)) {
    return { error: 'Invalid role.' }
  }

  // 3. Use the Supabase Admin client to send the invite email.
  //    This requires the service role key — never exposed to the client.
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        full_name: fullName,
        role,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    }
  )

  if (inviteError) {
    // User already exists in Auth
    if (inviteError.message.includes('already been registered')) {
      return { error: 'A staff member with this email already exists.' }
    }
    return { error: inviteError.message }
  }

  // 4. Create the staff_profile row immediately so the user
  //    appears in the staff list before they accept the invite.
  const { error: profileError } = await adminClient
    .from('staff_profiles')
    .insert({
      id: inviteData.user.id,
      full_name: fullName,
      email,
      role,
      is_active: true,
    })

  if (profileError) {
    // Profile might already exist — not a fatal error
    console.error('Staff profile insert error:', profileError)
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

  // Prevent admin from demoting themselves
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
