// lib/conversationAccess.ts
// The visibility + reply permission layer for the shared WhatsApp inbox.
// Kept separate from lib/settings.ts so the messaging kill-switches and the
// inbox RBAC evolve independently. Reads the 'conv_visibility' key from
// app_settings via the service-role admin client (no browser RLS on that
// table), and resolves a staff role into what they may see and do.
//
// SaaS note: because the model is DATA (a per-role JSON blob in app_settings),
// each future tenant configures its own visibility without code changes. The
// nullable clinic_id columns on the Phase A tables are the multi-tenant seam.

import { createClient as createAdmin } from '@supabase/supabase-js'

export type ConvView = 'none' | 'preview' | 'full'
export type RoleAccess = { view: ConvView; can_reply: boolean }

// Fallback if the setting is missing or malformed. Conservative: receptionist
// gets preview and cannot reply; anyone unrecognised sees nothing.
const DEFAULT_VISIBILITY: Record<string, RoleAccess> = {
  doctor: { view: 'full', can_reply: true },
  receptionist: { view: 'preview', can_reply: false },
}

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Read the per-role visibility map from app_settings.
export async function getConvVisibility(): Promise<Record<string, RoleAccess>> {
  try {
    const { data } = await admin()
      .from('app_settings')
      .select('value')
      .eq('key', 'conv_visibility')
      .single()
    const v = data?.value
    if (v && typeof v === 'object') return v as Record<string, RoleAccess>
    return DEFAULT_VISIBILITY
  } catch {
    return DEFAULT_VISIBILITY
  }
}

// Resolve a single role into its access. Admin is ALWAYS full + can_reply and
// is never governed by the stored map — it can't be locked out of its own
// clinic. Unknown roles get nothing.
export async function resolveAccess(role: string | null | undefined): Promise<RoleAccess> {
  if (role === 'admin') return { view: 'full', can_reply: true }
  if (!role) return { view: 'none', can_reply: false }
  const map = await getConvVisibility()
  return map[role] ?? { view: 'none', can_reply: false }
}

// The signed-in staff member: their id, role, and name. Uses the request-scoped
// server client (respects the user's session), then reads staff_profiles.
// Import lazily to avoid a hard dependency here.
export async function getCurrentStaff(): Promise<
  { id: string; role: string; full_name: string } | null
> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()
  if (!profile) return null
  return { id: user.id, role: profile.role, full_name: profile.full_name }
}
