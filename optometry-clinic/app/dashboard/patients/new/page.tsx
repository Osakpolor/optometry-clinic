import { createClient } from '@/lib/supabase/server'
import RegisterPatientForm from '@/components/RegisterPatientForm'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NewPatientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get the next suggested file number based on the highest
  // existing file_number in the patients table.
  const { data: nextFileNumber } = await supabase.rpc('next_file_number')

  return (
    <main className="max-w-3xl mx-auto">
      <Link
        href="/dashboard/patients"
        className="text-muted-foreground hover:underline text-sm"
      >
        ← All patients
      </Link>
      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Register new patient</h1>
        <p className="mt-1 text-muted-foreground">
          Fill in the patient details below. File number is pre-filled with the
          next available number but can be changed.
        </p>
      </div>
      <RegisterPatientForm nextFileNumber={nextFileNumber ?? 1} />
    </main>
  )
}
