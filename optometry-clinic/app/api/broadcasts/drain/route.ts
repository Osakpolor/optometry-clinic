// app/api/broadcasts/drain/route.ts
//
// Self-chaining broadcast sender. Vercel Hobby allows only one cron/day (already
// used by the appointment-reminders cron), so we cannot schedule a frequent cron
// to drain the queue. Instead, each invocation drains as many batches as fit in a
// ~45s time budget (under maxDuration 60) and, if recipients remain, triggers ONE
// successor to continue. Looping per invocation means a full blast needs only a
// handful of self-triggers, not dozens — far fewer fragile fire-and-forget hops
// (an earlier one-batch-per-invocation version stalled after ~4 hops on Hobby).
// A stuck 'sending' broadcast can also be resumed manually: GET this endpoint
// with the bearer (optionally ?broadcast_id=), e.g. via the admin page's Resume.
//
// Auth: Authorization: Bearer ${CRON_SECRET} — same as the reminders cron.
// Access: service-role admin client (no user session; must bypass RLS).
//
// No double-send under concurrency: each broadcast carries a drain LEASE
// (broadcasts.drain_locked_until). An invocation must atomically acquire the
// lease before processing; any other invocation — a self-triggered successor OR
// a repeated "Resume" click landing during an active drain — finds a live lease
// and bails. So two invocations can never select the same 'queued' rows and send
// twice. Within the single holder, each batch leaves 'queued' before the next
// select, so no row is re-picked either.
//
// Recovery: the lease EXCEEDS maxDuration, so a live invocation never loses it
// mid-run; a DEAD invocation's lease simply expires, after which Resume (or the
// next trigger) continues the still-'queued' rows. Rows are never parked in an
// intermediate 'sending' state, so none can get stuck per-row.
//
// Residual at-least-once edge (not the bug reported): if an invocation sends to
// ONE recipient and dies before marking that row, the row stays 'queued' and is
// re-sent later — a single-row duplicate inherent to at-least-once delivery
// without a provider dedup key. Vastly rarer than the concurrency race, and not
// what repeated-Resume triggered.
//
// Serverless caveat: the self-trigger is still fire-and-forget with keepalive —
// now far less exposed (a handful of hops, and Resume safely re-kicks). The
// brief's Vercel Pro cron / Supabase pg_cron remains the long-term hardening.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSettings } from '@/lib/settings'
import { sendBroadcastTemplate, type BroadcastSendInput } from '@/lib/broadcasts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Hobby ceiling; the batch loop below stays under it.

const BATCH_SIZE = 40
const DELAY_MS = 150 // gentle pacing between sends, to protect the number's quality rating
const TIME_BUDGET_MS = 45_000 // drain many batches per invocation, then hand off once
const LOCK_LEASE_MS = 90_000 // drain lock lease; MUST exceed maxDuration so a live
// invocation never loses its lock mid-run, yet a dead one's lock expires and frees.

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Derive a safe first name from a patient's full_name for the {{first_name}}
// token. Meta rejects an empty {{1}}, so fall back to a neutral greeting. Strip
// newlines/tabs and collapse whitespace — WhatsApp template body params reject
// them (same hazard as formatPrescriptions in lib/whatsapp.ts).
function firstNameFrom(fullName: string | null | undefined): string {
  const cleaned = (fullName ?? '').replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const first = cleaned.split(' ')[0] ?? ''
  return first || 'there'
}

// Replace supported personalisation tokens in each body param with THIS
// recipient's values. Currently only {{first_name}}; add future tokens here.
function resolvePersonalisedParams(rawParams: string[], firstName: string): string[] {
  return rawParams.map((p) => p.replace(/\{\{first_name\}\}/g, firstName))
}

// Fire-and-forget trigger for the next batch. We do NOT await the child's work —
// awaiting would nest the whole chain into one long-lived request and time out.
function triggerNext(origin: string, broadcastId: string) {
  const next = `${origin}/api/broadcasts/drain?broadcast_id=${encodeURIComponent(broadcastId)}`
  void fetch(next, {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET!}` },
    keepalive: true, // let the request complete even as this function unwinds
  }).catch((err) => console.error('drain self-trigger failed:', err))
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const url = new URL(req.url)
  const broadcastIdParam = url.searchParams.get('broadcast_id')

  // 1. Pick the target broadcast: the requested one, else the oldest 'sending'.
  let targetId = broadcastIdParam
  if (!targetId) {
    const { data: candidate } = await admin
      .from('broadcasts')
      .select('id')
      .eq('status', 'sending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    targetId = candidate?.id ?? null
  }
  if (!targetId) {
    return NextResponse.json({ done: true, message: 'No broadcast in sending state.' })
  }

  // 2. Acquire the per-broadcast drain lock ATOMICALLY, so only one invocation
  //    ever processes a broadcast at a time — concurrent invocations (e.g.
  //    repeated "Resume" clicks) can never select the same 'queued' rows and
  //    double-send. The lock is a lease: we claim it only if it is unset OR
  //    already expired, as a conditional UPDATE that just one concurrent writer
  //    can win (Postgres re-evaluates the WHERE against the winner's committed
  //    row under READ COMMITTED). Two tries cover "unset" then "expired".
  const nowIso = new Date().toISOString()
  const leaseIso = new Date(Date.now() + LOCK_LEASE_MS).toISOString()

  const acquire = async () => {
    const free = await admin
      .from('broadcasts')
      .update({ drain_locked_until: leaseIso })
      .eq('id', targetId!)
      .eq('status', 'sending')
      .is('drain_locked_until', null)
      .select('*')
      .maybeSingle()
    if (free.data) return free.data
    const expired = await admin
      .from('broadcasts')
      .update({ drain_locked_until: leaseIso })
      .eq('id', targetId!)
      .eq('status', 'sending')
      .lt('drain_locked_until', nowIso)
      .select('*')
      .maybeSingle()
    return expired.data ?? null
  }

  const broadcast: any = await acquire()
  if (!broadcast) {
    // Not 'sending', or another live invocation holds the lock — bail quietly so
    // repeated Resume clicks are harmless no-ops rather than duplicate senders.
    return NextResponse.json({
      skipped: true,
      message: 'Broadcast not in sending state, or a drain is already running for it.',
    })
  }

  // Release the lock (best-effort) on any exit path below.
  const releaseLock = async () => {
    await admin.from('broadcasts').update({ drain_locked_until: null }).eq('id', broadcast.id)
  }

  const settings = await getSettings()

  // Raw, UNresolved params as stored on the broadcast — may contain tokens like
  // "{{first_name}}". These are personalised per recipient inside the loop.
  const rawParams: string[] = Array.isArray(broadcast.body_params)
    ? broadcast.body_params.map((v: any) => String(v))
    : []

  // Constant parts of the send; bodyParams are resolved PER recipient below.
  const baseInput: Omit<BroadcastSendInput, 'bodyParams'> = {
    templateName: broadcast.template_name,
    language: broadcast.language ?? 'en',
    headerImageUrl: broadcast.header_image_url ?? null,
    buttonUrl: broadcast.button_url ?? null,
    title: broadcast.title,
  }

  // 2. Drain batches in a loop until the queue empties OR the time budget is hit.
  //    Each batch moves its rows OUT of 'queued' before the next select, so the
  //    re-query never re-picks a handled row (same linear invariant as before —
  //    still do NOT run two drains for one broadcast concurrently).
  const startedAt = Date.now()
  let processed = 0
  let outOfTime = false

  while (!outOfTime) {
    if (Date.now() - startedAt >= TIME_BUDGET_MS) {
      outOfTime = true
      break
    }

    const { data: batch, error: batchErr } = await admin
      .from('broadcast_recipients')
      .select('id, phone, patient_id, patients(marketing_opted_out, full_name)')
      .eq('broadcast_id', broadcast.id)
      .eq('status', 'queued')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE)

    if (batchErr) {
      await releaseLock() // don't hold the lease on an error exit
      return NextResponse.json({ error: batchErr.message }, { status: 500 })
    }
    if (!batch || batch.length === 0) break // queue drained

    for (const r of batch as any[]) {
      // Stop mid-batch if we run out of budget; the rest stays 'queued' for the
      // successor. Checked first so a skip-only batch can't blow past the budget.
      if (Date.now() - startedAt >= TIME_BUDGET_MS) {
        outOfTime = true
        break
      }

      const patient = Array.isArray(r.patients) ? r.patients[0] : r.patients
      if (patient?.marketing_opted_out === true) {
        await admin
          .from('broadcast_recipients')
          .update({
            status: 'skipped',
            error: 'Patient opted out of marketing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id)
        processed++
        continue
      }

      // Personalise {{first_name}} (and any future tokens) for THIS recipient.
      const firstName = firstNameFrom(patient?.full_name)
      const input: BroadcastSendInput = {
        ...baseInput,
        bodyParams: resolvePersonalisedParams(rawParams, firstName),
      }

      const result = await sendBroadcastTemplate(r.phone, input, settings)

      const update: Record<string, any> = {
        status: result.status,
        updated_at: new Date().toISOString(),
      }
      if (result.status === 'sent') {
        update.wa_message_id = result.waMessageId
        update.sent_at = new Date().toISOString()
        update.error = null
      } else {
        update.error = result.error ?? null
      }

      await admin.from('broadcast_recipients').update(update).eq('id', r.id)
      processed++

      if (DELAY_MS > 0) await sleep(DELAY_MS)
    }
  }

  // 3. Roll up counts from the recipient rows. Head-count queries return only a
  //    number, so they stay under the PostgREST 1000-row read cap.
  const countStatus = async (status: string) => {
    const { count } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcast.id)
      .eq('status', status)
    return count ?? 0
  }
  const countTotal = async () => {
    const { count } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcast.id)
    return count ?? 0
  }

  const [sent, delivered, read, failed, capped, queuedLeft, total] = await Promise.all([
    countStatus('sent'),
    countStatus('delivered'),
    countStatus('read'),
    countStatus('failed'),
    countStatus('capped'),
    countStatus('queued'),
    countTotal(),
  ])

  const allDone = queuedLeft === 0

  // Write counts/status AND release the lock in one update. Releasing before we
  // trigger the successor lets it (or a Resume) acquire the now-free lock; the
  // atomic acquire guarantees only one of them proceeds.
  await admin
    .from('broadcasts')
    .update({
      sent_count: sent,
      delivered_count: delivered,
      read_count: read,
      failed_count: failed,
      capped_count: capped,
      total_count: total,
      status: allDone ? 'sent' : 'sending',
      drain_locked_until: null,
    })
    .eq('id', broadcast.id)

  // 4. More to send? Trigger the next invocation and let it flush before we end.
  if (!allDone) {
    triggerNext(url.origin, broadcast.id)
    await sleep(500)
  }

  return NextResponse.json({
    done: allDone,
    broadcast_id: broadcast.id,
    processed,
    counts: { sent, delivered, read, failed, capped, queued: queuedLeft, total },
  })
}
