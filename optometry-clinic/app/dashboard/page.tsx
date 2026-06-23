import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppointmentsTable from '@/components/AppointmentsTable'
import LeadsTable from '@/components/LeadsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

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
      .select('id, appointment_date, service_type, status, patients(full_name, phone)')
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
  const leadsToFollowUp = activeLeads?.filter(l => 
  l.status === 'new' || l.status === 'contacted'
).length ?? 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
  <Link href="/dashboard/patients">
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="pt-4 pb-4 px-4">
        <p className="text-xs font-medium text-muted-foreground leading-tight">Total patients</p>
        <p className="text-3xl sm:text-4xl font-bold mt-1">{totalPatients ?? 0}</p>
      </CardContent>
    </Card>
  </Link>
  <Card>
    <CardContent className="pt-4 pb-4 px-4">
      <p className="text-xs font-medium text-muted-foreground leading-tight">Leads to follow up</p>
      <p className="text-3xl sm:text-4xl font-bold mt-1">{leadsToFollowUp}</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-4 pb-4 px-4">
      <p className="text-xs font-medium text-muted-foreground leading-tight">Today's appts</p>
      <p className="text-3xl sm:text-4xl font-bold mt-1">{todayAppointments?.length ?? 0}</p>
    </CardContent>
  </Card>
</div>

      {/* Leads */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 sm:px-6">
          <div>
            <CardTitle className="text-base font-semibold">Leads</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Online requests — call or WhatsApp to confirm</p>
          </div>
          {newLeadsCount > 0 && (
            <Badge className="bg-blue-600 text-white text-xs">{newLeadsCount} new</Badge>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 px-4 sm:px-6">
          <LeadsTable leads={activeLeads ?? []} />
        </CardContent>
      </Card>

      {/* Main grid — stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Today's appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold">Today's appointments</CardTitle>
              <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 px-4 sm:px-6">
              {todayAppointments && todayAppointments.length > 0 ? (
                <AppointmentsTable appointments={todayAppointments} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No appointments today.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent patients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold">Recently registered patients</CardTitle>
              <Link href="/dashboard/patients" className="text-sm text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            <Separator />
            <CardContent className="pt-2 px-4 sm:px-6">
              <ul className="flex flex-col divide-y">
                {recentPatients?.map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/patients/${p.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-1 px-1 rounded transition-colors"
                    >
                      <span className="text-sm font-medium">{p.full_name}</span>
                      <span className="text-xs text-muted-foreground">{p.phone ?? '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Follow-ups sidebar — full width on mobile */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle className="text-base font-semibold">Follow-ups this week</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 px-4 sm:px-6">
              {followUps && followUps.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {followUps.map((f: any) => (
                    <li key={f.id}>
                      <Link href={`/dashboard/patients/${f.patient_id}`} className="flex flex-col gap-1 hover:opacity-80 transition-opacity">
                        <span className="text-sm font-medium">{f.patients?.full_name}</span>
                        <Badge variant="outline" className="w-fit text-xs text-orange-600 border-orange-200 bg-orange-50">
                          {new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No follow-ups due.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}