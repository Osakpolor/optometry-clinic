import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PatientNotes from '@/components/PatientNotes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

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
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-red-500 text-sm">Patient not found.</p>
      </main>
    )
  }

  const statusColors: Record<string, string> = {
    booked: 'bg-blue-50 text-blue-700 border-blue-200',
    confirmed: 'bg-green-50 text-green-700 border-green-200',
    completed: 'bg-gray-50 text-gray-600 border-gray-200',
    no_show: 'bg-red-50 text-red-600 border-red-200',
    cancelled: 'bg-red-50 text-red-400 border-red-100',
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/dashboard/patients" className="text-sm text-muted-foreground hover:underline">
        ← All patients
      </Link>

      {/* Patient header */}
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{patient.full_name}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {patient.legacy_id && <span>Patient #{patient.legacy_id}</span>}
            {patient.sex && <span>{patient.sex}</span>}
            {patient.date_of_birth && <span>DOB: {patient.date_of_birth}</span>}
            {patient.phone && <span>{patient.phone}</span>}
            {patient.phone2 && <span>{patient.phone2}</span>}
          </div>
          {patient.address && <p className="mt-1 text-sm text-muted-foreground">{patient.address}</p>}
        </div>
        <Link href={`/dashboard/patients/${id}/visits/new`}>
          <Button size="sm">+ New visit</Button>
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {/* Visit history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Visit history</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {visits?.length ? (
              <ul className="flex flex-col gap-2">
                {visits.map((v: any) => (
                  <li key={v.id}>
                    <Link
                      href={`/dashboard/patients/${id}/visits/${v.id}`}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-blue-600">
                        {new Date(v.visit_date).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {v.reason_for_visit ?? v.diagnosis ?? 'Visit record'} · {v.staff_profiles?.full_name ?? 'Staff'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No visit records yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Appointments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Appointments</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {appointments?.length ? (
              <ul className="flex flex-col divide-y">
                {appointments.map(a => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">
                      {new Date(a.appointment_date).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })} — {a.service_type}
                    </span>
                    <Badge variant="outline" className={`text-xs ${statusColors[a.status] ?? ''}`}>
                      {a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No appointments yet.</p>
            )}
          </CardContent>
        </Card>

        {/* CRM notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">CRM notes</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <PatientNotes patientId={patient.id} initialNotes={patient.notes} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}