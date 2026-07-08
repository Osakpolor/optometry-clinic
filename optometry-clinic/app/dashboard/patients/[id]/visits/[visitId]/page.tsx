import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import VisitDocuments from '@/components/visits/VisitDocuments'
import ExportPrescriptionPDF from '@/components/visits/ExportPrescriptionPDF'

// ---------------------------------------------------------------------------
// Shared layout primitives
// ---------------------------------------------------------------------------

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 text-sm
                    border-b border-gray-50 last:border-0">
      <span className="w-full sm:w-44 shrink-0 text-muted-foreground text-xs
                       sm:text-sm mb-0.5 sm:mb-0">
        {label}
      </span>
      <span className="font-medium break-words">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

// OD/OS grid row used by structured (new) visits
function EyeRow({ label, od, os }: { label: string; od?: string; os?: string }) {
  if (!od && !os) return null
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-center font-medium text-pink-700">{od || '—'}</span>
      <span className="text-center font-medium text-green-700">{os || '—'}</span>
    </div>
  )
}

// Column headers for the OD/OS grid
function EyeGridHeader({ left = 'OD (Right)', right = 'OS (Left)' }: { left?: string; right?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
      <span />
      <span className="font-semibold text-pink-500 text-center">{left}</span>
      <span className="font-semibold text-green-600 text-center">{right}</span>
    </div>
  )
}

// Raw text block used by legacy imported visits — preserves line breaks,
// monospace font makes optical data (SPH/CYL/AXIS) easier to scan
function RawBlock({ text }: { text: string }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <pre className="text-xs sm:text-sm text-gray-700 whitespace-pre font-mono
                      leading-relaxed bg-gray-50 rounded p-3 min-w-max">
        {text}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Format detectors
// A visit is "legacy" (raw imported text) when the jsonb contains a "raw"
// key or raw clinical text keys (auto_refractor, tonometry, etc.) rather
// than structured per-field keys (sph_prx_od, va_far_od, lid_od, etc.)
// ---------------------------------------------------------------------------

function isLegacyEyeTest(e: Record<string, any>) {
  return Boolean(e.raw)
}

function isLegacyRefraction(r: Record<string, any>) {
  return Boolean(r.auto_refractor || r.retinoscopy || r.final_subjective_rx)
}

function isLegacyAnterior(ant: Record<string, any>) {
  return Boolean(ant.tonometry || ant.external_exam || ant.internal_exam)
}

// ---------------------------------------------------------------------------
// Section renderers — each handles both structured and legacy formats
// ---------------------------------------------------------------------------

function VisualAcuitySection({ e }: { e: Record<string, any> }) {
  if (isLegacyEyeTest(e)) {
    return (
      <Section title="Visual acuity">
        <RawBlock text={e.raw} />
      </Section>
    )
  }

  const rows: [string, string?, string?][] = [
    ['@Far', e.va_far_od, e.va_far_os],
    ['@Near', e.va_near_od, e.va_near_os],
    ['Pin hole', e.va_pinhole_od, e.va_pinhole_os],
    ['@Far (with Rx)', e.px_va_far_od, e.px_va_far_os],
    ['@Near (with Rx)', e.px_va_near_od, e.px_va_near_os],
    ['IOP', e.iop_od, e.iop_os],
  ].filter(([, a, b]) => a || b) as [string, string?, string?][]

  if (rows.length === 0) return null

  return (
    <Section title="Visual acuity">
      <EyeGridHeader />
      {rows.map(([label, od, os]) => (
        <EyeRow key={label} label={label} od={od} os={os} />
      ))}
      {(e.va_chart || e.va_type) && (
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          {e.va_type && <span>Type: {e.va_type}</span>}
          {e.va_chart && <span>Chart: {e.va_chart}</span>}
        </div>
      )}
    </Section>
  )
}

function RefractionSection({ r }: { r: Record<string, any> }) {
  if (isLegacyRefraction(r)) {
    return (
      <Section title="Refraction">
        {r.auto_refractor && <Row label="Auto refractor" value={r.auto_refractor} />}
        {r.retinoscopy && <Row label="Retinoscopy" value={r.retinoscopy} />}
        {r.final_subjective_rx && <Row label="Final subjective Rx" value={r.final_subjective_rx} />}
      </Section>
    )
  }

  const rows: [string, string?, string?][] = [
    ['Sph (subjective)', r.sph_prx_od, r.sph_prx_os],
    ['Cyl (subjective)', r.cyl_prx_od, r.cyl_prx_os],
    ['Axis (subjective)', r.axis_prx_od, r.axis_prx_os],
    ['Add (subjective)', r.add_prx_od, r.add_prx_os],
    ['Sph (auto)', r.sph_auto_od, r.sph_auto_os],
    ['Cyl (auto)', r.cyl_auto_od, r.cyl_auto_os],
    ['Axis (auto)', r.axis_auto_od, r.axis_auto_os],
    ['Sph (ret)', r.sph_ret_od, r.sph_ret_os],
    ['Cyl (ret)', r.cyl_ret_od, r.cyl_ret_os],
    ['Axis (ret)', r.axis_ret_od, r.axis_ret_os],
    ['Sph (final)', r.sph_final_od, r.sph_final_os],
    ['Cyl (final)', r.cyl_final_od, r.cyl_final_os],
    ['Axis (final)', r.axis_final_od, r.axis_final_os],
    ['Add (final)', r.add_final_od, r.add_final_os],
  ].filter(([, a, b]) => a || b) as [string, string?, string?][]

  if (rows.length === 0) return null

  return (
    <Section title="Refraction">
      <EyeGridHeader left="OD" right="OS" />
      {rows.map(([label, od, os]) => (
        <EyeRow key={label} label={label} od={od} os={os} />
      ))}
    </Section>
  )
}

function AnteriorSection({ ant }: { ant: Record<string, any> }) {
  if (isLegacyAnterior(ant)) {
    return (
      <Section title="External exam (anterior segment)">
        {ant.tonometry && <Row label="Tonometry (IOP)" value={ant.tonometry} />}
        {ant.external_exam && <Row label="External exam" value={ant.external_exam} />}
        {ant.internal_exam && <Row label="Internal exam" value={ant.internal_exam} />}
      </Section>
    )
  }

  const rows: [string, string?, string?][] = [
    ['Lid', ant.lid_od, ant.lid_os],
    ['Conjunctiva', ant.conjunctiva_od, ant.conjunctiva_os],
    ['Cornea', ant.cornea_od, ant.cornea_os],
    ['Iris', ant.iris_od, ant.iris_os],
    ['Pupil', ant.pupil_od, ant.pupil_os],
    ['Lens', ant.lens_od, ant.lens_os],
  ].filter(([, a, b]) => a || b) as [string, string?, string?][]

  if (rows.length === 0) return null

  return (
    <Section title="External exam (anterior segment)">
      <EyeGridHeader left="OD" right="OS" />
      {rows.map(([label, od, os]) => (
        <EyeRow key={label} label={label} od={od} os={os} />
      ))}
    </Section>
  )
}

function PosteriorSection({ post }: { post: Record<string, any> }) {
  // Posterior segment is only ever used by structured (new) visits —
  // legacy imports didn't have a separate posterior field.
  const rows: [string, string?, string?][] = [
    ['Disc', post.disc_od, post.disc_os],
    ['Cupping', post.cup_od, post.cup_os],
    ['Macula', post.macula_od, post.macula_os],
  ].filter(([, a, b]) => a || b) as [string, string?, string?][]

  if (rows.length === 0) return null

  return (
    <Section title="Ophthalmoscopy (posterior segment)">
      <EyeGridHeader left="OD" right="OS" />
      {rows.map(([label, od, os]) => (
        <EyeRow key={label} label={label} od={od} os={os} />
      ))}
    </Section>
  )
}

function MedicationsSection({ meds }: { meds: any[] }) {
  if (meds.length === 0) return null

  // Legacy imported visits store drugs as [{ raw: "Gutt catacure I x bd..." }]
  // New visits use [{ type, name, freq }]
  const isLegacy = meds.some(m => m.raw && !m.name)

  if (isLegacy) {
    return (
      <Section title="Drug prescription">
        {meds.map((m, i) => (
          <div key={i} className="py-2 text-sm border-b border-gray-50 last:border-0">
            <span className="font-medium whitespace-pre-wrap">{m.raw}</span>
          </div>
        ))}
      </Section>
    )
  }

  const activeMeds = meds.filter(m => m.name || m.type)
  if (activeMeds.length === 0) return null

  return (
    <Section title="Drug prescription">
      <div className="flex flex-col gap-2">
        {activeMeds.map((m, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {m.type && <Badge variant="outline" className="text-xs">{m.type}</Badge>}
            <span className="font-medium">{m.name}</span>
            {m.freq && <span className="text-muted-foreground">× {m.freq}</span>}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string; visitId: string }>
}) {
  const { id, visitId } = await params
  const supabase = await createClient()

  const { data: visit, error } = await supabase
    .from('visit_records')
    .select(`
      *,
      doctor:staff_profiles!visit_records_doctor_id_fkey(full_name),
      editor:staff_profiles!visit_records_updated_by_fkey(full_name)
    `)
    .eq('id', visitId)
    .single()

  const { data: patient } = await supabase
    .from('patients')
    .select('full_name, file_number, legacy_id')
    .eq('id', id)
    .single()

  const { data: auditEntries } = await supabase
    .from('audit_log')
    .select('action, created_at, staff_profiles(full_name)')
    .eq('record_id', visitId)
    .order('created_at', { ascending: true })

  if (error || !visit) {
    console.error('Visit query error:', error)
    return (
      <main className="w-full py-2">
        <p className="text-red-500 text-sm">Visit not found.</p>
        <pre className="text-xs text-gray-400 mt-2 whitespace-pre-wrap">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    )
  }

  const e: Record<string, any> = visit.eye_test_results ?? {}
  const r: Record<string, any> = visit.refraction ?? {}
  const ant: Record<string, any> = visit.anterior_segment ?? {}
  const post: Record<string, any> = visit.posterior_segment ?? {}
  const meds: any[] = visit.medications ?? []

  // Display file_number if available, otherwise fall back to legacy_id
  const patientRef = patient?.file_number
    ? `#${patient.file_number}`
    : patient?.legacy_id
    ? `#${patient.legacy_id}`
    : '—'

  return (
    <main className="w-full py-2">
      <Link
        href={`/dashboard/patients/${id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {patient?.full_name ?? 'Patient'}
      </Link>

      {/* Visit header */}
      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {new Date(visit.visit_date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h1>
         <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Patient {patientRef}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {(visit as any).doctor?.full_name
                ? `Seen by ${(visit as any).doctor.full_name}`
                : 'Imported record'}
            </span>
            {(visit as any).editor?.full_name && (
              <span className="text-sm text-muted-foreground">
                · Last edited by {(visit as any).editor.full_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportPrescriptionPDF
            patient={{
              full_name: patient?.full_name ?? 'Patient',
              legacy_id: patient?.legacy_id,
            }}
            visit={visit}
          />
          <Link href={`/dashboard/patients/${id}/visits/${visitId}/edit`}>
            <Button variant="outline" size="sm">
              Edit visit
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Presenting complaint */}
        <Section title="Presenting complaint">
          <Row label="Reason for visit" value={visit.reason_for_visit} />
          <Row label="Symptoms" value={visit.symptoms_presented} />
          <Row label="Last eye exam" value={visit.last_eye_exam} />
          <Row label="Age at visit" value={visit.age_at_visit} />
          <Row label="Blood pressure" value={visit.bp} />
        </Section>

        {/* Visual acuity — handles both structured and legacy raw formats */}
        <VisualAcuitySection e={e} />

        {/* Refraction — handles both structured and legacy raw formats */}
        <RefractionSection r={r} />

        {/* Anterior segment — handles both structured and legacy raw formats */}
        <AnteriorSection ant={ant} />

        {/* Posterior segment — structured only (legacy imports didn't have this) */}
        <PosteriorSection post={post} />

        {/* Diagnosis */}
        {(visit.diagnosis || visit.referral) && (
          <Section title="Diagnosis & management">
            <Row label="Diagnosis" value={visit.diagnosis} />
            <Row label="Referral" value={visit.referral} />
            <Row label="Ref test" value={visit.ref_test} />
            <Row label="Ref date" value={visit.ref_date} />
          </Section>
        )}

        {/* Medications — handles both structured and legacy raw formats */}
        <MedicationsSection meds={meds} />

        {/* Notes */}
        {visit.notes && (
          <Section title="Notes">
            <p className="text-sm text-gray-700">{visit.notes}</p>
          </Section>
        )}

        {/* Record history */}
        {auditEntries && auditEntries.length > 0 && (
          <div className="mt-2 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-300">
              Record history
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {auditEntries.map((entry: any, i: number) => (
                <li key={i} className="text-xs text-gray-400">
                  {entry.action === 'INSERT' ? 'Created' : 'Edited'} by{' '}
                  <span className="text-gray-500">
                    {entry.staff_profiles?.full_name ?? 'Unknown'}
                  </span>
                  {' · '}
                  {new Date(entry.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {' at '}
                  {new Date(entry.created_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Documents */}
        <div className="mt-2">
          <div className="rounded-lg border border-border bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
              <span className="text-xs text-muted-foreground">
                Scans, referral letters, PDFs
              </span>
            </div>
            <VisitDocuments visitId={visitId} patientId={id} />
          </div>
        </div>

        <div className="mt-2">
          <Link href={`/dashboard/patients/${id}/visits/new`}>
            <Button variant="outline" className="w-full">
              + Record another visit
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
