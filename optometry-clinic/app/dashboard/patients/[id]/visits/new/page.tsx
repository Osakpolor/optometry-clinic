// app/dashboard/patients/[id]/visits/new/page.tsx

import { createClient } from '@/lib/supabase/server'
import NewVisitForm from '@/components/NewVisitForm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserRole, canManageVisits } from '@/lib/auth/roles'

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userRole = await getUserRole()
  if (!canManageVisits(userRole)) redirect(`/dashboard/patients/${id}`)

  const { data: patient } = await supabase
    .from('patients')
    .select('full_name, file_number, legacy_id')
    .eq('id', id)
    .single()

  const fileNumber = patient?.file_number ?? patient?.legacy_id?.toString() ?? null

  return (
    <main className="w-full py-2">
      <Link
        href={`/dashboard/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        ← Back to {patient?.full_name}
      </Link>

      {/* Page header — file number above, bold name as primary heading */}
      {fileNumber && (
        <h3 className="text-lg font-semibold text-brand mb-1">
          File #{fileNumber}
        </h3>
      )}
      <h1 className="text-2xl font-semibold mb-6">
        New visit — {patient?.full_name}
      </h1>

      <NewVisitForm patientId={id} doctorId={user.id} />
    </main>
  )
}
