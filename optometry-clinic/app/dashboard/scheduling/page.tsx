import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole, canManageAppointments } from '@/lib/auth/roles'
import { clinicDay, clinicToday, OCCUPANCY_EXCLUDED_STATUSES } from '@/lib/scheduling-config'
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
export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
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

  // ── Calendar data: every appointment EXCEPT cancelled ────────────────────
  // Occupancy counts booked + confirmed + completed + no_show (only cancelled
  // excluded), so a worked-through day keeps its real volume and the calendar
  // matches the List. Also the source for the Today / Upcoming tiles. Loaded
  // across a window so the month grid navigates without a per-month refetch.
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 5, 1))
  const occExcluded = `(${OCCUPANCY_EXCLUDED_STATUSES.map(s => `"${s}"`).join(',')})`

  const { data: calRaw } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status, patients(full_name)')
    .not('status', 'in', occExcluded)
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

  const upcomingCount = calendarAppointments.filter(a => clinicDay(a.date) > todayStr).length

  // ── Today's day-sheet (the minimal default view) ─────────────────────────
  // Only today's appointments, cancelled excluded. Range is [today, tomorrow).
  const tomorrowStr = (() => {
    const d = new Date(`${todayStr}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  const { data: todayRaw } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status, patients(full_name)')
    .gte('appointment_date', `${todayStr}T00:00:00`)
    .lt('appointment_date', `${tomorrowStr}T00:00:00`)
    .neq('status', 'cancelled')
    .order('appointment_date', { ascending: true })
    .limit(300)

  const todayAppointments = (todayRaw ?? []).map(a => ({
    id: a.id,
    patientId: a.patient_id,
    patientName: embed<{ full_name: string | null }>(a.patients)?.full_name ?? 'Unknown patient',
    date: a.appointment_date,
    serviceType: a.service_type,
    status: a.status,
  }))
  const todayCount = todayAppointments.length

  // ── Upcoming list (date range + status) — the ONLY place browsing lives ──
  // Adjustable From/To + status filter (collapsible in the UI). Defaults to
  // today → ~3 months ahead, ascending; move "From" back to see past.
  const sp = await searchParams
  const toDefault = (() => {
    const d = new Date(`${todayStr}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + 3)
    return d.toISOString().slice(0, 10)
  })()
  const listFrom = sp.from || todayStr
  const listTo = sp.to || toDefault
  const listStatus = sp.status || 'all'

  let listQuery = supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status, patients(full_name)')
    .gte('appointment_date', `${listFrom}T00:00:00`)
    .lte('appointment_date', `${listTo}T23:59:59`)
    .order('appointment_date', { ascending: true })
    .limit(500)
  if (listStatus !== 'all') listQuery = listQuery.eq('status', listStatus)

  const { data: listRaw } = await listQuery
  const upcomingAppointments = (listRaw ?? []).map(a => ({
    id: a.id,
    patientId: a.patient_id,
    patientName: embed<{ full_name: string | null }>(a.patients)?.full_name ?? 'Unknown patient',
    date: a.appointment_date,
    serviceType: a.service_type,
    status: a.status,
  }))

  // Arriving with a filter in the URL means the user was browsing Upcoming;
  // otherwise land on the minimal default (today, pending-on-top).
  const hasFilter = Boolean(sp.from || sp.to || (sp.status && sp.status !== 'all'))
  const initialView: 'today' | 'upcoming' = hasFilter ? 'upcoming' : 'today'

  return (
    <SchedulingHub
      pendingRequests={pendingRequests}
      todayAppointments={todayAppointments}
      upcomingAppointments={upcomingAppointments}
      calendarAppointments={calendarAppointments}
      counts={{
        today: todayCount,
        upcoming: upcomingCount,
        pending: pendingRequests.length,
      }}
      todayStr={todayStr}
      canManage={canManageAppointments(role)}
      filter={{ from: listFrom, to: listTo, status: listStatus }}
      initialView={initialView}
    />
  )
}
