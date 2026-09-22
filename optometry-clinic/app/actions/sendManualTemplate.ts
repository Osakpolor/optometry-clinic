'use server'

// app/actions/sendManualTemplate.ts
// Send an approved TEMPLATE to a patient on demand from the inbox — not tied
// to the post-visit auto-send. Its main jobs:
//   • reach a patient whose 24h window is closed (free-form won't deliver, a
//     template will), and
//   • let staff nudge a reminder any time.
// Reminder only for now; it resolves the patient's next upcoming appointment
// and sends the olu_reminder_iris template. Logged to the thread, so it shows
// live via Realtime.

import { createClient } from '@/lib/supabase/server'
import { getPhoneVariants } from '@/lib/phone-utils'
import { sendAppointmentReminderTemplate } from '@/lib/whatsapp'
import { getCurrentStaff, resolveAccess } from '@/lib/conversationAccess'

export async function sendManualReminder(
  phoneNumber: string
): Promise<{ ok: boolean; error?: string }> {
  const staff = await getCurrentStaff()
  if (!staff) return { ok: false, error: 'Not signed in' }
  const access = await resolveAccess(staff.role)
  if (!access.can_reply) return { ok: false, error: 'No permission' }

  const supabase = await createClient()

  const variants = getPhoneVariants(phoneNumber)
  const orClause = variants.map(p => `phone.eq.${p}`).join(',')
  const { data: patients } = await supabase
    .from('patients')
    .select('id, full_name, phone')
    .or(orClause)
    .limit(1)
  const patient = patients?.[0]
  if (!patient) return { ok: false, error: 'No patient record for this number' }
  if (!patient.phone) return { ok: false, error: 'No phone on the patient record' }

  // Next upcoming appointment (today or later)
  const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: visits } = await supabase
    .from('visit_records')
    .select('follow_up_date')
    .eq('patient_id', patient.id)
    .not('follow_up_date', 'is', null)
    .gte('follow_up_date', today)
    .order('follow_up_date', { ascending: true })
    .limit(1)

  const next = visits?.[0]?.follow_up_date
  if (!next) {
    return {
      ok: false,
      error: 'No upcoming appointment date for this patient. Set one on their visit first.',
    }
  }

  const appointmentText = new Date(next + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // NOTE: sendAppointmentReminderTemplate respects the automated_sends_enabled
  // switch and the test-mode allowlist. So a manual reminder won't fire while
  // automated sends are globally paused — deliberate coupling for safety.
  const res = await sendAppointmentReminderTemplate({
    patientPhone: patient.phone,
    patientName: patient.full_name,
    appointmentDate: appointmentText,
  })
  return res.success ? { ok: true } : { ok: false, error: res.error }
}
