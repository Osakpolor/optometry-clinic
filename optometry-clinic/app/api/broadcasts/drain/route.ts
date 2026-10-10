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
// Idempotency / no double-send: the chain is linear — an invocation moves all of
// its batch OUT of 'queued' (to sent/failed/capped/skipped) BEFORE triggering its
// single successor, so the successor's "status = queued" query can never re-pick
// a row this invocation already handled. (Do NOT run two drains for the same
// broadcast concurrently — e.g. a manual trigger during an active chain — as that
// reintroduces a select/update race. v1 never does this.)
//
// Serverless caveat: the self-trigger is fire-and-forget with keepalive. This is
// reliable in practice but not bulletproof on Hobby. The brief's documented
// hardening (Vercel Pro per-minute cron, or Supabase pg_cron) is the long-term
// fix; v1 stays self-chaining for zero extra cost.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSettings } from '@/lib/settings'
import { sendBroadcastTemplate, type BroadcastSendInput } from '@/lib/broadcasts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Hobby ceiling; the batch loop below stays under it.

const BATCH_SIZE = 40
const DELAY_MS = 150 // gentle pacing between sends, to protect the number's quality rating
const TIME_BUDGET_MS = 45_000 // drain many batches per invocation, then hand off once

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

  // 1. Choose the broadcast: the requested one, else the oldest still 'sending'.
  let broadcast: any = null
  {
    let q = admin.from('broadcasts').select('*').eq('status', 'sending')
    if (broadcastIdParam) q = q.eq('id', broadcastIdParam)
    else q = q.order('created_at', { ascending: true }).limit(1)
    const { data } = await q.maybeSingle()
    broadcast = data
  }

  if (!broadcast) {
    return NextResponse.json({ done: true, message: 'No broadcast in sending state.' })
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
