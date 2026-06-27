'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import jsPDF from 'jspdf'

type Props = {
  patient: {
    full_name: string
    legacy_id?: number | null
  }
  visit: {
    visit_date: string
    diagnosis?: string | null
    refraction?: Record<string, any> | null
    medications?: any[] | null
    notes?: string | null
    referral?: string | null
    staff_profiles?: { full_name?: string } | null
  }
}

export default function ExportPrescriptionPDF({ patient, visit }: Props) {
  const [generating, setGenerating] = useState(false)

  function generate() {
    setGenerating(true)

    const doc = new jsPDF({ unit: 'mm', format: 'a5' })
    const r = visit.refraction ?? {}
    const meds: any[] = visit.medications ?? []
    const activeMeds = meds.filter(m => m.name)

    const W = doc.internal.pageSize.getWidth()
    const margin = 14
    let y = 0

    // ── Helpers ────────────────────────────────────────────
    function line(x1: number, y1: number, x2: number, y2: number, color = '#e5e5e5') {
      doc.setDrawColor(color)
      doc.line(x1, y1, x2, y2)
    }

    function text(
      str: string,
      x: number,
      yPos: number,
      opts: { size?: number; weight?: string; color?: string; align?: 'left' | 'center' | 'right' } = {}
    ) {
      doc.setFontSize(opts.size ?? 9)
      doc.setFont('helvetica', opts.weight === 'bold' ? 'bold' : 'normal')
      doc.setTextColor(opts.color ?? '#171717')
      doc.text(str, x, yPos, { align: opts.align ?? 'left' })
    }

    function sectionTitle(label: string, yPos: number) {
      text(label.toUpperCase(), margin, yPos, { size: 7, weight: 'bold', color: '#8c8c8c' })
      line(margin, yPos + 1.5, W - margin, yPos + 1.5)
      return yPos + 6
    }

    function eyeRow(
      label: string,
      od: string | null | undefined,
      os: string | null | undefined,
      yPos: number
    ) {
      if (!od && !os) return yPos
      text(label, margin, yPos, { size: 8, color: '#4d4d4d' })
      text(od || '—', 70, yPos, { size: 8, weight: 'bold' })
      text(os || '—', 120, yPos, { size: 8, weight: 'bold' })
      return yPos + 5.5
    }

    // ── Clinic header ──────────────────────────────────────
    y = 16
    text('OLU EYE CLINIC', margin, y, { size: 14, weight: 'bold', color: '#0d7b5f' })
    y += 5
    text('Specialist Optometry Practice', margin, y, { size: 8, color: '#8c8c8c' })
    y += 4
    text('Benin City, Edo State, Nigeria', margin, y, { size: 8, color: '#8c8c8c' })

    // Date + doctor — right aligned
    const visitDate = new Date(visit.visit_date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    text(visitDate, W - margin, 16, { size: 8, color: '#4d4d4d', align: 'right' })
    if (visit.staff_profiles?.full_name) {
      text(`Dr. ${visit.staff_profiles.full_name}`, W - margin, 21, {
        size: 8, color: '#8c8c8c', align: 'right'
      })
    }

    // Divider
    y += 5
    line(margin, y, W - margin, y, '#0d7b5f')
    y += 7

    // ── Patient info ───────────────────────────────────────
    text('PATIENT', margin, y, { size: 7, weight: 'bold', color: '#8c8c8c' })
    y += 5
    text(patient.full_name, margin, y, { size: 11, weight: 'bold' })
    if (patient.legacy_id) {
      text(`Patient #${patient.legacy_id}`, margin, y + 5, { size: 8, color: '#8c8c8c' })
    }
    y += 13

    // ── Prescription (Refraction) ──────────────────────────
    const hasFinal = r.sph_final_od || r.sph_final_os || r.cyl_final_od || r.cyl_final_os
    const hasPrx = r.sph_prx_od || r.sph_prx_os || r.cyl_prx_od || r.cyl_prx_os

    if (hasFinal || hasPrx) {
      y = sectionTitle('Optical Prescription', y)

      // Column headers
      text('', margin, y)
      text('OD (Right Eye)', 70, y, { size: 7, weight: 'bold', color: '#be185d' })
      text('OS (Left Eye)', 120, y, { size: 7, weight: 'bold', color: '#15803d' })
      y += 5

      if (hasFinal) {
        text('Final Rx', margin, y, { size: 7, color: '#8c8c8c' })
        y += 4
        y = eyeRow('Sphere (Sph)', r.sph_final_od, r.sph_final_os, y)
        y = eyeRow('Cylinder (Cyl)', r.cyl_final_od, r.cyl_final_os, y)
        y = eyeRow('Axis', r.axis_final_od, r.axis_final_os, y)
        y = eyeRow('Addition (Add)', r.add_final_od, r.add_final_os, y)
        y += 2
      }

      if (hasPrx && !hasFinal) {
        y = eyeRow('Sphere (Sph)', r.sph_prx_od, r.sph_prx_os, y)
        y = eyeRow('Cylinder (Cyl)', r.cyl_prx_od, r.cyl_prx_os, y)
        y = eyeRow('Axis', r.axis_prx_od, r.axis_prx_os, y)
        y = eyeRow('Addition (Add)', r.add_prx_od, r.add_prx_os, y)
        y += 2
      }

      y += 3
    }

    // ── Diagnosis ──────────────────────────────────────────
    if (visit.diagnosis) {
      y = sectionTitle('Diagnosis', y)
      const diagLines = doc.splitTextToSize(visit.diagnosis, W - margin * 2)
      text(diagLines.join('\n'), margin, y, { size: 9 })
      y += diagLines.length * 5 + 5
    }

    // ── Medications ────────────────────────────────────────
    if (activeMeds.length > 0) {
      y = sectionTitle('Drug Prescription', y)
      activeMeds.forEach((m, i) => {
        const parts = [m.type, m.name, m.freq ? `× ${m.freq}` : ''].filter(Boolean).join('  ')
        text(`${i + 1}.  ${parts}`, margin, y, { size: 9 })
        y += 5.5
      })
      y += 3
    }

    // ── Referral ───────────────────────────────────────────
    if (visit.referral) {
      y = sectionTitle('Referral', y)
      text(visit.referral, margin, y, { size: 9 })
      y += 8
    }

    // ── Notes ──────────────────────────────────────────────
    if (visit.notes) {
      y = sectionTitle('Notes', y)
      const noteLines = doc.splitTextToSize(visit.notes, W - margin * 2)
      text(noteLines.join('\n'), margin, y, { size: 8, color: '#4d4d4d' })
      y += noteLines.length * 4.5 + 5
    }

    // ── Footer ─────────────────────────────────────────────
    const pageH = doc.internal.pageSize.getHeight()
    line(margin, pageH - 18, W - margin, pageH - 18, '#e5e5e5')
    text(
      'This prescription is valid for 12 months from the date of issue.',
      W / 2, pageH - 13,
      { size: 7, color: '#8c8c8c', align: 'center' }
    )
    text(
      'Olu Eye Clinic — Benin City',
      W / 2, pageH - 8,
      { size: 7, color: '#8c8c8c', align: 'center' }
    )

    // ── Save ───────────────────────────────────────────────
    const fileName = `Prescription_${patient.full_name.replace(/\s+/g, '_')}_${visitDate.replace(/\s/g, '_')}.pdf`
    doc.save(fileName)
    setGenerating(false)
  }

  return (
    <button
      onClick={generate}
      disabled={generating}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      {generating ? 'Generating...' : 'Export prescription'}
    </button>
  )
}