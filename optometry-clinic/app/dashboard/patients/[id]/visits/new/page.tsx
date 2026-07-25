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
    .select('full_name, file_number, legacy_id, date_of_birth, age, created_at')
    .eq('id', id)
    .single()

  const fileNumber = patient?.file_number ?? patient?.legacy_id?.toString() ?? null

  // Most recent prior visit (for the age-maths fallback when no DOB)
  const { data: lastVisit } = await supabase
    .from('visit_records')
    .select('visit_date, age_at_visit')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Hybrid age resolution for the New Visit "Age" field ──
  // Priority:
  //   1. DOB present            → calculate live age (always accurate)
  //   2. No DOB, prior visit    → that visit's age + whole years elapsed
  //   3. No DOB, no prior visit → registration age, only if registered
  //                               within the last year; else blank
  //   4. Nothing reliable       → blank (receptionist/doctor fills in)
  function wholeYearsBetween(fromISO: string, to: Date): number {
    const from = new Date(fromISO)
    let y = to.getFullYear() - from.getFullYear()
    const m = to.getMonth() - from.getMonth()
    if (m < 0 || (m === 0 && to.getDate() < from.getDate())) y--
    return y
  }

  function resolveInitialAge(): string {
    const now = new Date()

    // 1. DOB → live age
    if (patient?.date_of_birth) {
      const birth = new Date(patient.date_of_birth)
      if (!isNaN(birth.getTime())) {
        const a = wholeYearsBetween(patient.date_of_birth, now)
        if (a >= 0 && a < 150) return String(a)
      }
    }

    // 2. No DOB, but a prior visit with a recorded age → do the maths
    const prevAge = lastVisit?.age_at_visit
    const prevAgeNum = prevAge != null ? parseInt(String(prevAge), 10) : NaN
    if (lastVisit?.visit_date && Number.isFinite(prevAgeNum)) {
      const elapsed = wholeYearsBetween(lastVisit.visit_date, now)
      const est = prevAgeNum + Math.max(0, elapsed)
      if (est >= 0 && est < 150) return String(est)
    }

    // 3. No DOB, no prior visit → registration age if recent (< 1 year)
    const regAge = patient?.age
    if (regAge != null && patient?.created_at) {
      const elapsed = wholeYearsBetween(patient.created_at, now)
      if (elapsed < 1) return String(regAge)
    }

    // 4. Nothing reliable
    return ''
  }

  const initialAge = resolveInitialAge()

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

      <NewVisitForm patientId={id} doctorId={user.id} initialAge={initialAge} />
    </main>
  )
}
