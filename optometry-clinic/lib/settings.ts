// lib/settings.ts
// Central messaging control layer. The webhook, cron, and send functions all
// read this before doing anything, so an admin can pause the AI, pause the
// automated Meta messages, or restrict all sends to a test allowlist.
//
// Access is server-side only, via the service-role admin client (so it works
// in the webhook and cron, which have no user session). The app_settings table
// has no RLS policy for browsers — writes go through an admin-gated action.

import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone-utils'

export type AppSettings = {
  ai_enabled: boolean               // Iris replies to inbound WhatsApp messages
  automated_sends_enabled: boolean  // thank-yous + appointment reminders fire
  test_mode: boolean                // when true, ONLY test_numbers receive anything
  test_numbers: string[]            // allowlist (any format; matched loosely)
}

// Safe defaults. If the table read ever fails, we FAIL OPEN to normal operation
// (ai on, sends on, no test restriction) rather than silently going dark —
// except we keep test_mode off, so a glitch never traps you in test mode.
const DEFAULTS: AppSettings = {
  ai_enabled: true,
  automated_sends_enabled: true,
  test_mode: false,
  test_numbers: [],
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const sb = adminClient()
    const { data, error } = await sb.from('app_settings').select('key, value')
    if (error || !data) return DEFAULTS

    const map = new Map(data.map(r => [r.key, r.value]))
    return {
      ai_enabled:
        typeof map.get('ai_enabled') === 'boolean'
          ? (map.get('ai_enabled') as boolean)
          : DEFAULTS.ai_enabled,
      automated_sends_enabled:
        typeof map.get('automated_sends_enabled') === 'boolean'
          ? (map.get('automated_sends_enabled') as boolean)
          : DEFAULTS.automated_sends_enabled,
      test_mode:
        typeof map.get('test_mode') === 'boolean'
          ? (map.get('test_mode') as boolean)
          : DEFAULTS.test_mode,
      test_numbers: Array.isArray(map.get('test_numbers'))
        ? (map.get('test_numbers') as string[])
        : DEFAULTS.test_numbers,
    }
  } catch (err) {
    console.error('getSettings failed, using defaults:', err)
    return DEFAULTS
  }
}

// Should a given phone receive a send right now?
// Normal mode: everyone. Test mode: only numbers on the allowlist.
//
// Matching canonicalises BOTH sides to the bare 10-digit local number via the
// shared normalizePhone() helper, so the Nigerian trunk-zero and country-code
// forms line up: 2348118143211, +2348118143211, 08118143211 and 8118143211 all
// compare equal. A plain endsWith check does NOT line these up — the last 11
// digits of 2348118143211 are "48118143211", never "08118143211" — which is the
// exact mismatch that made a real allowlisted number look un-allowlisted at send
// time while the dry-run (checking the already-234 input) said it was allowed.
//
// The looser endsWith comparison is kept as a fallback so any number that
// matched before still matches: this change only ever ADDS matches (it fixes a
// false negative), never removes one — allowlist behaviour stays fail-safe.
export function isAllowedRecipient(phone: string, s: AppSettings): boolean {
  if (!s.test_mode) return true
  const canon = normalizePhone(phone)
  const digits = phone.replace(/\D/g, '')
  if (!canon && !digits) return false
  return s.test_numbers.some(n => {
    const nCanon = normalizePhone(n)
    if (canon && nCanon && canon === nCanon) return true
    const nd = n.replace(/\D/g, '')
    if (!nd) return false
    return digits.endsWith(nd) || nd.endsWith(digits)
  })
}
