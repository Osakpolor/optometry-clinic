'use client'

// components/visits/PastVisitsPanel.tsx
// A read-only slide-in drawer showing a patient's previous visits, so a
// doctor can reference past clinical detail WITHOUT leaving the visit form.
// Self-contained: it never touches the form's state, so it can't affect the
// unsaved-changes guard or autosave. Data is lazy-loaded on first open.

import { useState } from 'react'
import { getPatientVisits } from '@/app/actions/getPatientVisits'

// ── Small helpers for copy-to-clipboard ──
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {}
      }}
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
      title={label ? `Copy ${label}` : 'Copy'}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

// ── Pure render helpers (mirrors the visit detail page) ──
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Build a one-line summary shown on the collapsed row (final Rx if present)
function oneLineSummary(r: Record<string, any>): string | null {
  if (!r) return null
  const od = [r.sph_final_od, r.cyl_final_od && `/${r.cyl_final_od}`, r.axis_final_od && ` x${r.axis_final_od}`]
    .filter(Boolean).join('')
  const os = [r.sph_final_os, r.cyl_final_os && `/${r.cyl_final_os}`, r.axis_final_os && ` x${r.axis_final_os}`]
    .filter(Boolean).join('')
  if (od || os) return `Final Rx: OD ${od || '—'} / OS ${os || '—'}`
  return null
}

function EyeRow({ label, od, os }: { label: string; od?: string; os?: string }) {
  if (!od && !os) return null
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-50 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-center font-medium text-pink-700">{od || '—'}</span>
      <span className="text-center font-medium text-green-700">{os || '—'}</span>
    </div>
  )
}

function EyeGridHeader({ left = 'OD', right = 'OS' }: { left?: string; right?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-1.5">
      <span />
      <span className="font-semibold text-pink-500 text-center">{left}</span>
      <span className="font-semibold text-green-600 text-center">{right}</span>
    </div>
  )
}

function MiniSection({ title, children, copyText }: { title: string; children: React.ReactNode; copyText?: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {copyText && <CopyButton text={copyText} label={title} />}
      </div>
      <div className="rounded-lg border border-gray-100 p-2.5">{children}</div>
    </div>
  )
}

function eyeRows(defs: [string, any, any][]) {
  return defs.filter(([, a, b]) => a || b)
}

// Format one visit's refraction into copyable text
function refractionToText(r: Record<string, any>): string {
  const lines: string[] = []
  const push = (label: string, od?: string, os?: string) => {
    if (od || os) lines.push(`${label}: OD ${od || '—'} / OS ${os || '—'}`)
  }
  push('Final Sph', r.sph_final_od, r.sph_final_os)
  push('Final Cyl', r.cyl_final_od, r.cyl_final_os)
  push('Final Axis', r.axis_final_od, r.axis_final_os)
  push('Final Add', r.add_final_od, r.add_final_os)
  return lines.join('\n')
}

function medsToText(meds: any[]): string {
  return (meds ?? [])
    .filter(m => m.name || m.type || m.raw)
    .map(m => m.raw ?? [m.type, m.name, m.qty && `Qty:${m.qty}`, m.freq, m.duration].filter(Boolean).join(' '))
    .join('\n')
}

// ── Full clinical detail for one expanded visit ──
function VisitDetail({ v }: { v: any }) {
  const e = v.eye_test_results ?? {}
  const r = v.refraction ?? {}
  const ant = v.anterior_segment ?? {}
  const post = v.posterior_segment ?? {}
  const meds = v.medications ?? []

  const isLegacyEye = Boolean(e.raw)
  const isLegacyRef = Boolean(r.auto_refractor || r.retinoscopy || r.final_subjective_rx)

  const vaRows = eyeRows([
    ['@Far', e.va_far_od, e.va_far_os],
    ['@Near', e.va_near_od, e.va_near_os],
    ['Pin hole', e.va_pinhole_od, e.va_pinhole_os],
    ['@Far (Rx)', e.px_va_far_od, e.px_va_far_os],
    ['@Near (Rx)', e.px_va_near_od, e.px_va_near_os],
    ['IOP', e.iop_od, e.iop_os],
  ] as [string, any, any][])

  const refRows = eyeRows([
    ['Sph (lens)', r.sph_prx_od, r.sph_prx_os],
    ['Cyl (lens)', r.cyl_prx_od, r.cyl_prx_os],
    ['Axis (lens)', r.axis_prx_od, r.axis_prx_os],
    ['Add (lens)', r.add_prx_od, r.add_prx_os],
    ['Sph (auto)', r.sph_auto_od, r.sph_auto_os],
    ['Cyl (auto)', r.cyl_auto_od, r.cyl_auto_os],
    ['Axis (auto)', r.axis_auto_od, r.axis_auto_os],
    ['Sph (ret)', r.sph_ret_od, r.sph_ret_os],
    ['Cyl (ret)', r.cyl_ret_od, r.cyl_ret_os],
    ['Axis (ret)', r.axis_ret_od, r.axis_ret_os],
    ['Sph (subj)', r.sph_sub_od, r.sph_sub_os],
    ['Cyl (subj)', r.cyl_sub_od, r.cyl_sub_os],
    ['Axis (subj)', r.axis_sub_od, r.axis_sub_os],
    ['Add (subj)', r.add_sub_od, r.add_sub_os],
    ['Sph (final)', r.sph_final_od, r.sph_final_os],
    ['Cyl (final)', r.cyl_final_od, r.cyl_final_os],
    ['Axis (final)', r.axis_final_od, r.axis_final_os],
    ['Add (final)', r.add_final_od, r.add_final_os],
  ] as [string, any, any][])

  const antRows = eyeRows([['Findings', ant.notes_od, ant.notes_os]] as [string, any, any][])
  const postRows = eyeRows([
    ['Disc', post.disc_od, post.disc_os],
    ['Cupping', post.cup_od, post.cup_os],
    ['Notes', post.notes_od, post.notes_os],
  ] as [string, any, any][])

  const activeMeds = (meds ?? []).filter((m: any) => m.name || m.type || m.raw)

  return (
    <div className="mt-2">
      {v.reason_for_visit && (
        <p className="text-sm"><span className="text-muted-foreground">Reason: </span>{v.reason_for_visit}</p>
      )}
      {v.diagnosis && (
        <div className="flex items-center justify-between gap-2 mt-1.5 bg-amber-50 rounded px-2.5 py-1.5">
          <p className="text-sm"><span className="text-muted-foreground">Diagnosis: </span><span className="font-medium">{v.diagnosis}</span></p>
          <CopyButton text={v.diagnosis} label="diagnosis" />
        </div>
      )}

      {/* Visual acuity */}
      {isLegacyEye ? (
        <MiniSection title="Visual acuity">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{e.raw}</pre>
        </MiniSection>
      ) : vaRows.length > 0 && (
        <MiniSection title="Visual acuity">
          <EyeGridHeader />
          {vaRows.map(([l, od, os]) => <EyeRow key={l} label={l} od={od} os={os} />)}
        </MiniSection>
      )}

      {/* Refraction */}
      {isLegacyRef ? (
        <MiniSection title="Refraction">
          {r.auto_refractor && <p className="text-sm"><span className="text-muted-foreground">Auto: </span>{r.auto_refractor}</p>}
          {r.retinoscopy && <p className="text-sm"><span className="text-muted-foreground">Ret: </span>{r.retinoscopy}</p>}
          {r.final_subjective_rx && <p className="text-sm"><span className="text-muted-foreground">Final: </span>{r.final_subjective_rx}</p>}
        </MiniSection>
      ) : refRows.length > 0 && (
        <MiniSection title="Refraction" copyText={refractionToText(r)}>
          <EyeGridHeader />
          {refRows.map(([l, od, os]) => <EyeRow key={l} label={l} od={od} os={os} />)}
        </MiniSection>
      )}

      {/* Anterior */}
      {antRows.length > 0 && (
        <MiniSection title="Anterior segment">
          <EyeGridHeader />
          {antRows.map(([l, od, os]) => <EyeRow key={l} label={l} od={od} os={os} />)}
        </MiniSection>
      )}

      {/* Posterior */}
      {postRows.length > 0 && (
        <MiniSection title="Posterior segment">
          <EyeGridHeader />
          {postRows.map(([l, od, os]) => <EyeRow key={l} label={l} od={od} os={os} />)}
        </MiniSection>
      )}

      {/* Medications */}
      {activeMeds.length > 0 && (
        <MiniSection title="Drug prescription" copyText={medsToText(activeMeds)}>
          <div className="flex flex-col gap-1">
            {activeMeds.map((m: any, i: number) => (
              <div key={i} className="text-sm">
                {m.raw ?? [m.type, m.name, m.qty && `Qty:${m.qty}`, m.freq, m.duration].filter(Boolean).join(' ')}
              </div>
            ))}
          </div>
        </MiniSection>
      )}

      {v.notes && (
        <MiniSection title="Notes">
          <p className="text-sm whitespace-pre-wrap">{v.notes}</p>
        </MiniSection>
      )}
    </div>
  )
}

export function PastVisitsPanel({
  patientId,
  excludeVisitId,
}: {
  patientId: string
  excludeVisitId?: string
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [visits, setVisits] = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function openPanel() {
    setOpen(true)
    if (!loaded) {
      setLoading(true)
      const result = await getPatientVisits(patientId, excludeVisitId)
      setLoading(false)
      if (result.error) {
        setError(result.error)
      } else {
        setVisits(result.visits ?? [])
        setLoaded(true)
      }
    }
  }

  return (
    <>
      {/* Floating trigger — fixed to the viewport so it stays reachable as
          the doctor scrolls. Hidden while the panel itself is open. */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-brand text-white shadow-lg px-4 py-3 text-sm font-medium hover:bg-brand-hover transition-colors"
          aria-label="View past visits"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">Past visits</span>
        </button>
      )}

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 className="text-base font-semibold">Past visits</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading past visits…</p>}
              {error && <p className="text-sm text-red-500 py-4">{error}</p>}
              {!loading && !error && visits.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">No previous visits on record.</p>
              )}

              <div className="flex flex-col gap-2">
                {visits.map(v => {
                  const isExpanded = expandedId === v.id
                  const summary = oneLineSummary(v.refraction ?? {})
                  return (
                    <div key={v.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : v.id)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{fmtDate(v.visit_date)}</span>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {v.diagnosis && (
                          <p className="text-xs text-gray-600 mt-0.5">{v.diagnosis}</p>
                        )}
                        {summary && (
                          <p className="text-xs text-gray-400 mt-0.5">{summary}</p>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-gray-100">
                          <VisitDetail v={v} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
