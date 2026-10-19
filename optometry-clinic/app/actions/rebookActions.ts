'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, canManageRebooking } from '@/lib/auth/roles'
import { sendWhatsAppMessage, logWhatsAppMessage } from '@/lib/whatsapp'

// A `warning` means the DB change succeeded but a non-critical side effect
// (the patient WhatsApp notification) did not — the queue state is correct,
// but staff may want to phone the patient.
type Result = { error?: string; success?: boolean; warning?: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Olu is a WALK-IN clinic — DAY-LEVEL only, no time slots. Store the chosen
// day at noon as a naive timestamp so it can never slip to an adjacent day
// across the ±1–2h timezone gap between writer and reader. Same convention as
// appointmentActions.dayTimestamp (that file is 'use server', so its helpers
// can't be imported — they must all be async actions — hence the local copy).
function dayTimestamp(date: string): string {
  return `${date}T12:00:00`
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Approve a patient-initiated reschedule request and (re)book the appointment
// on the chosen DAY. A reschedule REPLACES the patient's existing upcoming
// appointment(s), so those are cancelled and this new one is left standing.
export async function approveRebook(
  requestId: string,
  newDate: string,
  internalNote?: string
): Promise<Result> {
  const role = await getUserRole()
  if (!canManageRebooking(role)) {
    return { error: 'You do not have permission to approve reschedule requests.' }
  }
  if (!ISO_DATE.test(newDate)) {
    return { error: 'Please choose a valid date.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Load the request. Only a still-pending request may be approved — this
  // guards against a double-approve from two receptionists / a stale tab.
  const { data: req, error: reqError } = await supabase
    .from('rebook_requests')
    .select('id, patient_id, patient_name, phone_number, service, notes, status')
    .eq('id', requestId)
    .single()

  if (reqError || !req) return { error: 'Reschedule request not found.' }
  if (req.status !== 'pending') {
    return { error: 'This request has already been handled.' }
  }

  // 1. Create the new appointment on the chosen day.
  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .insert({
      patient_id:       req.patient_id,
      appointment_date: dayTimestamp(newDate),
      service_type:     req.service ?? 'Follow-up visit',
      notes:            req.notes ?? 'Rescheduled via WhatsApp',
      status:           'booked',
    })
    .select('id')
    .single()

  if (apptError || !appt) {
    return { error: 'Could not create the appointment. Please try again.' }
  }

  // 2. Cancel the patient's OTHER upcoming, non-cancelled appointments — a
  //    reschedule replaces the old date rather than adding a second one. Also
  //    self-heals duplicates from any earlier partial approval.
  if (req.patient_id) {
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from('appointments')
      .update({
        status:               'cancelled',
        cancelled_by_patient: true,
        cancellation_reason:  'Replaced by approved reschedule request',
        cancelled_at:         new Date().toISOString(),
      })
      .eq('patient_id', req.patient_id)
      .neq('id', appt.id)
      .gte('appointment_date', `${today}T00:00:00`)
      .not('status', 'in', '("cancelled","completed")')
  }

  // 3. Mark the request approved and link it to the new appointment.
  const { error: updateError } = await supabase
    .from('rebook_requests')
    .update({
      status:          'approved',
      appointment_id:  appt.id,
      resolved_by:     user?.id ?? null,
      resolved_at:     new Date().toISOString(),
      resolution_note: internalNote?.trim() || null,
    })
    .eq('id', requestId)

  if (updateError) return { error: updateError.message }

  // 4. Notify the patient (day-level — no time). Non-fatal: the booking is the
  //    source of truth, so a WhatsApp failure returns a warning, not an error.
  try {
    const message =
      `Hi ${req.patient_name}, your appointment at Olu Eye Clinic has been ` +
      `confirmed for ${formatDay(dayTimestamp(newDate))}. Please arrive early. ` +
      `For enquiries call 09166015438. - Olu Eye Clinic`
    const sent = await sendWhatsAppMessage(req.phone_number, message)
    if (sent.success) {
      await logWhatsAppMessage(req.phone_number, 'assistant', message)
    } else {
      return { success: true, warning: 'Appointment booked, but the WhatsApp confirmation could not be sent.' }
    }
  } catch {
    return { success: true, warning: 'Appointment booked, but the WhatsApp confirmation could not be sent.' }
  }

  return { success: true }
}

// Decline a patient-initiated reschedule request. Destructive to the request
// (it resolves it and messages the patient), so it is audited: who/what/when.
export async function declineRebook(
  requestId: string,
  message: string,
  internalNote?: string
): Promise<Result> {
  const role = await getUserRole()
  if (!canManageRebooking(role)) {
    return { error: 'You do not have permission to decline reschedule requests.' }
  }
  if (!message?.trim()) {
    return { error: 'A message to the patient is required.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: req, error: reqError } = await supabase
    .from('rebook_requests')
    .select('id, patient_id, patient_name, phone_number, requested_date, status')
    .eq('id', requestId)
    .single()

  if (reqError || !req) return { error: 'Reschedule request not found.' }
  if (req.status !== 'pending') {
    return { error: 'This request has already been handled.' }
  }

  // Human-readable actor name for the audit trail.
  let staffName: string | null = null
  if (user?.id) {
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    staffName = staff?.full_name ?? null
  }

  // Resolve the request.
  const { error: updateError } = await supabase
    .from('rebook_requests')
    .update({
      status:          'rejected',
      resolved_by:     user?.id ?? null,
      resolved_at:     new Date().toISOString(),
      resolution_note: internalNote?.trim() || message.trim(),
    })
    .eq('id', requestId)

  if (updateError) return { error: updateError.message }

  // Audit (non-negotiable for destructive actions). Service-role client so the
  // write succeeds regardless of audit_log RLS for the acting role.
  const admin = createAdminClient()
  await admin.from('audit_log').insert({
    staff_id:   user?.id ?? null,
    patient_id: req.patient_id,
    action:     'DECLINE',
    table_name: 'rebook_requests',
    record_id:  req.id,
    details: {
      declined_by_name: staffName,
      declined_by_role: role,
      requested_date:   req.requested_date,
      internal_note:    internalNote?.trim() || null,
    },
  })

  // Notify the patient. Non-fatal (the decline itself is recorded).
  try {
    const sent = await sendWhatsAppMessage(req.phone_number, message.trim())
    if (sent.success) {
      await logWhatsAppMessage(req.phone_number, 'assistant', message.trim())
    } else {
      return { success: true, warning: 'Request declined, but the WhatsApp reply could not be sent.' }
    }
  } catch {
    return { success: true, warning: 'Request declined, but the WhatsApp reply could not be sent.' }
  }

  return { success: true }
}
