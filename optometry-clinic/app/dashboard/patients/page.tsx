import { createClient as createAdminClient } from '@supabase/supabase-js'
import PatientsTable from '@/components/PatientsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function PatientsPage() {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Use .range() to bypass PostgREST's default 1000-row cap.
  // The admin client (service role) skips RLS so all patients
  // are returned regardless of the requesting user's role.
  const { data: patients, error } = await adminClient
    .from('patients')
    .select('id, full_name, phone, sex, legacy_id, file_number, created_at')
    .is('deleted_at', null)
    .range(0, 4999)

  // Sort numerically client-side — PostgREST sorts file_number
  // as text so "1000" comes before "2". We fix that here.
  const sorted = (patients ?? []).sort((a, b) => {
    const an = a.file_number ? parseInt(a.file_number) : Infinity
    const bn = b.file_number ? parseInt(b.file_number) : Infinity
    if (isNaN(an) && isNaN(bn)) return (a.full_name ?? '').localeCompare(b.full_name ?? '')
    if (isNaN(an)) return 1
    if (isNaN(bn)) return -1
    return an - bn
  })

  return (
    <main className="w-full py-2">

      {/* Back navigation */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground
                   hover:text-foreground transition-colors mb-6"
      >
        ← Dashboard
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sorted.length} records total — search or register a new patient.
          </p>
        </div>
        <Link href="/dashboard/patients/new">
          <Button size="sm">+ Register patient</Button>
        </Link>
      </div>

      {/* Patients table card */}
      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            All patients
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="px-5 pt-4 pb-5">
          {error && (
            <p className="text-sm text-red-500">Error: {error.message}</p>
          )}
          {!error && <PatientsTable patients={sorted} />}
        </CardContent>
      </Card>

    </main>
  )
}
