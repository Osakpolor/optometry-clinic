import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole, canManageAppointments } from '@/lib/auth/roles'
import { clinicDay, clinicToday, ACTIVE_STATUSES } from '@/lib/scheduling-config'
import SchedulingHub from '@/components/scheduling/SchedulingHub'

export const dynamic = 'force-dynamic'

// A to-one PostgREST embed (e.g. appointments → patients) comes back as an
// OBJECT at runtime, even though the generated types widen it to an array.
// Read either shape — indexing [0] on the object silently yields undefined,
// which is what made every hub row render "Unknown patient".
function embed<T>(rel: unknown): T | null {
  if (!rel) return null
  return ((Array.isArray(rel) ? rel[0] : rel) as T) ?? null
}

// The Scheduling hub merges the two front-desk lanes:
//   Lane 1 — patient-initiated WhatsApp reschedule requests (approve/decline)
//   Lane 2 — appointments booked directly by staff (reschedule/cancel/confirm)
// Day-level only (walk-in clinic): no times anywhere on this page.
export default async function SchedulingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole()
  // ONE shared rule for all of Scheduling (admin / doctor / receptionist).
  // A disallowed role redirects cleanly to the dashboard — never throws.
  if (!canManageAppointments(role)) {
    redirect('/dashboard')
  }

  // "Today" is the clinic's LOCAL day (Africa/Lagos), not the server's UTC day.
  const todayStr = clinicToday()

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
    fileNumber: embed<{ file_number: string | null }>(r.patients)?.file_number ?? null,
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
    patientName: embed<{ full_name: string | null }>(a.patients)?.full_name ?? 'Unknown patient',
    date: a.appointment_date,
    serviceType: a.service_type,
    status: a.status,
  }))

  const todayCount = appointments.filter(a => clinicDay(a.date) === todayStr).length
  const upcomingCount = appointments.filter(a => clinicDay(a.date) > todayStr).length

  // ── Calendar data: ACTIVE appointments only (booked/confirmed) ───────────
  // Cancelled/completed/no_show are excluded at the query, so they can never
  // inflate a day's occupancy heat. Loaded across a window (start of last month
  // → ~4 months ahead) so the month grid can navigate without a per-month
  // refetch. Grouping into local days happens in the client via clinicDay().
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 5, 1))

  const { data: calRaw } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status, patients(full_name)')
    .in('status', [...ACTIVE_STATUSES])
    .gte('appointment_date', windowStart.toISOString())
    .lt('appointment_date', windowEnd.toISOString())
    .order('appointment_date', { ascending: true })
    .limit(2000)

  const calendarAppointments = (calRaw ?? []).map(a => ({
    id: a.id,
    patientId: a.patient_id,
    patientName: embed<{ full_name: string | null }>(a.patients)?.full_name ?? 'Unknown patient',
    date: a.appointment_date,
    serviceType: a.service_type,
    status: a.status,
  }))

  return (
    <SchedulingHub
      pendingRequests={pendingRequests}
      appointments={appointments}
      calendarAppointments={calendarAppointments}
      counts={{
        today: todayCount,
        upcoming: upcomingCount,
        pending: pendingRequests.length,
      }}
      todayStr={todayStr}
      canManage={canManageAppointments(role)}
    />
  )
}
