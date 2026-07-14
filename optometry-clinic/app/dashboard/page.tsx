import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppointmentsTable from '@/components/AppointmentsTable'
import LeadsTable from '@/components/LeadsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import DashboardRefresh from '@/components/DashboardRefresh'

// ── Date helpers ────────────────────────────────────────────────────────────

function formatVisitDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const visitStart = new Date(date)
  visitStart.setHours(0, 0, 0, 0)

  if (visitStart.getTime() === todayStart.getTime()) return 'Today'
  if (visitStart.getTime() === yesterdayStart.getTime()) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function groupByDate(visits: any[]): { label: string; visits: any[] }[] {
  const groups: Record<string, any[]> = {}
  const order: string[] = []

  for (const v of visits) {
    const label = formatVisitDate(v.visit_date)
    if (!groups[label]) { groups[label] = []; order.push(label) }
    groups[label].push(v)
  }

  return order.map(label => ({ label, visits: groups[label] }))
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Follow-ups: all future + today appointments set from the New Visit form,
  // no upper date limit, ordered closest-first. Linked to the visit that
  // created the appointment so staff can click through to inspect it.
  const followUpCutoff = new Date()
  followUpCutoff.setHours(0, 0, 0, 0)

  const [
    { count: totalPatients },
    { data: todayAppointments },
    { data: followUps },
    { data: recentVisits },
    { data: recentPatients },
    { data: activeLeads },
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),

    supabase
      .from('appointments')
      .select('id, patient_id, appointment_date, service_type, status, patients(full_name, phone)')
      .gte('appointment_date', today.toISOString())
      .lt('appointment_date', tomorrow.toISOString())
      .not('status', 'in', '("cancelled","completed")')
      .order('appointment_date', { ascending: true }),

    // All upcoming follow-up dates from visit records, closest first,
    // no 7-day cap — show everything so nothing gets missed.
    supabase
      .from('visit_records')
      .select('id, follow_up_date, patient_id, patients(full_name)')
      .not('follow_up_date', 'is', null)
      .gte('follow_up_date', followUpCutoff.toISOString().slice(0, 10))
      .order('follow_up_date', { ascending: true })
      .limit(100),

    // Recent visits — last 30 records, joined to patient name + doctor name.
    supabase
      .from('visit_records')
      .select('id, visit_date, patient_id, reason_for_visit, diagnosis, patients(id, full_name), staff_profiles!visit_records_doctor_id_fkey(full_name)')
      .order('visit_date', { ascending: false })
      .limit(30),

    supabase
      .from('patients')
      .select('id, full_name, phone, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('leads')
      .select('id, full_name, phone, email, service_interest, status, created_at')
      .in('status', ['new', 'contacted', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const newLeadsCount = activeLeads?.filter(l => l.status === 'new').length ?? 0
  const visitGroups = groupByDate(recentVisits ?? [])

  const dateLabel = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // How many follow-ups are overdue (date < today) vs upcoming
  const overdueCount = followUps?.filter(f =>
    f.follow_up_date < followUpCutoff.toISOString().slice(0, 10)
  ).length ?? 0

  return (
    <div className="space-y-6">
      <DashboardRefresh />

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block pt-1">
          Auto-refreshes every minute
        </span>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/patients" className="group">
          <div className="bg-white rounded-lg border border-border px-5 py-4 flex flex-col gap-1 hover:border-brand/40 hover:shadow-sm transition-all">
            <span className="text-xs font-medium text-muted-foreground">Total patients</span>
            <span className="text-4xl font-semibold tracking-tight text-gray-900">
              {totalPatients ?? 0}
            </span>
            <span className="text-xs text-brand opacity-0 group-hover:opacity-100 transition-opacity">
              View all patients →
            </span>
          </div>
        </Link>

        <div className="bg-white rounded-lg border border-border px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Today's appointments</span>
          <span className="text-4xl font-semibold tracking-tight text-gray-900">
            {todayAppointments?.length ?? 0}
          </span>
          <span className="text-xs text-muted-foreground">
            {todayAppointments?.length === 0
              ? 'None scheduled'
              : todayAppointments?.length === 1
              ? '1 patient today'
              : `${todayAppointments?.length} patients today`}
          </span>
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-6">

          {/* Today's appointments */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Today's appointments
                </CardTitle>
                {todayAppointments && todayAppointments.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
                    {todayAppointments.length} scheduled
                  </span>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-5 pt-4 pb-5">
              {todayAppointments && todayAppointments.length > 0 ? (
                <AppointmentsTable appointments={todayAppointments} />
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No appointments today.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Recent visits ── */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Recent visits
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {recentVisits?.length ?? 0} latest records
                </span>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0 pt-0 pb-0">
              {visitGroups.length > 0 ? (
                // Scrollable container — max-h keeps it from dominating the page.
                // overflow-y-auto lets it scroll independently of the rest.
                <div className="max-h-80 overflow-y-auto">
                  {visitGroups.map(group => (
                    <div key={group.label}>
                      {/* Date segment header */}
                      <div className="sticky top-0 z-10 bg-gray-50 border-y border-border px-5 py-1.5">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {group.label}
                        </span>
                      </div>
                      {/* Visits within this date */}
                      <ul className="divide-y divide-border">
                        {group.visits.map((v: any) => (
                          <li key={v.id}>
                            <Link
                              href={`/dashboard/patients/${v.patients?.id}/visits/${v.id}`}
                              className="group flex items-center justify-between px-5 py-3
                                         hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-sm font-medium text-gray-900 group-hover:text-brand transition-colors truncate">
                                  {v.patients?.full_name ?? 'Unknown patient'}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {v.reason_for_visit ?? v.diagnosis ?? 'Visit record'}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground ml-4 shrink-0">
                                {v.staff_profiles?.full_name ?? 'Staff'}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No visit records yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently registered patients */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Recently registered
                </CardTitle>
                <Link
                  href="/dashboard/patients"
                  className="text-xs font-medium text-brand hover:text-brand-hover transition-colors"
                >
                  View all →
                </Link>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-5 pt-2 pb-3">
              {recentPatients && recentPatients.length > 0 ? (
                <ul className="divide-y divide-border">
                  {recentPatients.map(p => (
                    <li key={p.id}>
                      <Link
                        href={`/dashboard/patients/${p.id}`}
                        className="group flex items-center justify-between py-3 hover:bg-gray-50 -mx-1 px-1 rounded transition-colors"
                      >
                        <span className="text-sm font-medium text-gray-900 group-hover:text-brand transition-colors">
                          {p.full_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.phone ?? '—'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No patients yet.</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right column — 1/3 width */}
        <div className="lg:col-span-1 space-y-6">

          {/* Follow-ups — all upcoming next-appointment dates, closest first */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Upcoming follow-ups
                </CardTitle>
                {followUps && followUps.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    {followUps.length} scheduled
                  </span>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-5 pt-2 pb-3">
              {followUps && followUps.length > 0 ? (
                // Scrollable so a long list doesn't push the page down
                <div className="max-h-96 overflow-y-auto -mx-5 px-5">
                  <ul className="divide-y divide-border">
                    {followUps.map((f: any) => {
                      const apptDate = new Date(f.follow_up_date)
                      const isToday = f.follow_up_date === followUpCutoff.toISOString().slice(0, 10)
                      const tomorrow2 = new Date(followUpCutoff)
                      tomorrow2.setDate(tomorrow2.getDate() + 1)
                      const isTomorrow = f.follow_up_date === tomorrow2.toISOString().slice(0, 10)

                      const dateLabel2 = isToday
                        ? 'Today'
                        : isTomorrow
                        ? 'Tomorrow'
                        : apptDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

                      const urgencyClass = isToday
                        ? 'bg-red-50 text-red-700'
                        : isTomorrow
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-50 text-gray-600'

                      return (
                        <li key={f.id} className="py-2.5">
                          {/* Name links to the specific visit where the appointment was set */}
                          <Link
                            href={`/dashboard/patients/${f.patient_id}/visits/${f.id}`}
                            className="group flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
                          >
                            <span className="text-sm font-medium text-gray-900 group-hover:text-brand transition-colors truncate">
                              {f.patients?.full_name}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${urgencyClass}`}>
                              {dateLabel2}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Quick actions
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-5 pt-4 pb-5 space-y-2">
              <Link
                href="/dashboard/patients/new"
                className="flex items-center gap-2 w-full rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-brand/5 hover:text-brand border border-border transition-all"
              >
                <span>+</span> Register new patient
              </Link>
              <Link
                href="/dashboard/patients"
                className="flex items-center gap-2 w-full rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-brand/5 hover:text-brand border border-border transition-all"
              >
                <span>↗</span> Find a patient
              </Link>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── Leads section ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-gray-700">Leads</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Online booking requests — call or WhatsApp to confirm
              </p>
            </div>
            {newLeadsCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
                {newLeadsCount} new
              </span>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="px-5 pt-4 pb-5">
          <LeadsTable leads={activeLeads ?? []} />
        </CardContent>
      </Card>

    </div>
  )
}
