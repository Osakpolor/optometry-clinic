import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole, canManageRebooking, canManageAppointments } from '@/lib/auth/roles'
import SchedulingHub from '@/components/scheduling/SchedulingHub'

export const dynamic = 'force-dynamic'

// The Scheduling hub merges the two front-desk lanes:
//   Lane 1 — patient-initiated WhatsApp reschedule requests (approve/decline)
//   Lane 2 — appointments booked directly by staff (reschedule/cancel/confirm)
// Day-level only (walk-in clinic): no times anywhere on this page.
export default async function SchedulingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole()
  // Same access as the old Rebooking page — front-desk staff only.
  if (role !== 'receptionist' && role !== 'admin') {
    redirect('/dashboard')
  }

  // Server time; appointments are stored at noon so the date slice is stable.
  const todayStr = new Date().toISOString().slice(0, 10)

  // ── Lane 1: pending reschedule requests ──────────────────────────────────
  const { data: pendingRaw } = await supabase
    .from('rebook_requests')
    .select(`
      id, patient_id, patient_name, phone_number,
      requested_date, requested_time, service, notes, status, created_at,
      patients ( file_number )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100)

  const pendingRequests = (pendingRaw ?? []).map(r => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    phone: r.phone_number,
    requestedDate: r.requested_date,
    requestedTime: r.requested_time,
    service: r.service,
    notes: r.notes,
    createdAt: r.created_at,
    fileNumber: (r.patients as { file_number: string | null }[] | null)?.[0]?.file_number ?? null,
  }))

  // ── Lane 2: live appointments (today + upcoming, excludes cancelled/done) ─
  const { data: apptsRaw } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status, patients(full_name)')
    .gte('appointment_date', `${todayStr}T00:00:00`)
    .not('status', 'in', '("cancelled","completed")')
    .order('appointment_date', { ascending: true })
    .limit(300)

  const appointments = (apptsRaw ?? []).map(a => ({
    id: a.id,
    patientId: a.patient_id,
    patientName: (a.patients as { full_name: string | null }[] | null)?.[0]?.full_name ?? 'Unknown patient',
    date: a.appointment_date,
    serviceType: a.service_type,
    status: a.status,
  }))

  const todayCount = appointments.filter(a => a.date.slice(0, 10) === todayStr).length
  const upcomingCount = appointments.filter(a => a.date.slice(0, 10) > todayStr).length

  return (
    <SchedulingHub
      pendingRequests={pendingRequests}
      appointments={appointments}
      counts={{
        today: todayCount,
        upcoming: upcomingCount,
        pending: pendingRequests.length,
      }}
      todayStr={todayStr}
      canManageRebook={canManageRebooking(role)}
      canManageAppts={canManageAppointments(role)}
    />
  )
}
