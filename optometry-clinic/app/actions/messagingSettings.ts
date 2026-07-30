'use server'

// app/actions/messagingSettings.ts
// Read + update the messaging control settings (AI on/off, automated sends
// on/off, test mode + allowlist). ADMIN ONLY — every action re-checks the
// caller's role server-side, so this can't be abused even if the UI is bypassed.

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getSettings, type AppSettings } from '@/lib/settings'

// Gate: must be a signed-in admin. Returns ok:false with a reason otherwise.
async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { ok: false, error: 'Admins only' }
  return { ok: true }
}

export async function getMessagingSettings(): Promise<{
  settings?: AppSettings
  error?: string
}> {
  const gate = await requireAdmin()
  if (!gate.ok) return { error: gate.error }
  return { settings: await getSettings() }
}

export async function updateMessagingSettings(
  updates: Partial<AppSettings>
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: gate.error }

  // Write with the service-role admin client (app_settings has no browser RLS).
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: value as unknown,           // stored as jsonb (bool or string[])
    updated_at: new Date().toISOString(),
  }))

  const { error } = await admin
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
