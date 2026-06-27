import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppointmentsTable from '@/components/AppointmentsTable'
import LeadsTable from '@/components/LeadsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import DashboardRefresh from '@/components/DashboardRefresh'

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    { count: totalPatients },
    { data: todayAppointments },
    { data: followUps },
    { data: recentPatients },
    { data: activeLeads },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase
      .from('appointments')
      .select('id, patient_id, appointment_date, service_type, status, patients(full_name, phone)')
      .gte('appointment_date', today.toISOString())
      .lt('appointment_date', tomorrow.toISOString())
      .not('status', 'in', '("cancelled","completed")')
      .order('appointment_date', { ascending: true }),
    supabase
      .from('visit_records')
      .select('id, follow_up_date, patient_id, patients(full_name)')
      .not('follow_up_date', 'is', null)
      .lte('follow_up_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order('follow_up_date', { ascending: true })
      .limit(5),
    supabase
      .from('patients')
      .select('id, full_name, phone, created_at')
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

  const dateLabel = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

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
            <span className="text-xs font-medium text-muted-foreground">
              Total patients
            </span>
            <span className="text-4xl font-semibold tracking-tight text-gray-900">
              {totalPatients ?? 0}
            </span>
            <span className="text-xs text-brand opacity-0 group-hover:opacity-100 transition-opacity">
              View all patients →
            </span>
          </div>
        </Link>

        <div className="bg-white rounded-lg border border-border px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Today's appointments
          </span>
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

          {/* Follow-ups this week */}
          <Card className="border border-border shadow-none">
            <CardHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Follow-ups this week
                </CardTitle>
                {followUps && followUps.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    {followUps.length} due
                  </span>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-5 pt-4 pb-5">
              {followUps && followUps.length > 0 ? (
                <ul className="space-y-3">
                  {followUps.map((f: any) => (
                    <li key={f.id}>
                      <Link
                        href={`/dashboard/patients/${f.patient_id}`}
                        className="group flex items-center justify-between hover:opacity-80 transition-opacity"
                      >
                        <span className="text-sm font-medium text-gray-900 group-hover:text-brand transition-colors">
                          {f.patients?.full_name}
                        </span>
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {new Date(f.follow_up_date).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short'
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No follow-ups due.</p>
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
              <CardTitle className="text-sm font-semibold text-gray-700">
                Leads
              </CardTitle>
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