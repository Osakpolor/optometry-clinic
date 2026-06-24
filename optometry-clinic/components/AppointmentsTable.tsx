'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

const STATUSES = ['booked', 'confirmed', 'completed', 'no_show', 'cancelled']

const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-gray-50 text-gray-600 border-gray-200',
  no_show: 'bg-red-50 text-red-600 border-red-200',
  cancelled: 'bg-red-50 text-red-400 border-red-100',
}

export default function AppointmentsTable({ appointments }: { appointments: any[] }) {
  const router = useRouter()
  const supabase = createClient()

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (!error) router.refresh()
  }

  if (!appointments.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No appointments.</p>
  }

  return (
    <div>
      {/* Mobile view */}
      <div className="flex flex-col divide-y sm:hidden">
        {appointments.map(appt => (
          <div key={appt.id} className="py-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/dashboard/patients/${appt.patient_id}`} className="text-sm font-medium hover:bg-gray-100 hover:shadow-sm rounded px-2 py-1 -mx-2 transition-all">
                  {appt.patients?.full_name}
                </Link>
                <p className="text-xs text-muted-foreground">{appt.patients?.phone}</p>
                <p className="text-xs text-muted-foreground">{appt.service_type}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(appt.appointment_date).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })} at {new Date(appt.appointment_date).toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <select
                value={appt.status}
                onChange={e => updateStatus(appt.id, e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white shrink-0"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <table className="hidden sm:table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Patient</th>
            <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Phone</th>
            <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Service</th>
            <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Date</th>
            <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map(appt => (
            <tr key={appt.id} className="border-b border-gray-100">
              <td className="py-2.5 pr-4 font-medium">
                <Link href={`/dashboard/patients/${appt.patient_id}`} className="hover:bg-gray-100 hover:shadow-sm rounded px-2 py-1 -mx-2 transition-all">
                  {appt.patients?.full_name}
                </Link>
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground">{appt.patients?.phone}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">{appt.service_type}</td>
              <td className="py-2.5 pr-4 text-muted-foreground">
                {new Date(appt.appointment_date).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </td>
              <td className="py-2.5 pr-4">
                <select
                  value={appt.status}
                  onChange={e => updateStatus(appt.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}