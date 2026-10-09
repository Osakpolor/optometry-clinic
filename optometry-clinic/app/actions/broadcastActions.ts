'use server'

// app/actions/broadcastActions.ts
//
// Send-now server action for the WhatsApp Broadcast module. This is the piece
// that turns a draft campaign into a live send:
//   1. admin-only guard,
//   2. create (or update) the broadcasts row,
//   3. enqueue broadcast_recipients for the matching audience,
//   4. flip the broadcast to 'sending' + set total_count,
//   5. kick the self-chaining drain endpoint ONCE.
//
// All writes to broadcasts / broadcast_recipients go through the SERVICE-ROLE
// admin client. The Phase 1 migration deliberately created NO insert/update RLS
// policies on these tables (only an admin SELECT policy), so the user-session
// client cannot write them — the service-role client bypasses RLS by design.
//
// Safety notes:
//   • The marketing opt-out is enforced at enqueue (eq marketing_opted_out,false)
//     AND re-checked per-recipient at send time in the drain — defence in depth.
//   • Test mode / the global pause are NOT applied here. They gate the actual
//     WhatsApp API call inside sendBroadcastTemplate(), so with test mode ON the
//     drain enqueues the matched audience but SKIPS (status 'skipped') every
//     recipient not on the allowlist. To truly enqueue just one test number,
//     target it with the audience filter (see AudienceFilter below) — otherwise
//     you insert a recipient row for every active patient even in test mode.

import { headers } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserRole, canManageBroadcasts } from '@/lib/auth/roles'
import { formatNigerianPhone } from '@/lib/whatsapp'
import { getPhoneVariants } from '@/lib/phone-utils'

// How many patient rows to read per page. PostgREST caps a single read at 1000,
// so we page with .range() even for the service-role client.
const PAGE_SIZE = 1000
// How many recipient rows to insert per call (keeps each insert well-sized).
const INSERT_CHUNK = 500

/**
 * Audience selection for a broadcast.
 *
 * This action OWNS this shape — nothing else consumes broadcasts.audience_filter
 * yet. An empty object (the v1 UI default) means "all active, non-opted-out
 * patients". The targeting keys are AND-combined:
 *   - patient_ids: only these patient rows (exact, best for a controlled test)
 *   - phones:      only patients whose phone matches one of these (any common
 *                  Nigerian format — we expand each via getPhoneVariants)
 *
 * Any OTHER key throws. Silently ignoring an unrecognised filter would send a
 * marketing blast to the WHOLE patient base instead of the intended slice —
 * exactly the kind of silent audience drift the integrity rule forbids. When the
 * UI adds real demographic filters (last-visit range, upcoming appointment, …),
 * extend applyAudienceFilter() below and this type together.
 */
export type AudienceFilter = {
  patient_ids?: string[]
  phones?: string[]
}

const KNOWN_FILTER_KEYS: ReadonlyArray<keyof AudienceFilter> = ['patient_ids', 'phones']

export type SendBroadcastInput = {
  // Omit for a brand-new campaign; pass an existing draft's id to re-use it.
  id?: string | null
  title: string
  templateName: string
  language?: string
  headerImageUrl?: string | null
  bodyParams?: string[]
  buttonUrl?: string | null
  audienceFilter?: AudienceFilter
}

export type SendBroadcastResult =
  | { ok: true; broadcastId: string; totalCount: number }
  | { ok: false; error: string; broadcastId?: string }

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Resolve this deployment's own origin so the drain self-call targets the SAME
// deployment (preview vs production), falling back to the configured site URL.
async function resolveOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

// Apply the audience filter to the patients query. Throws on any unknown key
// (see AudienceFilter) so an unrecognised filter can never widen the audience.
function applyAudienceFilter<T>(query: T, filter: AudienceFilter): T {
  for (const key of Object.keys(filter)) {
    if (!KNOWN_FILTER_KEYS.includes(key as keyof AudienceFilter)) {
      throw new Error(`Unsupported audience filter key: "${key}"`)
    }
  }

  // Each builder method returns a narrowed builder; we thread it back through T.
  let q = query as any

  if (filter.patient_ids && filter.patient_ids.length > 0) {
    q = q.in('id', filter.patient_ids)
  }

  if (filter.phones && filter.phones.length > 0) {
    // Expand every requested number into the formats patients.phone may hold,
    // so "enqueue this one number" works regardless of how it was stored.
    const variants = Array.from(new Set(filter.phones.flatMap((p) => getPhoneVariants(p))))
    q = q.in('phone', variants)
  }

  return q as T
}

/**
 * Create/refresh a broadcast, enqueue its recipients, mark it 'sending', and
 * fire the first drain call. Returns the broadcast id and how many recipients
 * were queued.
 */
export async function sendBroadcastNow(input: SendBroadcastInput): Promise<SendBroadcastResult> {
  // 1. Admin-only guard. Throw (not a soft return) — a non-admin reaching this
  //    server action is a hard authorization failure, not normal flow.
  const role = await getUserRole()
  if (!canManageBroadcasts(role)) {
    throw new Error('Not authorized: broadcasts are admin-only.')
  }

  // Current staff id for broadcasts.created_by (session client, not admin).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  // Basic validation.
  const title = input.title?.trim()
  const templateName = input.templateName?.trim()
  if (!title) return { ok: false, error: 'Title is required.' }
  if (!templateName) return { ok: false, error: 'Template name is required.' }

  const language = input.language?.trim() || 'en'
  const bodyParams = Array.isArray(input.bodyParams) ? input.bodyParams.map((v) => String(v)) : []
  const headerImageUrl = input.headerImageUrl ?? null
  const buttonUrl = input.buttonUrl ?? null
  const audienceFilter: AudienceFilter = input.audienceFilter ?? {}

  const admin = adminClient()

  // Multi-tenant anchor: v1 has exactly one clinic row. Best-effort attach it;
  // leave null if absent so a fresh environment doesn't hard-fail here.
  // TODO(multi-tenant): derive clinic_id from the signed-in user's clinic.
  let clinicId: string | null = null
  {
    const { data: clinic } = await admin
      .from('clinics')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    clinicId = clinic?.id ?? null
  }

  // 2. Create or update the broadcast row (service-role — RLS has no write
  //    policy). Counts are reset to 0 so a re-sent draft starts clean; the drain
  //    rolls them back up from the recipient rows as it sends.
  const row = {
    clinic_id: clinicId,
    title,
    template_name: templateName,
    language,
    header_image_url: headerImageUrl,
    body_params: bodyParams,
    button_url: buttonUrl,
    audience_filter: audienceFilter,
    status: 'draft' as const,
    total_count: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    capped_count: 0,
    created_by: user.id,
  }

  let broadcastId: string

  if (input.id) {
    // Re-use an existing draft. Refuse if it has already left 'draft' so we can
    // never re-enqueue / double-send an in-flight or completed campaign.
    const { data: existing, error: readErr } = await admin
      .from('broadcasts')
      .select('id, status')
      .eq('id', input.id)
      .maybeSingle()
    if (readErr) return { ok: false, error: readErr.message }
    if (!existing) return { ok: false, error: 'Broadcast not found.' }
    if (existing.status !== 'draft') {
      return {
        ok: false,
        error: `Broadcast is already "${existing.status}" and cannot be re-sent.`,
        broadcastId: existing.id,
      }
    }

    const { error: updErr } = await admin.from('broadcasts').update(row).eq('id', input.id)
    if (updErr) return { ok: false, error: updErr.message }
    broadcastId = input.id

    // Clean slate: drop any recipients left by a previous partial enqueue of
    // this draft, so re-running can't create duplicates.
    const { error: delErr } = await admin
      .from('broadcast_recipients')
      .delete()
      .eq('broadcast_id', broadcastId)
    if (delErr) return { ok: false, error: delErr.message }
  } else {
    const { data: created, error: insErr } = await admin
      .from('broadcasts')
      .insert(row)
      .select('id')
      .single()
    if (insErr) return { ok: false, error: insErr.message }
    broadcastId = created.id
  }

  // 3. Enqueue recipients. Page the patients table with .range() (PostgREST
  //    caps a single read at 1000). Mandatory filters first, then the audience
  //    filter; skip any row without a valid Nigerian phone.
  let recipients: { broadcast_id: string; patient_id: string; phone: string; status: 'queued' }[] = []
  let offset = 0

  try {
    // Loop pages until a short page signals the end.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let query = admin
        .from('patients')
        .select('id, phone')
        .is('deleted_at', null)
        .eq('marketing_opted_out', false)

      query = applyAudienceFilter(query, audienceFilter)

      const { data: page, error: pageErr } = await query
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (pageErr) throw new Error(pageErr.message)
      if (!page || page.length === 0) break

      for (const p of page as { id: string; phone: string | null }[]) {
        if (!p.phone || !formatNigerianPhone(p.phone)) continue // skip unreachable rows
        recipients.push({
          broadcast_id: broadcastId,
          patient_id: p.id,
          phone: p.phone, // stored raw; the drain re-formats at send time
          status: 'queued',
        })
      }

      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  } catch (err: any) {
    // Enqueue failed — leave the broadcast as a draft (not 'sending') so nothing
    // is half-sent, and surface the reason (e.g. an unsupported filter key).
    return { ok: false, error: err?.message ?? 'Failed to build the audience.', broadcastId }
  }

  if (recipients.length === 0) {
    return {
      ok: false,
      error: 'No reachable patients matched the audience filter — nothing was queued.',
      broadcastId,
    }
  }

  // Insert recipient rows in chunks.
  for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
    const chunk = recipients.slice(i, i + INSERT_CHUNK)
    const { error: insErr } = await admin.from('broadcast_recipients').insert(chunk)
    if (insErr) {
      // Partial enqueue: roll the draft back and clear what we inserted, so the
      // campaign can be retried cleanly rather than sending to a partial list.
      await admin.from('broadcast_recipients').delete().eq('broadcast_id', broadcastId)
      return { ok: false, error: `Failed to queue recipients: ${insErr.message}`, broadcastId }
    }
  }

  // 4. Flip to 'sending' and record the total.
  const totalCount = recipients.length
  const { error: sendErr } = await admin
    .from('broadcasts')
    .update({ status: 'sending', total_count: totalCount })
    .eq('id', broadcastId)
  if (sendErr) return { ok: false, error: sendErr.message, broadcastId }

  // 5. Kick the drain once. Fire-and-forget with keepalive — the drain runs one
  //    batch then self-chains the rest, so we must NOT await the whole chain
  //    (that would nest every batch into this request and time out). Mirrors the
  //    drain's own triggerNext(): a short grace sleep lets the request flush
  //    before this function unwinds.
  const origin = await resolveOrigin()
  const drainUrl = `${origin}/api/broadcasts/drain?broadcast_id=${encodeURIComponent(broadcastId)}`
  void fetch(drainUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET!}` },
    keepalive: true,
  }).catch((e) => console.error('broadcast drain kick failed:', e))
  await new Promise((r) => setTimeout(r, 500))

  return { ok: true, broadcastId, totalCount }
}
