import { createClient } from '@/lib/supabase/server'
import PatientsTable from '@/components/PatientsTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function PatientsPage() {
  const supabase = await createClient()

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, sex, legacy_id, created_at')
    .order('legacy_id', { ascending: true, nullsFirst: false })

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Patients</h1>
          <p className="mt-1 text-muted-foreground">
            Search for a returning patient or register a new one — {patients?.length ?? 0} records total.
          </p>
        </div>
        <Link href="/dashboard/patients/new">
          <Button>+ Register patient</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">All patients</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {error && <p className="text-sm text-red-500">Error: {error.message}</p>}
          {!error && <PatientsTable patients={patients ?? []} />}
        </CardContent>
      </Card>
    </main>
  )
}