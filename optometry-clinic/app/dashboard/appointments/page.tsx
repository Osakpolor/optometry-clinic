import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import AppointmentsTableFull from '@/components/AppointmentsTableFull'

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>
}) {
  const { from, to, status } = await searchParams
  const supabase = await createClient()

  const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const toDate = to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let query = supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, service_type, status, patients(full_name, phone)')
    .gte('appointment_date', `${fromDate}T00:00:00`)
    .lte('appointment_date', `${toDate}T23:59:59`)
    .order('appointment_date', { ascending: true })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: appointments } = await query

  const counts = {
    booked: appointments?.filter(a => a.status === 'booked').length ?? 0,
    confirmed: appointments?.filter(a => a.status === 'confirmed').length ?? 0,
    completed: appointments?.filter(a => a.status === 'completed').length ?? 0,
    no_show: appointments?.filter(a => a.status === 'no_show').length ?? 0,
  }

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {appointments?.length ?? 0} appointments in selected range
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Filter bar */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <form method="GET" className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="rounded border border-gray-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                className="rounded border border-gray-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={status || 'all'}
                className="rounded border border-gray-200 px-3 py-1.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="booked">Booked</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="no_show">No show</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded bg-black px-4 py-1.5 text-sm font-medium text-white hover:opacity-80 transition-opacity"
            >
              Filter
            </button>
            <Link
              href="/dashboard/appointments"
              className="rounded border border-gray-200 px-4 py-1.5 text-sm text-muted-foreground hover:bg-gray-50 transition-colors"
            >
              Reset
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
          {counts.booked} booked
        </Badge>
        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
          {counts.confirmed} confirmed
        </Badge>
        <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">
          {counts.completed} completed
        </Badge>
        <Badge variant="outline" className="text-red-500 border-red-100 bg-red-50">
          {counts.no_show} no show
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">All appointments</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <AppointmentsTableFull appointments={appointments ?? []} />
        </CardContent>
      </Card>
    </main>
  )
}