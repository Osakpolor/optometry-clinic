'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole, canManageAppointments } from '@/lib/auth/roles'

type Result = { error?: string; success?: boolean }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Olu is a WALK-IN clinic — appointments are DAY-LEVEL, there are no time
// slots. We store the chosen day at noon as a naive timestamp (no timezone
// conversion). Noon is stable against the ±1–2h timezone differences between
// where the row is written and where it is rendered, so the date can never
// slip to an adjacent day. This matches the convention already used by the
// rebooking and visit forms (`${date}T09:00:00`).
function dayTimestamp(date: string): string {
  return `${date}T12:00:00`
}

// Book a new appointment for an EXISTING patient. Scoped to one patient_id —
// this is not the public lead form.
export async function bookAppointment(
  patientId: string,
  input: { date: string; serviceType: string; note?: string }
): Promise<Result> {
  const role = await getUserRole()
  if (!canManageAppointments(role)) {
    return { error: 'You do not have permission to book appointments.' }
  }
  if (!ISO_DATE.test(input.date)) {
    return { error: 'Please choose a valid date.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('appointments').insert({
    patient_id:       patientId,
    appointment_date: dayTimestamp(input.date),
    service_type:     input.serviceType,
    notes:            input.note?.trim() || null,
    status:           'booked',
  })

  if (error) return { error: error.message }
  return { success: true }
}

// Reschedule = change the DAY of an existing appointment.
export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string
): Promise<Result> {
  const role = await getUserRole()
  if (!canManageAppointments(role)) {
    return { error: 'You do not have permission to reschedule appointments.' }
  }
  if (!ISO_DATE.test(newDate)) {
    return { error: 'Please choose a valid date.' }
  }

  const supabase = await createClient()

  // KNOWN GAP — Phase 4 (reschedule → reminder sync): changing the date here
  // does NOT reset the reminder_sent_week_before / _day_before / _day_of
  // flags. If a reminder already fired for the old date, the patient will
  // NOT get a fresh reminder for the new date until Phase 4 clears those
  // flags on reschedule. The brief assigns that fix to Phase 4 — not done here.
  const { error } = await supabase
    .from('appointments')
    .update({ appointment_date: dayTimestamp(newDate) })
    .eq('id', appointmentId)

  if (error) return { error: error.message }
  return { success: true }
}

// Cancel = soft status change (the row is kept). Cancellation is a
// destructive clinical action, so it is audited: who / what / when.
export async function cancelAppointment(appointmentId: string): Promise<Result> {
  const role = await getUserRole()
  if (!canManageAppointments(role)) {
    return { error: 'You do not have permission to cancel appointments.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Snapshot the pre-cancellation state for the audit trail.
  const { data: appt, error: fetchError } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !appt) {
    return { error: 'Appointment not found.' }
  }

  // Look up the acting staff member's name for a human-readable audit row.
  let staffName: string | null = null
  if (user?.id) {
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    staffName = staff?.full_name ?? null
  }

  // The status change runs on the user's session (RLS enforced) — least
  // privilege, and the role guard above is the real gate.
  const { error: updateError } = await supabase
    .from('appointments')
    .update({
      status:               'cancelled',
      cancelled_by_patient: false,
      cancellation_reason:  'Cancelled by staff',
      cancelled_at:         new Date().toISOString(),
    })
    .eq('id', appointmentId)

  if (updateError) return { error: updateError.message }

  // Auditability is non-negotiable, so the audit write uses the service-role
  // client: it must succeed regardless of whatever RLS audit_log carries for
  // the acting role (a receptionist cancelling must still be recorded).
  const admin = createAdminClient()
  await admin.from('audit_log').insert({
    staff_id:   user?.id ?? null,
    patient_id: appt.patient_id,
    action:     'CANCEL',
    table_name: 'appointments',
    record_id:  appt.id,
    details: {
      cancelled_by_name: staffName,
      cancelled_by_role: role,
      appointment_date:  appt.appointment_date,
      service_type:      appt.service_type,
      previous_status:   appt.status,
    },
  })

  return { success: true }
}
