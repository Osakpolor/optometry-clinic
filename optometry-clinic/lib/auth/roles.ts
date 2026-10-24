import { createClient } from '@/lib/supabase/server'

export async function getUserRole(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return data?.role ?? null
}

export function canManageVisits(role: string | null): boolean {
  return role === 'doctor' || role === 'admin'
}

// Doctors and admins can delete visit records (doctors catch their own
// mistaken entries). Patient deletion remains admin-only below.
export function canDeleteVisits(role: string | null): boolean {
  return role === 'doctor' || role === 'admin'
}

// The SINGLE rule for all of Scheduling: the hub nav link, the
// /dashboard/scheduling page guard, and every scheduling server action
// (book / reschedule / cancel / confirm / approve-rebook / decline-rebook /
// patient search) all gate on exactly this set. All three staff roles do
// front-desk scheduling, so all three qualify — there is deliberately no
// separate "front-desk only" concept. This is the real guard, not just
// hidden buttons.
export function canManageAppointments(role: string | null): boolean {
  return role === 'receptionist' || role === 'doctor' || role === 'admin'
}

export function canManageFileNumber(role: string | null): boolean {
  return role === 'admin'
}

export function canDeletePatients(role: string | null): boolean {
  return role === 'admin'
}

export function canManageStaff(role: string | null): boolean {
  return role === 'admin'
}

// Broadcasts are marketing sends to the whole patient base, so they are
// admin-only — matching the admin-only RLS on the broadcasts tables.
export function canManageBroadcasts(role: string | null): boolean {
  return role === 'admin'
}

// Only admins can view the audit trail
export function canViewAudit(role: string | null): boolean {
  return role === 'admin'
}
