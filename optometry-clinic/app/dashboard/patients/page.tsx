import { createClient } from '@/lib/supabase/server'
import PatientsTable from '@/components/PatientsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function PatientsPage() {
  const supabase = await createClient()

  // Use RPC so Postgres sorts file numbers numerically (2, 3 ... 9, 10, 11)
  // rather than alphabetically (10, 11, 2, 3). The function also returns
  // all rows with no 1000-row cap.
  const { data: patients, error } = await supabase
  .rpc('get_patients_sorted')
  .limit(2000)

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
            {patients?.length ?? 0} records total — search or register a new patient.
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
          {error && <p className="text-sm text-red-500">Error: {error.message}</p>}
          {!error && <PatientsTable patients={patients ?? []} />}
        </CardContent>
      </Card>

    </main>
  )
}
