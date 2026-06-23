import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-4 border-b border-gray-100 py-2 text-sm">
      <span className="w-48 shrink-0 font-medium text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string; visitId: string }> }) {
  const { id, visitId } = await params
  const supabase = await createClient()

  const { data: visit, error } = await supabase
    .from('visit_records')
    .select('*, staff_profiles(full_name)')
    .eq('id', visitId)
    .single()

  const { data: patient } = await supabase.from('patients').select('full_name, legacy_id').eq('id', id).single()
  
  const { data: auditEntries } = await supabase
  .from('audit_log')
  .select('action, created_at, staff_profiles(full_name)')
  .eq('record_id', visitId)
  .order('created_at', { ascending: true })
  
  if (error || !visit) {
    return <main className="mx-auto max-w-2xl p-10"><p className="text-red-600">Visit not found.</p></main>
  }

  const e = visit.eye_test_results ?? {}
  const r = visit.refraction ?? {}
  const ant = visit.anterior_segment ?? {}
  const post = visit.posterior_segment ?? {}
  const meds: any[] = visit.medications ?? []

  return (
    <main className="mx-auto max-w-2xl p-10">
      <Link href={`/dashboard/patients/${id}`} className="text-sm text-gray-400 hover:underline">
        ← {patient?.full_name ?? 'Patient'}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">
        Visit — {new Date(visit.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Seen by {(visit as any).staff_profiles?.full_name ?? 'Unknown'} · Patient #{patient?.legacy_id ?? '—'}
      </p>
      <Link
        href={`/dashboard/patients/${id}/visits/${visitId}/edit`}
        className="mt-3 inline-block rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50"
        >
        Edit this visit
      </Link>

      <Section title="Presenting complaint">
        <Row label="Reason for visit" value={visit.reason_for_visit} />
        <Row label="Symptoms" value={visit.symptoms_presented} />
        <Row label="Last eye exam" value={visit.last_eye_exam} />
        <Row label="Age at visit" value={visit.age_at_visit} />
        <Row label="Blood pressure" value={visit.bp} />
      </Section>

      <Section title="Visual acuity">
        <Row label="VA Far OD (right)" value={e.va_far_od} />
        <Row label="VA Far OS (left)" value={e.va_far_os} />
        <Row label="VA Near OD" value={e.va_near_od} />
        <Row label="VA Near OS" value={e.va_near_os} />
        <Row label="Pinhole OD" value={e.va_pinhole_od} />
        <Row label="Pinhole OS" value={e.va_pinhole_os} />
        <Row label="VA Far OD Add" value={e.va_far_od_add} />
        <Row label="VA Far OS Add" value={e.va_far_os_add} />
        <Row label="IOP OD (mmHg)" value={e.iop_od} />
        <Row label="IOP OS (mmHg)" value={e.iop_os} />
        <Row label="Chart used" value={e.va_chart} />
        <Row label="VA type" value={e.va_type} />
      </Section>

      <Section title="Refraction">
        <Row label="Sph Prx OD" value={r.sph_prx_od} />
        <Row label="Cyl Prx OD" value={r.cyl_prx_od} />
        <Row label="Axis Prx OD" value={r.axis_prx_od} />
        <Row label="Sph Prx OS" value={r.sph_prx_os} />
        <Row label="Cyl Prx OS" value={r.cyl_prx_os} />
        <Row label="Axis Prx OS" value={r.axis_prx_os} />
        <Row label="Sph Final OD" value={r.sph_final_od} />
        <Row label="Cyl Final OD" value={r.cyl_final_od} />
        <Row label="Axis Final OD" value={r.axis_final_od} />
        <Row label="Sph Final OS" value={r.sph_final_os} />
        <Row label="Cyl Final OS" value={r.cyl_final_os} />
        <Row label="Axis Final OS" value={r.axis_final_os} />
        <Row label="Add Prx OD" value={r.add_prx_od} />
        <Row label="Add Prx OS" value={r.add_prx_os} />
        <Row label="Add Final OD" value={r.add_final_od} />
        <Row label="Add Final OS" value={r.add_final_os} />
      </Section>

      <Section title="Anterior segment">
        <Row label="Lid OD" value={ant.lid_od} />
        <Row label="Conjunctiva OD" value={ant.conjunctiva_od} />
        <Row label="Cornea OD" value={ant.cornea_od} />
        <Row label="Iris OD" value={ant.iris_od} />
        <Row label="Pupil OD" value={ant.pupil_od} />
        <Row label="Lens OD" value={ant.lens_od} />
        <Row label="Lid OS" value={ant.lid_os} />
        <Row label="Conjunctiva OS" value={ant.conjunctiva_os} />
        <Row label="Cornea OS" value={ant.cornea_os} />
        <Row label="Iris OS" value={ant.iris_os} />
        <Row label="Pupil OS" value={ant.pupil_os} />
        <Row label="Lens OS" value={ant.lens_os} />
      </Section>

      <Section title="Posterior segment">
        <Row label="Disc OD" value={post.disc_od} />
        <Row label="Disc OS" value={post.disc_os} />
        <Row label="Cup OD" value={post.cup_od} />
        <Row label="Cup OS" value={post.cup_os} />
        <Row label="Macula OD" value={post.macula_od} />
        <Row label="Macula OS" value={post.macula_os} />
      </Section>

      <Section title="Diagnosis & management">
        <Row label="Diagnosis" value={visit.diagnosis} />
        <Row label="Referral" value={visit.referral} />
        <Row label="Ref test" value={visit.ref_test} />
        <Row label="Ref date" value={visit.ref_date} />
      </Section>

      {meds.length > 0 && (
        <Section title="Medications">
          {meds.map((m, i) => (
            <div key={i} className="flex gap-4 border-b border-gray-100 py-2 text-sm">
              <span className="w-48 shrink-0 font-medium text-gray-500">{m.type ?? 'Drug'} {i + 1}</span>
              <span>{[m.name, m.freq].filter(Boolean).join(' — ')}</span>
            </div>
          ))}
        </Section>
      )}

      {visit.notes && (
        <Section title="Notes">
          <p className="text-sm">{visit.notes}</p>
        </Section>
      )}

      <div className="mt-8">
        <Link href={`/dashboard/patients/${id}/visits/new`} className="inline-block rounded bg-black px-4 py-2 text-sm text-white">
          + Record another visit
        </Link>
      </div>
      {auditEntries && auditEntries.length > 0 && (
  <div className="mt-12 border-t border-gray-100 pt-4">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-300">Record history</p>
    <ul className="mt-2 flex flex-col gap-1">
      {auditEntries.map((entry: any, i: number) => (
        <li key={i} className="text-xs text-gray-400">
          {entry.action === 'INSERT' ? 'Created' : 'Edited'} by{' '}
          <span className="text-gray-500">{entry.staff_profiles?.full_name ?? 'Unknown'}</span>
          {' · '}
          {new Date(entry.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}
          {' at '}
          {new Date(entry.created_at).toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit'
          })}
        </li>
      ))}
    </ul>
  </div>
)}
    </main>
  )
}
