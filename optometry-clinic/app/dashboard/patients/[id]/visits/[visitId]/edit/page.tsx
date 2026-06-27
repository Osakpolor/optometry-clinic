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
    return (
      <main className="w-full py-2">
        <p className="text-red-600">Visit not found.</p>
      </main>
    )
  }

  return (
    <main className="w-full py-2">
      <Link
        href={`/dashboard/patients/${id}/visits/${visitId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        ← Back to visit
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        Edit visit — {patient?.full_name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {new Date(visit.visit_date).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })}
      </p>
      <EditVisitForm patientId={id} visitId={visitId} visit={visit} />
    </main>
  )
}