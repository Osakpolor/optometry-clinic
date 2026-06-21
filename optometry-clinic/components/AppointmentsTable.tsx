'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['booked', 'confirmed', 'completed', 'no_show', 'cancelled']

export default function AppointmentsTable({ appointments }: { appointments: any[] }) {
  const router = useRouter()
  const supabase = createClient()

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (!error) router.refresh()
  }

  return (
    <table className="mt-6 w-full text-left text-sm">
      <thead>
        <tr className="border-b border-gray-300">
          <th className="py-2 pr-4">Patient</th>
          <th className="py-2 pr-4">Phone</th>
          <th className="py-2 pr-4">Service</th>
          <th className="py-2 pr-4">Date</th>
          <th className="py-2 pr-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((appt) => (
          <tr key={appt.id} className="border-b border-gray-100">
            <td className="py-2 pr-4">{appt.patients?.full_name}</td>
            <td className="py-2 pr-4">{appt.patients?.phone}</td>
            <td className="py-2 pr-4">{appt.service_type}</td>
            <td className="py-2 pr-4">{new Date(appt.appointment_date).toLocaleString()}</td>
            <td className="py-2 pr-4">
              <select
                value={appt.status}
                onChange={(e) => updateStatus(appt.id, e.target.value)}
                className="rounded border border-gray-300 p-1"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}