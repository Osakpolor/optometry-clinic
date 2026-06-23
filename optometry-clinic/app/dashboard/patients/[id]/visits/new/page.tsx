import { createClient } from '@/lib/supabase/server'
import NewVisitForm from '@/components/NewVisitForm'
import { redirect } from 'next/navigation'

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patient } = await supabase.from('patients').select('full_name').eq('id', id).single()

  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold">New visit — {patient?.full_name}</h1>
      <NewVisitForm patientId={id} doctorId={user.id} />
    </main>
  )
}