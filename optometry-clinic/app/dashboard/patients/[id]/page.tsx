import { createClient } from '@/lib/supabase/server'
import PatientNotes from '@/components/PatientNotes'

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

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

  if (patientError || !patient) {
    return <main className="mx-auto max-w-2xl p-10"><p className="text-red-600">Patient not found.</p></main>
  }

  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold">{patient.full_name}</h1>
      <p className="mt-1 text-gray-600">{patient.phone}{patient.email ? ` · ${patient.email}` : ''}</p>

      <h2 className="mt-8 text-lg font-medium">Appointment history</h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {appointments?.length ? (
          appointments.map((a) => (
            <li key={a.id} className="border-b border-gray-100 py-2">
              {new Date(a.appointment_date).toLocaleString()} — {a.service_type} ({a.status})
            </li>
          ))
        ) : (
          <li className="text-gray-500">No appointments yet.</li>
        )}
      </ul>

      <PatientNotes patientId={patient.id} initialNotes={patient.notes} />
    </main>
  )
}