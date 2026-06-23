import { createClient } from '@/lib/supabase/server'
import PatientsTable from '@/components/PatientsTable'

export default async function PatientsPage() {
  const supabase = await createClient()

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, sex, legacy_id, created_at')
    .order('legacy_id', { ascending: true, nullsFirst: false })

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <span className="text-sm text-gray-500">{patients?.length ?? 0} total</span>
      </div>
      {error && <p className="mt-4 text-red-600">Error: {error.message}</p>}
      {!error && <PatientsTable patients={patients ?? []} />}
    </main>
  )
}