// app/dashboard/patients/[id]/page.tsx

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PatientNotes from '@/components/PatientNotes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { EditPatientDialog } from '@/components/patients/EditPatientDialog'
import { DeletePatientButton } from '@/components/patients/DeletePatientButton'
import PatientDocuments from '@/components/PatientDocuments'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Get the logged-in user's role so we can pass it to EditPatientDialog.
  // The dialog uses this to decide whether to show the file_number field.
  // We fetch it server-side so the client never decides its own permissions.
  const { data: { user } } = await supabase.auth.getUser()

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const userRole = staffProfile?.role ?? null

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
      <main className="w-full py-2">
        <p className="text-red-500 text-sm">Patient not found.</p>
      </main>
    )
  }

  // Show file_number if set, otherwise fall back to legacy_id, otherwise nothing
  const patientRef = patient.file_number
    ? `#${patient.file_number}`
    : patient.legacy_id
    ? `#${patient.legacy_id}`
    : null

  const statusColors: Record<string, string> = {
    booked:    'bg-blue-50 text-blue-700 border-blue-200',
    confirmed: 'bg-green-50 text-green-700 border-green-200',
    completed: 'bg-gray-50 text-gray-600 border-gray-200',
    no_show:   'bg-red-50 text-red-600 border-red-200',
    cancelled: 'bg-red-50 text-red-400 border-red-100',
  }

  return (
    <main className="w-full py-2">
      <Link
        href="/dashboard/patients"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All patients
      </Link>

      {/* Patient header */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {patient.full_name}
          </h1>

          <div className="mt-2 flex flex-wrap gap-2 sm:gap-3">
            {/* File number badge — shown for all staff, label reflects source */}
            {patientRef && (
              <Badge variant="outline" className="text-xs font-medium">
                Patient {patientRef}
              </Badge>
            )}
            {/* Flag patients with no file number so admins know to assign one */}
            {!patient.file_number && !patient.legacy_id && (
              <Badge
                variant="outline"
                className="text-xs text-amber-700 border-amber-300 bg-amber-50"
              >
                No file number
              </Badge>
            )}
            {patient.sex && (
              <Badge variant="outline" className="text-xs">
                {patient.sex}
              </Badge>
            )}
            {patient.date_of_birth && (
              <span className="text-sm text-muted-foreground">
                DOB: {patient.date_of_birth}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-0.5">
            {patient.phone && (
              <span className="text-sm text-muted-foreground">{patient.phone}</span>
            )}
            {patient.phone2 && (
              <span className="text-sm text-muted-foreground">{patient.phone2}</span>
            )}
            {patient.address && (
              <span className="text-sm text-muted-foreground">{patient.address}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <EditPatientDialog
            patient={{
              id:            patient.id,
              full_name:     patient.full_name     ?? '',
              phone:         patient.phone         ?? '',
              phone2:        patient.phone2        ?? '',
              address:       patient.address       ?? '',
              date_of_birth: patient.date_of_birth ?? '',
              sex:           patient.sex           ?? '',
              file_number:   patient.file_number   ?? '',
            }}
            userRole={userRole}
          />
          {/* Delete button — admin only, soft delete */}
          {userRole === 'admin' && (
            <DeletePatientButton
              patientId={patient.id}
              patientName={patient.full_name ?? ''}
            />
          )}
          <Link href={`/dashboard/patients/${id}/visits/new`}>
            <Button size="sm">+ New visit</Button>
          </Link>
        </div>
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
                      className="group flex items-center justify-between rounded-lg border
                                 border-border px-4 py-3 hover:border-brand/30 hover:bg-brand/5
                                 transition-all duration-150"
                    >
                      <span className="text-sm font-medium text-text-primary
                                       group-hover:text-brand transition-colors">
                        {new Date(v.visit_date).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {v.reason_for_visit ?? v.diagnosis ?? 'Visit record'}
                        {' · '}
                        {v.staff_profiles?.full_name ?? 'Staff'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No visit records yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-medium">Appointments</CardTitle>
            <Link href={`/dashboard/patients/${id}/appointments/new`}>
              <Button variant="outline" size="sm">+ Book slot</Button>
            </Link>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {appointments?.length ? (
              <ul className="flex flex-col divide-y">
                {appointments.map(a => (
                  <li key={a.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">
                      {new Date(a.appointment_date).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {' — '}
                      {a.service_type}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusColors[a.status] ?? ''}`}
                    >
                      {a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No appointments yet.
              </p>
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

        {/* Legacy documents from patient-documents storage bucket */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Legacy records</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Original Word docs and PDFs from the clinic's physical file.
              Click Open to view or download.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <PatientDocuments patientId={patient.id} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
