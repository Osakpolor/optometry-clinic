'use server'

// app/actions/conversationBadges.ts
// Lightweight unread count for the nav badge: how many conversations have a
// patient message newer than this staff member's last read. Bounded to the
// last 30 days so it stays cheap.

import { createClient as createAdmin } from '@supabase/supabase-js'
import { getCurrentStaff, resolveAccess } from '@/lib/conversationAccess'

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getUnreadThreadCount(): Promise<number> {
  const staff = await getCurrentStaff()
  if (!staff) return 0
  const access = await resolveAccess(staff.role)
  if (access.view === 'none') return 0

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sb = admin()

  const [{ data: inbound }, { data: reads }] = await Promise.all([
    sb.from('whatsapp_conversations')
      .select('phone_number, created_at')
      .eq('role', 'user')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000),
    sb.from('conversation_reads')
      .select('phone_number, last_read_at')
      .eq('staff_id', staff.id),
  ])

  const latest = new Map<string, string>()
  for (const r of inbound ?? []) if (!latest.has(r.phone_number)) latest.set(r.phone_number, r.created_at)
  const readMap = new Map<string, string>()
  for (const r of reads ?? []) readMap.set(r.phone_number, r.last_read_at)

  let count = 0
  for (const [phone, ts] of latest) {
    const read = readMap.get(phone)
    if (!read || new Date(ts) > new Date(read)) count++
  }
  return count
}
