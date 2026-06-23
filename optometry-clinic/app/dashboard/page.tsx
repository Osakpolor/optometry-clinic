import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppointmentsTable from '@/components/AppointmentsTable'
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
    { count: totalAppointments },
    { data: todayAppointments },
    { data: followUps },
    { data: recentPatients },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'booked'),
    supabase
      .from('appointments')
      .select('id, appointment_date, service_type, status, patients(full_name, phone)')
      .gte('appointment_date', today.toISOString())
      .lt('appointment_date', tomorrow.toISOString())
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
  ])

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total patients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{totalPatients ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{totalAppointments ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Today's appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{todayAppointments?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Today's appointments — takes 2 cols */}
        <div className="col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-medium">Today's appointments</CardTitle>
              <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {todayAppointments && todayAppointments.length > 0 ? (
                <AppointmentsTable appointments={todayAppointments} />
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No appointments today.</p>
              )}
            </CardContent>
          </Card>

          {/* Recently added patients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-medium">Recently added patients</CardTitle>
              <Link href="/dashboard/patients" className="text-sm text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <ul className="flex flex-col divide-y">
                {recentPatients?.map(p => (
                  <li key={p.id} className="flex items-center justify-between py-2.5">
                    <Link href={`/dashboard/patients/${p.id}`} className="text-sm font-medium hover:underline">
                      {p.full_name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{p.phone ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Follow-ups sidebar */}
        <div className="col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Follow-ups this week</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {followUps && followUps.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {followUps.map((f: any) => (
                    <li key={f.id} className="flex flex-col gap-1">
                      <Link href={`/dashboard/patients/${f.patient_id}`} className="text-sm font-medium hover:underline">
                        {f.patients?.full_name}
                      </Link>
                      <Badge variant="outline" className="w-fit text-xs text-orange-600 border-orange-200 bg-orange-50">
                        {new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No follow-ups due.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}