import { createClient } from '@/lib/supabase/server'
import RegisterPatientForm from '@/components/RegisterPatientForm'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NewPatientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.rpc('next_patient_id')
  const nextId = data ?? 197

  return (
    <main className="max-w-3xl mx-auto">
      <Link href="/dashboard/patients" className="text-muted-foreground hover:underline text-sm">
        ← All patients
      </Link>
      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Register new patient</h1>
        <p className="mt-1 text-muted-foreground">Patient will be assigned ID <span className="font-semibold text-foreground">#{nextId}</span></p>
      </div>
      <RegisterPatientForm nextId={nextId} />
    </main>
  )
}