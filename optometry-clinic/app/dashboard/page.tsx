import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppointmentsTable from '@/components/AppointmentsTable'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, service_type, status, patients(full_name, phone)')
    .order('appointment_date', { ascending: true })

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-semibold">Appointments</h1>
      <Link href="/dashboard/patients" className="text-sm text-blue-600 underline">View patients</Link>
      {error && <p className="mt-4 text-red-600">Error: {error.message}</p>}
      {!error && <AppointmentsTable appointments={appointments ?? []} />}
    </main>
  )
}