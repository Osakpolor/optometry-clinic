// lib/whatsapp.ts
// WhatsApp Cloud API utility functions.
// All sending goes through the clinic's registered number.

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!
const API_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats a Nigerian phone number to E.164 international format
 * required by WhatsApp (e.g. 08012345678 → 2348012345678).
 */
export function formatNigerianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('234') && digits.length >= 13) {
    return digits
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return '234' + digits.slice(1)
  }
  if (digits.length === 10) {
    return '234' + digits
  }

  return null
}

/**
 * Formats the drug prescription array into a single readable text block
 * for the {{3}} template parameter.
 */
export function formatPrescriptions(medications: any[]): string {
  if (!medications || medications.length === 0) return 'No medications prescribed.'

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

  return lines.length > 0 ? lines.join('\n') : 'No medications prescribed.'
}

// ── Existing functions (used by webhook, cron, and send routes) ───────────────

/**
 * Sends a free-form text reply to a patient who has messaged the clinic
 * within the last 24 hours. Used by the AI webhook auto-reply.
 */
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

/**
 * Sends a booking confirmation message to a new lead.
 * Used by the /api/whatsapp/send route.
 */
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
  const details = [service, date, time].filter(Boolean).join(', ')
  const message =
    `Hello ${fullName}, thank you for booking with Olu Eye Clinic! ` +
    (details ? `Your appointment details: ${details}. ` : '') +
    `A member of our team will contact you shortly to confirm. ` +
    `For enquiries call 09166015438. - OluEyeClnc`

  return sendWhatsAppMessage(to, message)
}

/**
 * Sends an appointment reminder to a patient.
 * Used by the /api/cron/appointment-reminders route.
 */
export async function sendAppointmentReminder({
  to,
  fullName,
  date,
}: {
  to: string
  fullName: string
  date: string
}): Promise<{ success: boolean; error?: string }> {
  const message =
    `Dear ${fullName}, this is a reminder that your eye check-up at ` +
    `Olu Eye Clinic is scheduled for ${date}. ` +
    `Please arrive 10 minutes early. To reschedule call 09166015438. - OluEyeClnc`

  return sendWhatsAppMessage(to, message)
}

// ── New: post-visit summary template message ──────────────────────────────────

/**
 * Sends the post-visit summary WhatsApp template message to a patient
 * after a new visit is saved by the doctor.
 *
 * Template: olu_eye_clinic_visit_summary_v2
 * {{1}} = patient name
 * {{2}} = diagnosis
 * {{3}} = prescriptions block
 * {{4}} = next appointment date
 * {{5}} = Google review link
 */
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

  const prescriptionText = formatPrescriptions(medications)

  const appointmentText = followUpDate
    ? new Date(followUpDate + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'No follow-up date set'

  const diagnosisText = diagnosis?.trim() || 'See clinic notes'

  // Update this env var once the Google Business Profile is live
  const reviewLink = process.env.GOOGLE_REVIEW_LINK ?? 'https://olueyeclinic.com'

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'olu_eye_clinic_visit_summary_v2',
      language: { code: 'en_US' },
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

    if (!response.ok || data.error) {
      console.error('WhatsApp sendVisitSummaryWhatsApp error:', data.error ?? data)
      return {
        success: false,
        error: data.error?.message ?? 'WhatsApp API request failed',
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('sendVisitSummaryWhatsApp network error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}
