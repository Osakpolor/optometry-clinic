// app/api/broadcasts/drain/route.ts
//
// Self-chaining broadcast sender. Vercel Hobby allows only one cron/day (already
// used by the appointment-reminders cron), so we cannot schedule a frequent cron
// to drain the queue. Instead, each call sends ONE small batch and, if recipients
// remain, triggers the next call itself. Each invocation is short, so no single
// request risks the serverless timeout.
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
export const maxDuration = 60 // Hobby ceiling; one batch finishes well inside it.

const BATCH_SIZE = 40
const DELAY_MS = 150 // gentle pacing between sends, to protect the number's quality rating

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  // 2. Next batch of queued recipients for this broadcast, each with the
  //    patient's current opt-out flag. Defence-in-depth: enqueue already excludes
  //    opted-out patients, but one may have sent STOP since being enqueued.
  const { data: batch, error: batchErr } = await admin
    .from('broadcast_recipients')
    .select('id, phone, patient_id, patients(marketing_opted_out)')
    .eq('broadcast_id', broadcast.id)
    .eq('status', 'queued')
    .order('id', { ascending: true })
    .limit(BATCH_SIZE)

  if (batchErr) {
    return NextResponse.json({ error: batchErr.message }, { status: 500 })
  }

  const settings = await getSettings()

  const bodyParams: string[] = Array.isArray(broadcast.body_params)
    ? broadcast.body_params.map((v: any) => String(v))
    : []

  const input: BroadcastSendInput = {
    templateName: broadcast.template_name,
    language: broadcast.language ?? 'en',
    headerImageUrl: broadcast.header_image_url ?? null,
    bodyParams,
    buttonUrl: broadcast.button_url ?? null,
    title: broadcast.title,
  }

  let processed = 0
  for (const r of (batch ?? []) as any[]) {
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
