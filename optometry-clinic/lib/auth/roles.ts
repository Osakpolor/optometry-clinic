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

export function canManageFileNumber(role: string | null): boolean {
  return role === 'admin'
}

export function canDeletePatients(role: string | null): boolean {
  return role === 'admin'
}

export function canManageStaff(role: string | null): boolean {
  return role === 'admin'
}