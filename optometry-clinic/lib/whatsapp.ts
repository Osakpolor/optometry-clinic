// lib/whatsapp.ts
// Sends WhatsApp template messages via Meta Cloud API.
// Used for post-visit summaries sent to patients after a visit is saved.

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!
const API_URL = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`

/**
 * Formats a Nigerian phone number to the E.164 international format
 * that WhatsApp requires (e.g. 08012345678 → 2348012345678).
 * Also handles numbers already in international format.
 */
export function formatNigerianPhone(phone: string): string | null {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('234') && digits.length >= 13) {
    // Already in international format e.g. 2348012345678
    return digits
  }

  if (digits.startsWith('0') && digits.length === 11) {
    // Local format e.g. 08012345678 → 2348012345678
    return '234' + digits.slice(1)
  }

  if (digits.length === 10) {
    // Missing leading zero e.g. 8012345678 → 2348012345678
    return '234' + digits
  }

  // Unrecognised format — return null so caller can skip sending
  return null
}

/**
 * Formats the drug prescription array into a single readable text block
 * for the {{3}} template parameter.
 * e.g. "Tab Amoxicillin bd x 30 tabs x 5 days"
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

/**
 * Sends the post-visit summary template message to a patient.
 *
 * Template: olu_eye_clinic_visit_summary
 * {{1}} = patient name
 * {{2}} = diagnosis
 * {{3}} = prescriptions (multi-line text block)
 * {{4}} = next appointment date (or "No follow-up date set")
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
  // Format the phone number — bail out if unrecognisable
  const to = formatNigerianPhone(patientPhone)
  if (!to) {
    return { success: false, error: `Unrecognised phone format: ${patientPhone}` }
  }

  // Build the prescription block for {{3}}
  const prescriptionText = formatPrescriptions(medications)

  // Format the follow-up date for {{4}}
  const appointmentText = followUpDate
    ? new Date(followUpDate + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'No follow-up date set'

  // Diagnosis fallback
  const diagnosisText = diagnosis?.trim() || 'See clinic notes'

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
      console.error('WhatsApp API error:', data.error ?? data)
      return {
        success: false,
        error: data.error?.message ?? 'WhatsApp API request failed',
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('WhatsApp send error:', err)
    return { success: false, error: err.message ?? 'Network error' }
  }
}