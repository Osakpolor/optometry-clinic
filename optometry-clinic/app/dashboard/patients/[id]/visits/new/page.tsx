import { createClient } from '@/lib/supabase/server'
import NewVisitForm from '@/components/NewVisitForm'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patient } = await supabase.from('patients').select('full_name').eq('id', id).single()

  return (
    <main className="w-full py-2">

      {/* Back navigation */}
      <Link
        href={`/dashboard/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        ← Back to {patient?.full_name}
      </Link>

      <h1 className="text-2xl font-semibold mb-6">
        New visit — {patient?.full_name}
      </h1>

      <NewVisitForm patientId={id} doctorId={user.id} />
    </main>
  )
}