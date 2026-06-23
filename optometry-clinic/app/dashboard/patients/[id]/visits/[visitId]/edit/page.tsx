import { createClient } from '@/lib/supabase/server'
import EditVisitForm from '@/components/EditVisitForm'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function EditVisitPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: visit, error } = await supabase
    .from('visit_records')
    .select('*')
    .eq('id', visitId)
    .single()

  const { data: patient } = await supabase
    .from('patients')
    .select('full_name')
    .eq('id', id)
    .single()

  if (error || !visit) {
    return <main className="mx-auto max-w-2xl p-10"><p className="text-red-600">Visit not found.</p></main>
  }

  return (
    <main className="mx-auto max-w-2xl p-10">
      <Link href={`/dashboard/patients/${id}/visits/${visitId}`} className="text-sm text-gray-400 hover:underline">
        ← Back to visit
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Edit visit — {patient?.full_name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {new Date(visit.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <EditVisitForm patientId={id} visitId={visitId} visit={visit} />
    </main>
  )
}