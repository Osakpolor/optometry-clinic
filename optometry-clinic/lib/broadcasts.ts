// lib/broadcasts.ts
// WhatsApp Broadcast (marketing campaign) sender.
//
// Mirrors the approved-template send in lib/whatsapp.ts
// (sendAppointmentReminderTemplate) but builds a richer template:
//   image header  +  ordered body params  +  optional dynamic URL button.
//
// Two things this adds over the existing senders, both needed by broadcasts:
//   1. It returns Meta's message id so broadcast_recipients.wa_message_id can be
//      matched by the delivery-status webhook (Phase 3).
//   2. It classifies Meta error 131049 (per-user marketing cap) as 'capped',
//      NOT 'failed' — that drop is expected for marketing templates and must not
//      look like an error (same hazard documented in sendVisitThankYou).

import { getSettings, isAllowedRecipient, type AppSettings } from '@/lib/settings'
import { formatNigerianPhone, logWhatsAppMessage } from '@/lib/whatsapp'

// Same Graph API target, credentials and headers as lib/whatsapp.ts.
// TODO(multi-tenant): read WA creds from the clinics row instead of env.
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!
const API_URL = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`

// Meta's per-user marketing cap. A Marketing-category template can be silently
// dropped for a given recipient; Meta returns this error code. Treat as expected.
const MARKETING_CAP_ERROR = 131049

export type BroadcastSendInput = {
  templateName: string
  language: string
  headerImageUrl: string | null
  bodyParams: string[] // ordered {{1}}, {{2}}, … values
  buttonUrl: string | null // dynamic URL-button suffix, if the template has one
  title: string // used only for the Conversations log line
}

export type BroadcastSendResult =
  | { status: 'sent'; waMessageId: string | null; error?: undefined }
  | { status: 'skipped'; error: string; waMessageId?: undefined }
  | { status: 'capped'; error: string; waMessageId?: undefined }
  | { status: 'failed'; error: string; waMessageId?: undefined }

/**
 * Send one broadcast template to one recipient.
 *
 * Pass a pre-fetched `settings` when sending in a loop (the drain endpoint does)
 * so we don't hit the DB once per recipient. The messaging-control gate is
 * identical to sendAppointmentReminderTemplate(): broadcasts are marketing, so
 * they MUST honour the global pause and the test-mode allowlist.
 */
export async function sendBroadcastTemplate(
  phone: string,
  input: BroadcastSendInput,
  settings?: AppSettings,
): Promise<BroadcastSendResult> {
  const to = formatNigerianPhone(phone)
  if (!to) {
    return { status: 'failed', error: `Unrecognised phone format: ${phone}` }
  }

  const s = settings ?? (await getSettings())
  if (!s.automated_sends_enabled) {
    return { status: 'skipped', error: 'Automated sends are disabled' }
  }
  if (!isAllowedRecipient(phone, s)) {
    return { status: 'skipped', error: 'Recipient not in test allowlist (test mode on)' }
  }

  // Build components in Meta's required order. Each is included only when the
  // campaign actually has that part, so the same function serves templates with
  // or without an image header / body vars / button.
  const components: any[] = []
  if (input.headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [{ type: 'image', image: { link: input.headerImageUrl } }],
    })
  }
  if (input.bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: input.bodyParams.map((t) => ({ type: 'text', text: t })),
    })
  }
  if (input.buttonUrl) {
    // Dynamic URL button: Meta appends this text to the template's base URL.
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: input.buttonUrl }],
    })
  }

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.language },
      components,
    },
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json()

    if (!response.ok || data.error) {
      const code = data?.error?.code
      const message = data?.error?.message ?? 'WhatsApp API error'
      if (code === MARKETING_CAP_ERROR) {
        // Not a failure — the recipient hit the per-user marketing cap.
        return { status: 'capped', error: message }
      }
      console.error('sendBroadcastTemplate error:', data.error ?? data)
      return { status: 'failed', error: message }
    }

    const waMessageId: string | null = data?.messages?.[0]?.id ?? null

    // Log into whatsapp_conversations so the broadcast shows in the staff
    // Conversations viewer. We can't perfectly reproduce the rendered template
    // (its text lives in Meta), so we log a readable summary of what was sent.
    const logLine =
      `[Broadcast: ${input.title}] ` +
      (input.bodyParams.length ? input.bodyParams.join(' · ') : '(no body params)') +
      (input.headerImageUrl ? ' [image]' : '') +
      (input.buttonUrl ? ` [link: ${input.buttonUrl}]` : '')
    await logWhatsAppMessage(phone, 'system', logLine)

    return { status: 'sent', waMessageId }
  } catch (err: any) {
    console.error('sendBroadcastTemplate network error:', err)
    return { status: 'failed', error: err?.message ?? 'Network error' }
  }
}
