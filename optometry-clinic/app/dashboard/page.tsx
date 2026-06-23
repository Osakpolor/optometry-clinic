import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppointmentsTable from '@/components/AppointmentsTable'

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
    <main className="mx-auto max-w-4xl p-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total patients</p>
          <p className="mt-2 text-4xl font-semibold">{totalPatients ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Pending bookings</p>
          <p className="mt-2 text-4xl font-semibold">{totalAppointments ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Today's appointments</p>
          <p className="mt-2 text-4xl font-semibold">{todayAppointments?.length ?? 0}</p>
        </div>
      </div>

      {/* Today's appointments */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Today's appointments</h2>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {todayAppointments && todayAppointments.length > 0 ? (
          <AppointmentsTable appointments={todayAppointments} />
        ) : (
          <p className="mt-3 text-sm text-gray-400">No appointments scheduled for today.</p>
        )}
      </div>

      {/* Follow-ups due */}
      <div className="mt-8">
        <h2 className="text-lg font-medium">Follow-ups due this week</h2>
        {followUps && followUps.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {followUps.map((f: any) => (
              <li key={f.id} className="flex items-center justify-between rounded border border-orange-100 bg-orange-50 px-4 py-3 text-sm">
                <Link href={`/dashboard/patients/${f.patient_id}`} className="font-medium text-orange-800 hover:underline">
                  {f.patients?.full_name}
                </Link>
                <span className="text-orange-600">
                  Follow-up: {new Date(f.follow_up_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-400">No follow-ups due this week.</p>
        )}
      </div>

      {/* Recently added patients */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recently added patients</h2>
          <Link href="/dashboard/patients" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {recentPatients?.map(p => (
            <li key={p.id} className="flex items-center justify-between rounded border border-gray-200 px-4 py-3 text-sm">
              <Link href={`/dashboard/patients/${p.id}`} className="font-medium hover:underline">
                {p.full_name}
              </Link>
              <span className="text-gray-400">{p.phone ?? '—'}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}