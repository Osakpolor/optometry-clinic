// lib/whatsapp.ts
// WhatsApp Cloud API utility functions.
// All sending goes through the clinic's registered number.

import { humanizePrescriptionList } from '@/lib/humanizePrescription'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { getSettings, isAllowedRecipient } from '@/lib/settings'
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
export async function logWhatsAppMessage(
  phone: string,
  role: 'user' | 'assistant' | 'system',
  message: string
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
    })
  } catch (err) {
    console.error('logWhatsAppMessage failed (non-blocking):', err)
  }
}

// ── Core send function ────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: data.error?.message ?? 'API error' }
    }
    return { success: true }
  } catch (err: any) {
    console.error('sendWhatsAppMessage network error:', err)
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
  const message =
    `Hello ${fullName}, thank you for booking with Olu Eye Clinic! ` +
    (details ? `Your appointment details: ${details}. ` : '') +
    `A member of our team will contact you shortly to confirm. ` +
    `For enquiries call 09166015438. - OluEyeClnc`

  const result = await sendWhatsAppMessage(to, message)
  if (result.success) {
    // Log exactly what the patient received
    await logWhatsAppMessage(to, 'system', message)
  }
  return result
}

// ── Appointment reminder (free-form, legacy — kept for compatibility) ─────────

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
  const message =
    `Dear ${fullName}, this is a ${urgency}reminder that your eye check-up at ` +
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
  appointmentDate,
}: {
  patientPhone: string
  patientName: string
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
            { type: 'text', text: patientName },
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
      return { success: false, error: data.error?.message ?? 'WhatsApp API error' }
    }
    // Log the full human-readable message exactly as the olu_reminder_iris
    // template renders it on the patient's phone.
    await logWhatsAppMessage(
      patientPhone,
      'system',
      `Hello ${patientName}, I'm Iris, Olu Eye Clinic's AI assistant. ` +
      `Thank you for trusting us with your eye health. ` +
      `This is a friendly reminder of your next appointment on ${appointmentDate}. ` +
      `We look forward to seeing you. Enjoy the rest of your day!`
    )
    return { success: true }
  } catch (err: any) {
    console.error('sendAppointmentReminderTemplate network error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}

// ── Post-visit thank-you TEMPLATE (olu_visit_thankyou_v5) ─────────────────────
// MARKETING category (Meta reclassified it because of the review link — we're
// running this deliberately to measure review uptake; may revisit later).
// Paragraph-spaced body, inline review link, NO button. Three body params:
//   {{1}} = patient name
//   {{2}} = next appointment date, "July 28th, 2026" style (or fallback text)
//   {{3}} = review link

export async function sendVisitThankYou({
  patientName,
  patientPhone,
  followUpDate,
}: {
  patientName: string
  patientPhone: string
  followUpDate: string | null
}): Promise<{ success: boolean; error?: string }> {
  const to = formatNigerianPhone(patientPhone)
  if (!to) {
    return { success: false, error: `Unrecognised phone format: ${patientPhone}` }
  }

  // Messaging controls: automated sends can be paused globally, and in test
  // mode only allowlisted numbers receive anything.
  const settings = await getSettings()
  if (!settings.automated_sends_enabled) {
    console.log(`🔇 Thank-you skipped for ${patientPhone} (automated sends disabled)`)
    return { success: false, error: 'Automated sends are disabled' }
  }
  if (!isAllowedRecipient(patientPhone, settings)) {
    console.log(`🔇 Thank-you skipped for ${patientPhone} (test mode)`)
    return { success: false, error: 'Recipient not in test allowlist (test mode on)' }
  }

  // Format as "July 28th, 2026" (month name, ordinal day, year)
  function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
  }
  function formatLongDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00')
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    return `${month} ${ordinal(d.getDate())}, ${d.getFullYear()}`
  }

  const appointmentText = followUpDate
    ? formatLongDate(followUpDate)
    : 'to be scheduled — please contact the clinic'

  const reviewLink = process.env.GOOGLE_REVIEW_LINK ?? 'https://olueyeclinic.com/review'

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'olu_visit_thankyou_v5',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: patientName },
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
    if (!response.ok || data.error) {
      console.error('sendVisitThankYou error:', data.error ?? data)
      return { success: false, error: data.error?.message ?? 'WhatsApp API error' }
    }
    // Log the full human-readable message exactly as the olu_visit_thankyou_v5
    // template renders it on the patient's phone (paragraph spacing included —
    // newlines are fine here, this is our own DB, not a template param).
    await logWhatsAppMessage(
      patientPhone,
      'system',
      `Dear ${patientName},\n\n` +
      `Thank you for trusting us with your eye health.\n\n` +
      `*Your next appointment is on ${appointmentText}.*\n\n` +
      `We'd love to hear about your experience at the clinic! Please leave us a review: ${reviewLink}\n\n` +
      `Enjoy the rest of your day!\n\n` +
      `Olu Eye Clinic.`
    )
    return { success: true }
  } catch (err: any) {
    console.error('sendVisitThankYou network error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}

// ── Post-visit clinical summary TEMPLATE (olu_eye_clinic_visit_summary_v2) ─────
// Doctor-triggered. Diagnosis + humanized prescription.

export async function sendVisitSummaryWhatsApp({
  patientName,
  patientPhone,
  diagnosis,
  medications,
  followUpDate,
}: {
  patientName: string
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
            { type: 'text', text: patientName },
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
      return { success: false, error: data.error?.message ?? 'WhatsApp API request failed' }
    }
    // Log the full human-readable message exactly as the visit-summary template
    // renders it on the patient's phone.
    await logWhatsAppMessage(
      patientPhone,
      'system',
      `*Olu Eye Clinic — Visit Summary*\n\n` +
      `Dear ${patientName}, you are diagnosed of ${diagnosisText}.\n` +
      `Please, endeavour to keep to your treatment regimen religiously.\n\n` +
      `*Treatment Regimen:*\n${prescriptionText}\n\n` +
      `*Next Appointment:* ${appointmentText}\n\n` +
      `Thanks for choosing OLU EYE CLINIC.\n\n` +
      `We'd love to hear about your experience! Please leave us a review: ${reviewLink}\n\n` +
      `God bless you. - Olu Eye Clinic Team`
    )
    return { success: true }
  } catch (err: any) {
    console.error('sendVisitSummaryWhatsApp network error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}
