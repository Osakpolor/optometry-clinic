import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PatientNotes from '@/components/PatientNotes'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, appointment_date, service_type, status')
    .eq('patient_id', id)
    .order('appointment_date', { ascending: false })

  const { data: visits } = await supabase
    .from('visit_records')
    .select('id, visit_date, reason_for_visit, diagnosis, staff_profiles(full_name)')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })

  if (patientError || !patient) {
    return <main className="mx-auto max-w-2xl p-10"><p className="text-red-600">Patient not found.</p></main>
  }

  return (
    <main className="mx-auto max-w-2xl p-10">
      <Link href="/dashboard/patients" className="text-sm text-gray-400 hover:underline">← All patients</Link>

      <h1 className="mt-4 text-2xl font-semibold">{patient.full_name}</h1>
      <div className="mt-1 flex gap-4 text-sm text-gray-500">
        {patient.legacy_id && <span>Patient #{patient.legacy_id}</span>}
        {patient.sex && <span>{patient.sex}</span>}
        {patient.date_of_birth && <span>DOB: {patient.date_of_birth}</span>}
        {patient.phone && <span>{patient.phone}</span>}
        {patient.phone2 && <span>{patient.phone2}</span>}
      </div>
      {patient.address && <p className="mt-1 text-sm text-gray-500">{patient.address}</p>}

      <h2 className="mt-8 text-lg font-medium">Visit history</h2>
      {visits?.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {visits.map((v: any) => (
            <li key={v.id}>
              <Link
                href={`/dashboard/patients/${id}/visits/${v.id}`}
                className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-blue-600">
                  {new Date(v.visit_date).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </span>
                <span className="text-gray-500">
                  {v.reason_for_visit ?? v.diagnosis ?? 'Visit record'} · {v.staff_profiles?.full_name ?? 'Staff'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No visit records yet.</p>
      )}

      <div className="mt-4">
        <Link href={`/dashboard/patients/${id}/visits/new`} className="inline-block rounded bg-black px-4 py-2 text-sm text-white">
          + Record new visit
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-medium">Appointments</h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {appointments?.length ? appointments.map((a) => (
          <li key={a.id} className="border-b border-gray-100 py-2">
            {new Date(a.appointment_date).toLocaleString()} — {a.service_type} ({a.status})
          </li>
        )) : <li className="text-gray-500">No appointments yet.</li>}
      </ul>

      <PatientNotes patientId={patient.id} initialNotes={patient.notes} />
    </main>
  )
}