// lib/whatsapp.ts
// WhatsApp Cloud API utility functions.
// All sending goes through the clinic's registered number.
//
// MESSAGE TRACKING (feature/message-health, Phase A):
//   Every function here that actually calls the Graph API records the send in
//   message_log via logMessageSend() — 'accepted' + Meta's message id on
//   success, 'failed' + Meta's error on an API error. The webhook later
//   upgrades that row from delivery receipts (sent/delivered/read/failed).
//   Logging is fire-and-forget and can never block or break a send.
//   A send SKIPPED by a messaging-control gate (automated-sends-off /
//   test-mode) makes no API call, so it is deliberately NOT logged.
//   Broadcasts are tracked separately (broadcast_recipients), not here.

import { humanizePrescriptionList } from '@/lib/humanizePrescription'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { getSettings, isAllowedRecipient } from '@/lib/settings'
import { firstName, greetingName } from '@/lib/names'
import { logMessageSend, type MessageKind } from '@/lib/message-log'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!
const API_URL = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatNigerianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length >= 13) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return null
}

// Pull Meta's error fields out of a Graph API error response, in the shape
// message_log stores. error_data.details is Meta's most specific line.
function metaErrorFields(data: any): {
  errorCode: number | null
  errorTitle: string | null
  errorDetails: string | null
} {
  const e = data?.error
  return {
    errorCode: e?.code ?? null,
    errorTitle: e?.title ?? e?.message ?? null,
    errorDetails: e?.error_data?.details ?? null,
  }
}

export function formatPrescriptions(medications: any[]): string {
  if (!medications || medications.length === 0) return 'None prescribed at this visit.'
  const lines = medications
    .filter(m => m.name || m.type)
    .map(m => {
      const parts: string[] = []
      if (m.type) parts.push(m.type)
      if (m.name) parts.push(m.name)
      if (m.freq) parts.push(m.freq)
      if (m.qty) parts.push(`x ${m.qty}`)
      if (m.duration) parts.push(`x ${m.duration}`)
      return parts.join(' ')
    })
    .filter(Boolean)
  const joined = lines.length > 0 ? lines.join('; ') : 'None prescribed at this visit.'
  // WhatsApp template params reject newlines, tabs, and runs of 4+ spaces
  return joined.replace(/[\n\t]+/g, ' ').replace(/\s{4,}/g, ' ').trim()
}

// ── Log a message into whatsapp_conversations so it shows in the staff
// Conversations viewer. We log the FULL human-readable text — exactly what
// the patient receives on WhatsApp (line breaks included; the viewer renders
// them with whitespace-pre-wrap). Own service-role client so it works in
// server actions AND the cron. Fire-and-forget: never blocks a real send.
//
// waMessageId (optional) ties this thread line to its delivery receipt in
// message_log, so the inbox can show Sent / Delivered / Read / Failed under it.
export async function logWhatsAppMessage(
  phone: string,
  role: 'user' | 'assistant' | 'system',
  message: string,
  waMessageId?: string | null
): Promise<void> {
  try {
    const to = formatNigerianPhone(phone) ?? phone.replace(/\D/g, '')
    const sb = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await sb.from('whatsapp_conversations').insert({
      phone_number: to,
      role,
      message,
      wa_message_id: waMessageId ?? null,
    })
  } catch (err) {
    console.error('logWhatsAppMessage failed (non-blocking):', err)
  }
}

// ── Core send function ────────────────────────────────────────────────────────
//
// logCtx controls message_log recording:
//   • omit it  → the send is logged with kind 'other' (plain free-form text);
//   • pass kind/patientId → logged with that classification;
//   • pass skipLog:true → the caller will log the send itself with a more
//     specific kind (e.g. a template wrapper), so the core skips it to avoid
//     a duplicate row.
// Returns Meta's wa_message_id so callers can tie the send to its receipts.
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  logCtx?: {
    kind?: MessageKind
    templateName?: string | null
    patientId?: string | null
    skipLog?: boolean
  }
): Promise<{ success: boolean; error?: string; waMessageId?: string | null }> {
  const shouldLog = !logCtx?.skipLog
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    })
    const data = await response.json()
    if (!response.ok || data.error) {
      console.error('WhatsApp sendWhatsAppMessage error:', data.error ?? data)
      if (shouldLog) {
        await logMessageSend({
          phone: to,
          kind: logCtx?.kind ?? 'other',
          templateName: logCtx?.templateName ?? null,
          patientId: logCtx?.patientId ?? null,
          outcome: { ok: false, ...metaErrorFields(data) },
        })
      }
      return { success: false, error: data.error?.message ?? 'API error' }
    }
    const waMessageId: string | null = data?.messages?.[0]?.id ?? null
    if (shouldLog) {
      await logMessageSend({
        phone: to,
        kind: logCtx?.kind ?? 'other',
        templateName: logCtx?.templateName ?? null,
        patientId: logCtx?.patientId ?? null,
        outcome: { ok: true, waMessageId },
      })
    }
    return { success: true, waMessageId }
  } catch (err: any) {
    console.error('sendWhatsAppMessage network error:', err)
    // A network error has no Meta response/code — record it as failed so a
    // total outage is still visible in message_log rather than vanishing.
    if (shouldLog) {
      await logMessageSend({
        phone: to,
        kind: logCtx?.kind ?? 'other',
        templateName: logCtx?.templateName ?? null,
        patientId: logCtx?.patientId ?? null,
        outcome: { ok: false, errorCode: null, errorTitle: 'Network error', errorDetails: err?.message ?? null },
      })
    }
    return { success: false, error: err.message }
  }
}

// ── Booking confirmation ──────────────────────────────────────────────────────

export async function sendBookingConfirmation({
  to,
  fullName,
  service,
  date,
  time,
}: {
  to: string
  fullName: string
  service?: string
  date?: string
  time?: string
}): Promise<{ success: boolean; error?: string }> {
  // Test-mode guard: during a test window, only allowlisted numbers get anything.
  const settings = await getSettings()
  if (!isAllowedRecipient(to, settings)) {
    console.log(`🔇 sendBookingConfirmation skipped for ${to} (test mode)`)
    return { success: false, error: 'Recipient not in test allowlist (test mode on)' }
  }

  const details = [service, date, time].filter(Boolean).join(', ')
  // Greet by first name only ("Hello Peace", not "Hello Chief Agu Jones").
  const greetName = firstName(fullName) || fullName
  const message =
    `Hello ${greetName}, thank you for booking with Olu Eye Clinic! ` +
    (details ? `Your appointment details: ${details}. ` : '') +
    `A member of our team will contact you shortly to confirm. ` +
    `For enquiries call 09166015438. - OluEyeClnc`

  // Let the core send record message_log with kind 'booking'.
  const result = await sendWhatsAppMessage(to, message, { kind: 'booking' })
  if (result.success) {
    // Log exactly what the patient received, tagged with the message id.
    await logWhatsAppMessage(to, 'system', message, result.waMessageId ?? null)
  }
  return result
}

// ── Appointment reminder (free-form, legacy — kept for compatibility) ─────────
// NOTE: currently unused and slated for removal in a separate deletion PR, so
// it is left uninstrumented. It still routes through sendWhatsAppMessage, which
// would log any call it does make as kind 'other' — nothing escapes tracking.

export async function sendAppointmentReminder({
  to,
  fullName,
  date,
  time,
  isToday,
}: {
  to: string
  fullName: string
  date: string
  time?: string
  isToday?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const when = time ? `${date} at ${time}` : date
  const urgency = isToday ? 'TODAY ' : ''
  const greetName = firstName(fullName) || fullName
  const message =
    `Dear ${greetName}, this is a ${urgency}reminder that your eye check-up at ` +
    `Olu Eye Clinic is scheduled for ${when}. ` +
    `Please arrive 10 minutes early. To reschedule call 09166015438. - OluEyeClnc`
  return sendWhatsAppMessage(to, message)
}

// ── Appointment reminder TEMPLATE — Iris-branded (olu_reminder_iris) ──────────
// Delivers reliably outside the 24h window. Two body params:
//   {{1}} = patient name
//   {{2}} = appointment date (formatted)

export async function sendAppointmentReminderTemplate({
  patientPhone,
  patientName,
  patientFirstName = null,
  appointmentDate,
}: {
  patientPhone: string
  patientName: string
  patientFirstName?: string | null
  appointmentDate: string
}): Promise<{ success: boolean; error?: string }> {
  const to = formatNigerianPhone(patientPhone)
  if (!to) {
    return { success: false, error: `Unrecognised phone format: ${patientPhone}` }
  }

  // Messaging controls: automated sends can be paused globally, and in test
  // mode only allowlisted numbers receive anything.
  const settings = await getSettings()
  if (!settings.automated_sends_enabled) {
    console.log(`🔇 Reminder skipped for ${patientPhone} (automated sends disabled)`)
    return { success: false, error: 'Automated sends are disabled' }
  }
  if (!isAllowedRecipient(patientPhone, settings)) {
    console.log(`🔇 Reminder skipped for ${patientPhone} (test mode)`)
    return { success: false, error: 'Recipient not in test allowlist (test mode on)' }
  }

  // Greet by the stored first name when we have one; otherwise fall back to the
  // FULL name (never a guessed token — a legacy surname-first blob would greet
  // by the surname). Final `|| patientName` guards against an empty {{1}}, which
  // Meta rejects.
  const greetName = greetingName({ firstName: patientFirstName, fullName: patientName }) || patientName

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'olu_reminder_iris',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: greetName },
            { type: 'text', text: appointmentDate },
          ],
        },
      ],
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
      console.error('sendAppointmentReminderTemplate error:', data.error ?? data)
      await logMessageSend({
        phone: patientPhone,
        kind: 'reminder',
        templateName: 'olu_reminder_iris',
        outcome: { ok: false, ...metaErrorFields(data) },
      })
      return { success: false, error: data.error?.message ?? 'WhatsApp API error' }
    }
    const waMessageId: string | null = data?.messages?.[0]?.id ?? null
    await logMessageSend({
      phone: patientPhone,
      kind: 'reminder',
      templateName: 'olu_reminder_iris',
      outcome: { ok: true, waMessageId },
    })
    // Log the full human-readable message exactly as the olu_reminder_iris
    // template renders it on the patient's phone.
    await logWhatsAppMessage(
      patientPhone,
      'system',
      `Hello ${greetName}, I'm Iris, Olu Eye Clinic's AI assistant. ` +
      `Thank you for trusting us with your eye health. ` +
      `This is a friendly reminder of your next appointment on ${appointmentDate}. ` +
      `We look forward to seeing you. Enjoy the rest of your day!`,
      waMessageId
    )
    return { success: true }
  } catch (err: any) {
    console.error('sendAppointmentReminderTemplate network error:', err)
    await logMessageSend({
      phone: patientPhone,
      kind: 'reminder',
      templateName: 'olu_reminder_iris',
      outcome: { ok: false, errorCode: null, errorTitle: 'Network error', errorDetails: err?.message ?? null },
    })
    return { success: false, error: err.message ?? 'Network error' }
  }
}

// ── Post-visit thank-you TEMPLATES (v5 with review link / v4 without) ──────────
// Two approved templates, same "thank you + next appointment" shape:
//   • olu_visit_thankyou_v4  UTILITY   — no review link. Delivers reliably and
//     isn't subject to the marketing cap.
//   • olu_visit_thankyou_v5  MARKETING — adds the Google review link as {{3}}.
//     Being Marketing, it CAN be silently dropped by the per-user marketing cap
//     (error 131049), either returned at the API call or later via a webhook
//     delivery receipt.
//
// The caller passes `withReviewLink` (decided from the admin "Review link in
// thank-you" setting). When true we try v5; if v5 fails at the API FOR ANY
// REASON (incl. 131049), we immediately fall back to v4 IN THE SAME CALL so the
// patient still gets their next-appointment message. The return says which
// template actually went out and whether the review link was sent, so the
// caller only stamps "last asked" when the link truly went (reviewLinkSent).
//
// A 131049 that arrives LATER as a webhook receipt (Meta accepted, then capped)
// is handled in the webhook, which rebuilds a v4 thank-you from the visit.
//
// Body params:  v4 → {{1}} name, {{2}} appointment
//               v5 → {{1}} name, {{2}} appointment, {{3}} review link

const REVIEW_LINK = () =>
  process.env.GOOGLE_REVIEW_LINK ?? 'https://olueyeclinic.com/review'

export type ThankYouTemplate = 'olu_visit_thankyou_v5' | 'olu_visit_thankyou_v4'

export type SendThankYouResult = {
  success: boolean
  error?: string
  templateUsed: ThankYouTemplate | null // what actually went out (null if nothing did)
  reviewLinkSent: boolean                // true only when v5 was accepted
}

// Format as "July 28th, 2026" (month name, ordinal day, year)
function thankYouLongDate(dateStr: string): string {
  function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
  }
  const d = new Date(dateStr + 'T12:00:00')
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  return `${month} ${ordinal(d.getDate())}, ${d.getFullYear()}`
}

// Send ONE thank-you template and record it (message_log + the inbox thread
// line). Returns ok/err only; the orchestration (v5→v4 fallback) lives in
// sendVisitThankYou. `conversationText` is what we store as the sent bubble,
// matching exactly how the chosen template renders on the patient's phone.
async function postThankYouTemplate(opts: {
  to: string
  patientPhone: string
  templateName: ThankYouTemplate
  parameters: { type: 'text'; text: string }[]
  conversationText: string
  patientId: string | null
  visitId: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const body = {
    messaging_product: 'whatsapp',
    to: opts.to,
    type: 'template',
    template: {
      name: opts.templateName,
      language: { code: 'en' },
      components: [{ type: 'body', parameters: opts.parameters }],
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
      console.error(`${opts.templateName} error:`, data.error ?? data)
      await logMessageSend({
        phone: opts.patientPhone,
        kind: 'thankyou',
        templateName: opts.templateName,
        patientId: opts.patientId,
        visitId: opts.visitId,
        outcome: { ok: false, ...metaErrorFields(data) },
      })
      return { ok: false, error: data.error?.message ?? 'WhatsApp API error' }
    }
    const waMessageId: string | null = data?.messages?.[0]?.id ?? null
    await logMessageSend({
      phone: opts.patientPhone,
      kind: 'thankyou',
      templateName: opts.templateName,
      patientId: opts.patientId,
      visitId: opts.visitId,
      outcome: { ok: true, waMessageId },
    })
    await logWhatsAppMessage(opts.patientPhone, 'system', opts.conversationText, waMessageId)
    return { ok: true }
  } catch (err: any) {
    console.error(`${opts.templateName} network error:`, err)
    await logMessageSend({
      phone: opts.patientPhone,
      kind: 'thankyou',
      templateName: opts.templateName,
      patientId: opts.patientId,
      visitId: opts.visitId,
      outcome: { ok: false, errorCode: null, errorTitle: 'Network error', errorDetails: err?.message ?? null },
    })
    return { ok: false, error: err?.message ?? 'Network error' }
  }
}

export async function sendVisitThankYou({
  patientName,
  patientFirstName = null,
  patientPhone,
  followUpDate,
  withReviewLink = false,
  patientId = null,
  visitId = null,
}: {
  patientName: string
  patientFirstName?: string | null
  patientPhone: string
  followUpDate: string | null
  withReviewLink?: boolean
  patientId?: string | null
  visitId?: string | null
}): Promise<SendThankYouResult> {
  const to = formatNigerianPhone(patientPhone)
  if (!to) {
    return { success: false, error: `Unrecognised phone format: ${patientPhone}`, templateUsed: null, reviewLinkSent: false }
  }

  // Messaging controls: automated sends can be paused globally, and in test
  // mode only allowlisted numbers receive anything. (The webhook 131049
  // fallback calls this too, so it respects these controls exactly like a
  // normal send.)
  const settings = await getSettings()
  if (!settings.automated_sends_enabled) {
    console.log(`🔇 Thank-you skipped for ${patientPhone} (automated sends disabled)`)
    return { success: false, error: 'Automated sends are disabled', templateUsed: null, reviewLinkSent: false }
  }
  if (!isAllowedRecipient(patientPhone, settings)) {
    console.log(`🔇 Thank-you skipped for ${patientPhone} (test mode)`)
    return { success: false, error: 'Recipient not in test allowlist (test mode on)', templateUsed: null, reviewLinkSent: false }
  }

  const appointmentText = followUpDate
    ? thankYouLongDate(followUpDate)
    : 'to be scheduled — please contact the clinic'

  // Stored first name when present; otherwise the full name (not a token).
  const greetName = greetingName({ firstName: patientFirstName, fullName: patientName }) || patientName

  const v4Text =
    `Dear ${greetName}, thank you for choosing Olu Eye Clinic for your eye care.\n\n` +
    `*Your next appointment is ${appointmentText}*\n\n` +
    `We look forward to seeing you. God bless you. - Olu Eye Clinic Team`

  // --- Review link requested: try v5 first ----------------------------------
  if (withReviewLink) {
    const reviewLink = REVIEW_LINK()
    const v5Text =
      `Dear ${greetName},\n\n` +
      `Thank you for trusting us with your eye health.\n\n` +
      `*Your next appointment is on ${appointmentText}.*\n\n` +
      `We'd love to hear about your experience at the clinic! Please leave us a review: ${reviewLink}\n\n` +
      `Enjoy the rest of your day!\n\n` +
      `Olu Eye Clinic.`

    const v5 = await postThankYouTemplate({
      to, patientPhone,
      templateName: 'olu_visit_thankyou_v5',
      parameters: [
        { type: 'text', text: greetName },
        { type: 'text', text: appointmentText },
        { type: 'text', text: reviewLink },
      ],
      conversationText: v5Text,
      patientId, visitId,
    })
    if (v5.ok) {
      return { success: true, templateUsed: 'olu_visit_thankyou_v5', reviewLinkSent: true }
    }

    // v5 failed at the API (incl. 131049 marketing cap). Fall back to utility v4
    // so the patient still gets their next-appointment message. Do NOT report
    // reviewLinkSent — the caller must not stamp "last asked", so the patient is
    // asked again next time.
    console.warn(`v5 thank-you failed for ${patientPhone} (${v5.error}); falling back to v4`)
    const v4 = await postThankYouTemplate({
      to, patientPhone,
      templateName: 'olu_visit_thankyou_v4',
      parameters: [
        { type: 'text', text: greetName },
        { type: 'text', text: appointmentText },
      ],
      conversationText: v4Text,
      patientId, visitId,
    })
    return v4.ok
      ? { success: true, templateUsed: 'olu_visit_thankyou_v4', reviewLinkSent: false }
      : { success: false, error: v4.error, templateUsed: null, reviewLinkSent: false }
  }

  // --- No review link: send utility v4 directly -----------------------------
  const v4 = await postThankYouTemplate({
    to, patientPhone,
    templateName: 'olu_visit_thankyou_v4',
    parameters: [
      { type: 'text', text: greetName },
      { type: 'text', text: appointmentText },
    ],
    conversationText: v4Text,
    patientId, visitId,
  })
  return v4.ok
    ? { success: true, templateUsed: 'olu_visit_thankyou_v4', reviewLinkSent: false }
    : { success: false, error: v4.error, templateUsed: null, reviewLinkSent: false }
}

// ── Post-visit clinical summary TEMPLATE (olu_eye_clinic_visit_summary_v2) ─────
// Doctor-triggered. Diagnosis + humanized prescription.

export async function sendVisitSummaryWhatsApp({
  patientName,
  patientFirstName = null,
  patientPhone,
  diagnosis,
  medications,
  followUpDate,
}: {
  patientName: string
  patientFirstName?: string | null
  patientPhone: string
  diagnosis: string | null
  medications: any[]
  followUpDate: string | null
}): Promise<{ success: boolean; error?: string }> {
  const to = formatNigerianPhone(patientPhone)
  if (!to) {
    return { success: false, error: `Unrecognised phone format: ${patientPhone}` }
  }

  // Messaging control: this one is DOCTOR-TRIGGERED (not automated), so it is
  // NOT gated by automated_sends_enabled — a doctor can always send it. But the
  // test-mode allowlist still applies, so a test window never messages a real
  // patient by accident.
  const settings = await getSettings()
  if (!isAllowedRecipient(patientPhone, settings)) {
    console.log(`🔇 Visit summary skipped for ${patientPhone} (test mode)`)
    return { success: false, error: 'Recipient not in test allowlist (test mode on)' }
  }

  const prescriptionText = humanizePrescriptionList(medications)

  const appointmentText = followUpDate
    ? new Date(followUpDate + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'To be scheduled — please contact the clinic'

  const diagnosisText = diagnosis?.trim() || 'See clinic notes'
  const reviewLink = process.env.GOOGLE_REVIEW_LINK ?? 'https://olueyeclinic.com/review'

  // Stored first name when present; otherwise the full name (not a token).
  const greetName = greetingName({ firstName: patientFirstName, fullName: patientName }) || patientName

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'olu_eye_clinic_visit_summary_v2',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: greetName },
            { type: 'text', text: diagnosisText },
            { type: 'text', text: prescriptionText },
            { type: 'text', text: appointmentText },
            { type: 'text', text: reviewLink },
          ],
        },
      ],
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

    console.log('WhatsApp API response:', JSON.stringify(data))

    if (!response.ok || data.error) {
      console.error('WhatsApp sendVisitSummaryWhatsApp error:', data.error ?? data)
      await logMessageSend({
        phone: patientPhone,
        kind: 'summary',
        templateName: 'olu_eye_clinic_visit_summary_v2',
        outcome: { ok: false, ...metaErrorFields(data) },
      })
      return { success: false, error: data.error?.message ?? 'WhatsApp API request failed' }
    }
    const waMessageId: string | null = data?.messages?.[0]?.id ?? null
    await logMessageSend({
      phone: patientPhone,
      kind: 'summary',
      templateName: 'olu_eye_clinic_visit_summary_v2',
      outcome: { ok: true, waMessageId },
    })
    // Log the full human-readable message exactly as the visit-summary template
    // renders it on the patient's phone.
    await logWhatsAppMessage(
      patientPhone,
      'system',
      `*Olu Eye Clinic — Visit Summary*\n\n` +
      `Dear ${greetName}, you are diagnosed of ${diagnosisText}.\n` +
      `Please, endeavour to keep to your treatment regimen religiously.\n\n` +
      `*Treatment Regimen:*\n${prescriptionText}\n\n` +
      `*Next Appointment:* ${appointmentText}\n\n` +
      `Thanks for choosing OLU EYE CLINIC.\n\n` +
      `We'd love to hear about your experience! Please leave us a review: ${reviewLink}\n\n` +
      `God bless you. - Olu Eye Clinic Team`,
      waMessageId
    )
    return { success: true }
  } catch (err: any) {
    console.error('sendVisitSummaryWhatsApp network error:', err)
    await logMessageSend({
      phone: patientPhone,
      kind: 'summary',
      templateName: 'olu_eye_clinic_visit_summary_v2',
      outcome: { ok: false, errorCode: null, errorTitle: 'Network error', errorDetails: err?.message ?? null },
    })
    return { success: false, error: err.message ?? 'Network error' }
  }
}
