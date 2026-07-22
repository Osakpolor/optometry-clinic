// lib/whatsapp.ts
// WhatsApp Cloud API utility functions.
// All sending goes through the clinic's registered number.

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!
const API_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatNigerianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length >= 13) return digits
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return null
}

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
  const details = [service, date, time].filter(Boolean).join(', ')
  const message =
    `Hello ${fullName}, thank you for booking with Olu Eye Clinic! ` +
    (details ? `Your appointment details: ${details}. ` : '') +
    `A member of our team will contact you shortly to confirm. ` +
    `For enquiries call 09166015438. - OluEyeClnc`
  return sendWhatsAppMessage(to, message)
}

// ── Appointment reminder ──────────────────────────────────────────────────────

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


// ── ADD THIS FUNCTION to lib/whatsapp.ts ──
// (paste it alongside the other functions, e.g. after sendAppointmentReminder)
//
// Sends the appointment reminder as an APPROVED TEMPLATE, so it delivers
// reliably even to patients who haven't messaged the clinic in 24 hours.
// This is different from sendAppointmentReminder (free-form) which only
// works inside an open conversation window.
//
// Template: olu_appointment_reminder
// {{1}} = patient name
// {{2}} = appointment date (formatted)
// {{3}} = clinic phone

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

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'olu_appointment_reminder',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: patientName },
            { type: 'text', text: appointmentDate },
            { type: 'text', text: '09166015438' },
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
    return { success: true }
  } catch (err: any) {
    console.error('sendAppointmentReminderTemplate network error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}


// ── Post-visit summary template message ──────────────────────────────────────

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
  const reviewLink = process.env.GOOGLE_REVIEW_LINK ?? 'https://olueyeclinic.com'

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
    return { success: true }
  } catch (err: any) {
    console.error('sendVisitSummaryWhatsApp network error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}
