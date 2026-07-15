'use client'

import { useState, useEffect, useRef, FormEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CHARTS = ['Snellen', 'Illiterate E', 'Landot C', 'Children Chart', 'LogMAR']
const VA_TYPES = ['Analog', 'Digital']
const DRUG_TYPES = ['', 'Tab', 'Cap', 'Gutt', 'Oc']
const DRUG_FREQS = ['', 'qds', 'tds', 'bd', 'dly', 'nocte']
const DISC_TYPES = ['', 'Type I', 'Type II', 'Type III', 'Type IV', 'Type V']

// Qty and Duration are free text — doctor types e.g. "30" and "5 days"
type Drug = { type: string; name: string; qty: string; freq: string; duration: string }

function SectionHeader({ title }: { title: string }) {
  return <h3 className="mt-6 border-b border-gray-200 pb-1 text-sm sm:text-base font-semibold uppercase tracking-wide text-gray-700">{title}</h3>
}

function TextInput({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="rounded border border-gray-300 p-2 text-sm" />
        : <input value={value} onChange={e => onChange(e.target.value)} className="rounded border border-gray-300 p-2 text-sm" />}
    </label>
  )
}

function YellowTextarea({ label, value, onChange, rows = 4 }: { label?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className="rounded border border-yellow-200 bg-[#fff5cd] p-2 text-sm resize-none" />
    </label>
  )
}

function SuffixInput({ label, value, onChange, suffix, colorClass }: { label?: string; value: string; onChange: (v: string) => void; suffix: string; colorClass: string }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs sm:text-sm text-gray-600">{label}</span>}
      <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass}`}>
        <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" />
        {value && <span className="pr-1.5 text-xs text-gray-400 select-none whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  )
}

// Plain single input — no 6/ prefix, no add box
function FractionInput({ label, value, onChange, colorClass }: { label?: string; value: string; onChange: (v: string) => void; colorClass: string }) {
  const isOD = colorClass.includes('pink')
  return (
    <div className="flex flex-col gap-1">
      {label && <span className={`text-xs font-medium sm:hidden ${isOD ? 'text-pink-400' : 'text-green-500'}`}>{label}</span>}
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`rounded border p-1.5 text-sm w-full bg-transparent ${colorClass}`}
      />
    </div>
  )
}

function NearInput({ label, value, onChange, colorClass }: { label?: string; value: string; onChange: (v: string) => void; colorClass: string }) {
  const isOD = colorClass.includes('pink')
  return (
    <div className="flex flex-col gap-1">
      {label && <span className={`text-xs font-medium sm:hidden ${isOD ? 'text-pink-400' : 'text-green-500'}`}>{label}</span>}
      <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass}`}>
        <span className="pl-1.5 text-xs text-gray-400 select-none">N</span>
        <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" />
      </div>
    </div>
  )
}

const OD_CLASS = 'border-pink-200 bg-pink-50'
const OS_CLASS = 'border-green-200 bg-green-50'

function OD({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-pink-400 font-medium sm:hidden">{label}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} className="rounded border border-pink-200 bg-pink-50 p-1.5 text-sm w-full" />
    </label>
  )
}

function OS({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-green-500 font-medium sm:hidden">{label}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} className="rounded border border-green-200 bg-green-50 p-1.5 text-sm w-full" />
    </label>
  )
}

function Sel({ label, value, onChange, options }: { label?: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs sm:text-sm font-medium text-gray-600">{label}</span>}
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </label>
  )
}

function EyeRow({ label, odContent, osContent }: { label: string; odContent: ReactNode; osContent: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-2 items-end">
      <span className="text-xs sm:text-sm font-medium text-gray-700 self-center col-span-2 sm:col-span-1">{label}</span>
      <div className="sm:col-span-2">{odContent}</div>
      <div className="sm:col-span-2">{osContent}</div>
    </div>
  )
}

function EyeColHeaders() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:hidden mb-1">
      <span className="text-xs font-semibold text-pink-400 text-center">OD (Right)</span>
      <span className="text-xs font-semibold text-green-500 text-center">OS (Left)</span>
    </div>
  )
}

function ODOSDesktopHeader() {
  return (
    <div className="hidden sm:grid sm:grid-cols-5 sm:gap-2 mb-1">
      <div />
      <div className="col-span-2 text-center text-xs font-semibold text-pink-400">OD (Right)</div>
      <div className="col-span-2 text-center text-xs font-semibold text-green-500">OS (Left)</div>
    </div>
  )
}

export default function NewVisitForm({ patientId, doctorId }: { patientId: string; doctorId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const DRAFT_KEY = `visit-draft:${patientId}`

  const [reasonForVisit, setReasonForVisit] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [lastEyeExam, setLastEyeExam] = useState('')
  const [medicalHistory, setMedicalHistory] = useState('')
  const [age, setAge] = useState('')
  const [bp, setBp] = useState('')

  const [hasPrx, setHasPrx] = useState('No')
  const [sphPrxOD, setSphPrxOD] = useState('')
  const [cylPrxOD, setCylPrxOD] = useState('')
  const [axisPrxOD, setAxisPrxOD] = useState('')
  const [addPrxOD, setAddPrxOD] = useState('')
  const [sphPrxOS, setSphPrxOS] = useState('')
  const [cylPrxOS, setCylPrxOS] = useState('')
  const [axisPrxOS, setAxisPrxOS] = useState('')
  const [addPrxOS, setAddPrxOS] = useState('')

  const [vaType, setVaType] = useState('Analog')
  const [vaChart, setVaChart] = useState('Snellen')
  const [vaFarOD, setVaFarOD] = useState('')
  const [vaFarOS, setVaFarOS] = useState('')
  const [vaNearOD, setVaNearOD] = useState('')
  const [vaNearOS, setVaNearOS] = useState('')
  const [vaPinholeOD, setVaPinholeOD] = useState('')
  const [vaPinholeOS, setVaPinholeOS] = useState('')
  const [pxVaFarOD, setPxVaFarOD] = useState('')
  const [pxVaFarOS, setPxVaFarOS] = useState('')
  const [pxVaNearOD, setPxVaNearOD] = useState('')
  const [pxVaNearOS, setPxVaNearOS] = useState('')

  const [sphAutoOD, setSphAutoOD] = useState('')
  const [cylAutoOD, setCylAutoOD] = useState('')
  const [axisAutoOD, setAxisAutoOD] = useState('')
  const [sphAutoOS, setSphAutoOS] = useState('')
  const [cylAutoOS, setCylAutoOS] = useState('')
  const [axisAutoOS, setAxisAutoOS] = useState('')

  const [iopOD, setIopOD] = useState('')
  const [iopOS, setIopOS] = useState('')

  // Default to NAD — "No Abnormality Detected" is the standard clinical default
  const [anteriorOD, setAnteriorOD] = useState('NAD')
  const [anteriorOS, setAnteriorOS] = useState('NAD')

  const [discOD, setDiscOD] = useState('')
  const [discOS, setDiscOS] = useState('')
  const [cupOD, setCupOD] = useState('')
  const [cupOS, setCupOS] = useState('')
  const [posteriorOD, setPosteriorOD] = useState('')
  const [posteriorOS, setPosteriorOS] = useState('')

  const [sphRetOD, setSphRetOD] = useState('')
  const [cylRetOD, setCylRetOD] = useState('')
  const [axisRetOD, setAxisRetOD] = useState('')
  const [sphRetOS, setSphRetOS] = useState('')
  const [cylRetOS, setCylRetOS] = useState('')
  const [axisRetOS, setAxisRetOS] = useState('')
  const [retVaFarOD, setRetVaFarOD] = useState('')
  const [retVaFarOS, setRetVaFarOS] = useState('')

  const [sphSubOD, setSphSubOD] = useState('')
  const [cylSubOD, setCylSubOD] = useState('')
  const [axisSubOD, setAxisSubOD] = useState('')
  const [addSubOD, setAddSubOD] = useState('')
  const [sphSubOS, setSphSubOS] = useState('')
  const [cylSubOS, setCylSubOS] = useState('')
  const [axisSubOS, setAxisSubOS] = useState('')
  const [addSubOS, setAddSubOS] = useState('')

  const [sphFinalOD, setSphFinalOD] = useState('')
  const [cylFinalOD, setCylFinalOD] = useState('')
  const [axisFinalOD, setAxisFinalOD] = useState('')
  const [addFinalOD, setAddFinalOD] = useState('')
  const [sphFinalOS, setSphFinalOS] = useState('')
  const [cylFinalOS, setCylFinalOS] = useState('')
  const [axisFinalOS, setAxisFinalOS] = useState('')
  const [addFinalOS, setAddFinalOS] = useState('')
  const [finalVaFarOD, setFinalVaFarOD] = useState('')
  const [finalVaFarOS, setFinalVaFarOS] = useState('')
  const [finalVaNearOD, setFinalVaNearOD] = useState('')
  const [finalVaNearOS, setFinalVaNearOS] = useState('')

  const [diagnosis, setDiagnosis] = useState('')
  // Drug type now includes qty and duration
  const [drugs, setDrugs] = useState<Drug[]>([{ type: '', name: '', qty: '', freq: '', duration: '' }])
  const [hasReferral, setHasReferral] = useState('No')
  const [referralFor, setReferralFor] = useState('')
  const [refDate, setRefDate] = useState('')
  const [nextAppointment, setNextAppointment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [draftFound, setDraftFound] = useState(false)
  const [draftData, setDraftData] = useState<any>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<string>('')
  const [lastSaved, setLastSaved] = useState<string>('')
  const [restored, setRestored] = useState(false)

  const hydratedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function collectFormData() {
    return {
      reasonForVisit, symptoms, lastEyeExam, medicalHistory, age, bp,
      hasPrx, sphPrxOD, cylPrxOD, axisPrxOD, addPrxOD, sphPrxOS, cylPrxOS, axisPrxOS, addPrxOS,
      vaType, vaChart, vaFarOD, vaFarOS, vaNearOD, vaNearOS,
      vaPinholeOD, vaPinholeOS,
      pxVaFarOD, pxVaFarOS, pxVaNearOD, pxVaNearOS,
      sphAutoOD, cylAutoOD, axisAutoOD, sphAutoOS, cylAutoOS, axisAutoOS,
      iopOD, iopOS, anteriorOD, anteriorOS,
      discOD, discOS, cupOD, cupOS, posteriorOD, posteriorOS,
      sphRetOD, cylRetOD, axisRetOD, sphRetOS, cylRetOS, axisRetOS,
      retVaFarOD, retVaFarOS,
      sphSubOD, cylSubOD, axisSubOD, addSubOD, sphSubOS, cylSubOS, axisSubOS, addSubOS,
      sphFinalOD, cylFinalOD, axisFinalOD, addFinalOD, sphFinalOS, cylFinalOS, axisFinalOS, addFinalOS,
      finalVaFarOD, finalVaFarOS, finalVaNearOD, finalVaNearOS,
      diagnosis, drugs, hasReferral, referralFor, refDate, nextAppointment, notes,
    }
  }

  function applyDraft(d: any) {
    if (!d) return
    setReasonForVisit(d.reasonForVisit ?? ''); setSymptoms(d.symptoms ?? '')
    setLastEyeExam(d.lastEyeExam ?? ''); setMedicalHistory(d.medicalHistory ?? '')
    setAge(d.age ?? ''); setBp(d.bp ?? '')
    setHasPrx(d.hasPrx ?? 'No')
    setSphPrxOD(d.sphPrxOD ?? ''); setCylPrxOD(d.cylPrxOD ?? ''); setAxisPrxOD(d.axisPrxOD ?? ''); setAddPrxOD(d.addPrxOD ?? '')
    setSphPrxOS(d.sphPrxOS ?? ''); setCylPrxOS(d.cylPrxOS ?? ''); setAxisPrxOS(d.axisPrxOS ?? ''); setAddPrxOS(d.addPrxOS ?? '')
    setVaType(d.vaType ?? 'Analog'); setVaChart(d.vaChart ?? 'Snellen')
    setVaFarOD(d.vaFarOD ?? ''); setVaFarOS(d.vaFarOS ?? '')
    setVaNearOD(d.vaNearOD ?? ''); setVaNearOS(d.vaNearOS ?? '')
    setVaPinholeOD(d.vaPinholeOD ?? ''); setVaPinholeOS(d.vaPinholeOS ?? '')
    setPxVaFarOD(d.pxVaFarOD ?? ''); setPxVaFarOS(d.pxVaFarOS ?? '')
    setPxVaNearOD(d.pxVaNearOD ?? ''); setPxVaNearOS(d.pxVaNearOS ?? '')
    setSphAutoOD(d.sphAutoOD ?? ''); setCylAutoOD(d.cylAutoOD ?? ''); setAxisAutoOD(d.axisAutoOD ?? '')
    setSphAutoOS(d.sphAutoOS ?? ''); setCylAutoOS(d.cylAutoOS ?? ''); setAxisAutoOS(d.axisAutoOS ?? '')
    setIopOD(d.iopOD ?? ''); setIopOS(d.iopOS ?? '')
    setAnteriorOD(d.anteriorOD ?? 'NAD'); setAnteriorOS(d.anteriorOS ?? 'NAD')
    setDiscOD(d.discOD ?? ''); setDiscOS(d.discOS ?? ''); setCupOD(d.cupOD ?? ''); setCupOS(d.cupOS ?? '')
    setPosteriorOD(d.posteriorOD ?? ''); setPosteriorOS(d.posteriorOS ?? '')
    setSphRetOD(d.sphRetOD ?? ''); setCylRetOD(d.cylRetOD ?? ''); setAxisRetOD(d.axisRetOD ?? '')
    setSphRetOS(d.sphRetOS ?? ''); setCylRetOS(d.cylRetOS ?? ''); setAxisRetOS(d.axisRetOS ?? '')
    setRetVaFarOD(d.retVaFarOD ?? ''); setRetVaFarOS(d.retVaFarOS ?? '')
    setSphSubOD(d.sphSubOD ?? ''); setCylSubOD(d.cylSubOD ?? ''); setAxisSubOD(d.axisSubOD ?? ''); setAddSubOD(d.addSubOD ?? '')
    setSphSubOS(d.sphSubOS ?? ''); setCylSubOS(d.cylSubOS ?? ''); setAxisSubOS(d.axisSubOS ?? ''); setAddSubOS(d.addSubOS ?? '')
    setSphFinalOD(d.sphFinalOD ?? ''); setCylFinalOD(d.cylFinalOD ?? ''); setAxisFinalOD(d.axisFinalOD ?? ''); setAddFinalOD(d.addFinalOD ?? '')
    setSphFinalOS(d.sphFinalOS ?? ''); setCylFinalOS(d.cylFinalOS ?? ''); setAxisFinalOS(d.axisFinalOS ?? ''); setAddFinalOS(d.addFinalOS ?? '')
    setFinalVaFarOD(d.finalVaFarOD ?? ''); setFinalVaFarOS(d.finalVaFarOS ?? '')
    setFinalVaNearOD(d.finalVaNearOD ?? ''); setFinalVaNearOS(d.finalVaNearOS ?? '')
    setDiagnosis(d.diagnosis ?? '')
    setDrugs(Array.isArray(d.drugs) && d.drugs.length > 0 ? d.drugs : [{ type: '', name: '', qty: '', freq: '', duration: '' }])
    setHasReferral(d.hasReferral ?? 'No'); setReferralFor(d.referralFor ?? ''); setRefDate(d.refDate ?? '')
    setNextAppointment(d.nextAppointment ?? ''); setNotes(d.notes ?? '')
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setDraftData(parsed.data ?? null)
        setDraftSavedAt(parsed.savedAt ?? '')
        setDraftFound(true)
      } else {
        setRestored(true)
      }
    } catch {
      setRestored(true)
    }
    hydratedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydratedRef.current || !restored) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        const payload = { data: collectFormData(), savedAt: new Date().toISOString() }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
        setLastSaved(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      } catch {}
    }, 1000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restored, reasonForVisit, symptoms, lastEyeExam, medicalHistory, age, bp,
    hasPrx, sphPrxOD, cylPrxOD, axisPrxOD, addPrxOD, sphPrxOS, cylPrxOS, axisPrxOS, addPrxOS,
    vaType, vaChart, vaFarOD, vaFarOS, vaNearOD, vaNearOS,
    vaPinholeOD, vaPinholeOS, pxVaFarOD, pxVaFarOS, pxVaNearOD, pxVaNearOS,
    sphAutoOD, cylAutoOD, axisAutoOD, sphAutoOS, cylAutoOS, axisAutoOS,
    iopOD, iopOS, anteriorOD, anteriorOS,
    discOD, discOS, cupOD, cupOS, posteriorOD, posteriorOS,
    sphRetOD, cylRetOD, axisRetOD, sphRetOS, cylRetOS, axisRetOS,
    retVaFarOD, retVaFarOS,
    sphSubOD, cylSubOD, axisSubOD, addSubOD, sphSubOS, cylSubOS, axisSubOS, addSubOS,
    sphFinalOD, cylFinalOD, axisFinalOD, addFinalOD, sphFinalOS, cylFinalOS, axisFinalOS, addFinalOS,
    finalVaFarOD, finalVaFarOS, finalVaNearOD, finalVaNearOS,
    diagnosis, drugs, hasReferral, referralFor, refDate, nextAppointment, notes,
  ])

  function handleRestoreDraft() { applyDraft(draftData); setDraftFound(false); setRestored(true) }
  function handleDiscardDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch {}
    setDraftData(null); setDraftFound(false); setRestored(true)
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY) } catch {} }

  function addDrug() { setDrugs(prev => [...prev, { type: '', name: '', qty: '', freq: '', duration: '' }]) }
  function updateDrug(i: number, field: keyof Drug, val: string) {
    setDrugs(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))
  }
  function removeDrug(i: number) { setDrugs(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    const meds = drugs.filter(d => d.name || d.type).map(d => ({
      type: d.type || null,
      name: d.name || null,
      qty: d.qty || null,
      freq: d.freq || null,
      duration: d.duration || null,
    }))

    const { error } = await supabase.from('visit_records').insert({
      patient_id: patientId,
      doctor_id: doctorId,
      medical_history: medicalHistory || null,
      reason_for_visit: reasonForVisit || null,
      symptoms_presented: symptoms || null,
      last_eye_exam: lastEyeExam || null,
      age_at_visit: age || null,
      bp: bp || null,
      eye_test_results: {
        va_type: vaType, va_chart: vaChart,
        va_far_od: vaFarOD || null,
        va_far_os: vaFarOS || null,
        va_near_od: vaNearOD ? `N${vaNearOD}` : null,
        va_near_os: vaNearOS ? `N${vaNearOS}` : null,
        va_pinhole_od: vaPinholeOD || null,
        va_pinhole_os: vaPinholeOS || null,
        px_va_far_od: pxVaFarOD || null,
        px_va_far_os: pxVaFarOS || null,
        px_va_near_od: pxVaNearOD ? `N${pxVaNearOD}` : null,
        px_va_near_os: pxVaNearOS ? `N${pxVaNearOS}` : null,
        iop_od: iopOD ? `${iopOD}mmHg` : null,
        iop_os: iopOS ? `${iopOS}mmHg` : null,
        ret_va_far_od: retVaFarOD || null,
        ret_va_far_os: retVaFarOS || null,
        final_va_far_od: finalVaFarOD || null,
        final_va_far_os: finalVaFarOS || null,
        final_va_near_od: finalVaNearOD ? `N${finalVaNearOD}` : null,
        final_va_near_os: finalVaNearOS ? `N${finalVaNearOS}` : null,
      },
      refraction: {
        has_prx: hasPrx,
        sph_prx_od: sphPrxOD || null, cyl_prx_od: cylPrxOD || null, axis_prx_od: axisPrxOD ? `${axisPrxOD}°` : null, add_prx_od: addPrxOD || null,
        sph_prx_os: sphPrxOS || null, cyl_prx_os: cylPrxOS || null, axis_prx_os: axisPrxOS ? `${axisPrxOS}°` : null, add_prx_os: addPrxOS || null,
        sph_auto_od: sphAutoOD || null, cyl_auto_od: cylAutoOD || null, axis_auto_od: axisAutoOD ? `${axisAutoOD}°` : null,
        sph_auto_os: sphAutoOS || null, cyl_auto_os: cylAutoOS || null, axis_auto_os: axisAutoOS ? `${axisAutoOS}°` : null,
        sph_ret_od: sphRetOD || null, cyl_ret_od: cylRetOD || null, axis_ret_od: axisRetOD ? `${axisRetOD}°` : null,
        sph_ret_os: sphRetOS || null, cyl_ret_os: cylRetOS || null, axis_ret_os: axisRetOS ? `${axisRetOS}°` : null,
        sph_sub_od: sphSubOD || null, cyl_sub_od: cylSubOD || null, axis_sub_od: axisSubOD ? `${axisSubOD}°` : null, add_sub_od: addSubOD || null,
        sph_sub_os: sphSubOS || null, cyl_sub_os: cylSubOS || null, axis_sub_os: axisSubOS ? `${axisSubOS}°` : null, add_sub_os: addSubOS || null,
        sph_final_od: sphFinalOD || null, cyl_final_od: cylFinalOD || null, axis_final_od: axisFinalOD ? `${axisFinalOD}°` : null, add_final_od: addFinalOD || null,
        sph_final_os: sphFinalOS || null, cyl_final_os: cylFinalOS || null, axis_final_os: axisFinalOS ? `${axisFinalOS}°` : null, add_final_os: addFinalOS || null,
      },
      anterior_segment: { notes_od: anteriorOD || null, notes_os: anteriorOS || null },
      posterior_segment: {
        disc_od: discOD || null, disc_os: discOS || null,
        cup_od: cupOD ? `${cupOD}%` : null, cup_os: cupOS ? `${cupOS}%` : null,
        notes_od: posteriorOD || null, notes_os: posteriorOS || null,
      },
      medications: meds,
      diagnosis: diagnosis || null,
      referral: hasReferral === 'Yes' ? referralFor : null,
      ref_date: refDate || null,
      follow_up_date: nextAppointment || null,
      notes: notes || null,
    })

    setSaving(false)
    if (error) { setErrorMsg(error.message); return }

    if (nextAppointment) {
      await supabase.from('appointments').insert({
        patient_id: patientId,
        appointment_date: `${nextAppointment}T09:00:00`,
        service_type: 'Routine eye exam',
        status: 'booked',
      })
    }

    clearDraft()
    router.push(`/dashboard/patients/${patientId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 text-sm">

      {draftFound && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Unsaved draft found</p>
            <p className="text-xs text-gray-500 mt-0.5">
              You have an unsaved visit for this patient
              {draftSavedAt ? ` from ${new Date(draftSavedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.
              Restore it, or discard and start fresh.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={handleRestoreDraft} className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover transition-colors">
              Restore draft
            </button>
            <button type="button" onClick={handleDiscardDraft} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Discard
            </button>
          </div>
        </div>
      )}

      {restored && lastSaved && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Draft saved on this device at {lastSaved}
        </div>
      )}

      <SectionHeader title="Presenting Complaint" />
      <div className="grid grid-cols-2 gap-4">
        <TextInput label="Age" value={age} onChange={setAge} />
        <TextInput label="Blood pressure" value={bp} onChange={setBp} />
      </div>
      <TextInput label="Reason for visit" value={reasonForVisit} onChange={setReasonForVisit} />
      <YellowTextarea label="Symptoms presented" value={symptoms} onChange={setSymptoms} />
      <YellowTextarea label="Last eye exam" value={lastEyeExam} onChange={setLastEyeExam} />
      <YellowTextarea label="Medical history" value={medicalHistory} onChange={setMedicalHistory} />

      <SectionHeader title="Prescription?" />
      <Sel label="Prescription?" value={hasPrx} onChange={setHasPrx} options={['No', 'Yes']} />
      <EyeColHeaders />
      <div className="hidden sm:grid sm:grid-cols-5 sm:gap-2">
        <div />
        <div className="col-span-2 text-center text-xs font-semibold text-pink-400">OD (Right)</div>
        <div className="col-span-2 text-center text-xs font-semibold text-green-500">OS (Left)</div>
      </div>
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphPrxOD} onChange={setSphPrxOD} />} osContent={<OS value={sphPrxOS} onChange={setSphPrxOS} />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylPrxOD} onChange={setCylPrxOD} />} osContent={<OS value={cylPrxOS} onChange={setSphPrxOS} />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisPrxOD} onChange={setAxisPrxOD} suffix="°" colorClass={OD_CLASS} />} osContent={<SuffixInput value={axisPrxOS} onChange={setAxisPrxOS} suffix="°" colorClass={OS_CLASS} />} />
        <EyeRow label="Add" odContent={<OD value={addPrxOD} onChange={setAddPrxOD} />} osContent={<OS value={addPrxOS} onChange={setAddPrxOS} />} />
      </div>

      <SectionHeader title="Visual Acuity" />
      <div className="grid grid-cols-2 gap-4">
        <Sel label="Type" value={vaType} onChange={setVaType} options={VA_TYPES} />
        <Sel label="Chart used" value={vaChart} onChange={setVaChart} options={CHARTS} />
      </div>

      <p className="text-xs sm:text-sm font-semibold uppercase text-gray-600 mt-2">Without Correction</p>
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="@Far" odContent={<FractionInput value={vaFarOD} onChange={setVaFarOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<FractionInput value={vaFarOS} onChange={setVaFarOS} colorClass={OS_CLASS} label="OS (Left)" />} />
        <EyeRow label="@Near" odContent={<NearInput value={vaNearOD} onChange={setVaNearOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<NearInput value={vaNearOS} onChange={setVaNearOS} colorClass={OS_CLASS} label="OS (Left)" />} />
        <EyeRow label="Pin Hole" odContent={<FractionInput value={vaPinholeOD} onChange={setVaPinholeOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<FractionInput value={vaPinholeOS} onChange={setVaPinholeOS} colorClass={OS_CLASS} label="OS (Left)" />} />
      </div>

      <p className="text-xs sm:text-sm font-semibold uppercase text-gray-600 mt-2">With Correction</p>
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="@Far" odContent={<FractionInput value={pxVaFarOD} onChange={setPxVaFarOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<FractionInput value={pxVaFarOS} onChange={setPxVaFarOS} colorClass={OS_CLASS} label="OS (Left)" />} />
        <EyeRow label="@Near" odContent={<NearInput value={pxVaNearOD} onChange={setPxVaNearOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<NearInput value={pxVaNearOS} onChange={setPxVaNearOS} colorClass={OS_CLASS} label="OS (Left)" />} />
      </div>

      <SectionHeader title="Auto-Refraction" />
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphAutoOD} onChange={setSphAutoOD} />} osContent={<OS value={sphAutoOS} onChange={setSphAutoOS} />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylAutoOD} onChange={setCylAutoOD} />} osContent={<OS value={cylAutoOS} onChange={setCylAutoOS} />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisAutoOD} onChange={setAxisAutoOD} suffix="°" colorClass={OD_CLASS} />} osContent={<SuffixInput value={axisAutoOS} onChange={setAxisAutoOS} suffix="°" colorClass={OS_CLASS} />} />
      </div>

      <SectionHeader title="IOP" />
      <div className="grid grid-cols-2 gap-4">
        <SuffixInput label="IOP OD (right)" value={iopOD} onChange={setIopOD} suffix="mmHg" colorClass={OD_CLASS} />
        <SuffixInput label="IOP OS (left)" value={iopOS} onChange={setIopOS} suffix="mmHg" colorClass={OS_CLASS} />
      </div>

      <SectionHeader title="External Exam (Anterior Segment)" />
      <EyeColHeaders />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-pink-400 mb-1 hidden sm:block">OD (Right)</p>
          <textarea value={anteriorOD} onChange={e => setAnteriorOD(e.target.value)} rows={5} className="w-full rounded border border-pink-200 bg-pink-50 p-2 text-sm resize-none" />
        </div>
        <div>
          <p className="text-xs font-semibold text-green-500 mb-1 hidden sm:block">OS (Left)</p>
          <textarea value={anteriorOS} onChange={e => setAnteriorOS(e.target.value)} rows={5} className="w-full rounded border border-green-200 bg-green-50 p-2 text-sm resize-none" />
        </div>
      </div>

      <SectionHeader title="Ophthalmoscopy (Posterior Segment)" />
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="Disc"
          odContent={
            <div className="flex flex-col gap-1">
              <span className="text-xs text-pink-400 font-medium sm:hidden">OD</span>
              <select value={discOD} onChange={e => setDiscOD(e.target.value)} className="w-full rounded border border-pink-200 bg-pink-50 p-1.5 text-sm">
                {DISC_TYPES.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
          }
          osContent={
            <div className="flex flex-col gap-1">
              <span className="text-xs text-green-500 font-medium sm:hidden">OS</span>
              <select value={discOS} onChange={e => setDiscOS(e.target.value)} className="w-full rounded border border-green-200 bg-green-50 p-1.5 text-sm">
                {DISC_TYPES.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
          }
        />
        <EyeRow label="Cupping" odContent={<SuffixInput value={cupOD} onChange={setCupOD} suffix="%" colorClass={OD_CLASS} />} osContent={<SuffixInput value={cupOS} onChange={setCupOS} suffix="%" colorClass={OS_CLASS} />} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <textarea value={posteriorOD} onChange={e => setPosteriorOD(e.target.value)} rows={4} placeholder="OD posterior notes…" className="w-full rounded border border-yellow-200 bg-[#fff5cd] p-2 text-sm resize-none" />
        <textarea value={posteriorOS} onChange={e => setPosteriorOS(e.target.value)} rows={4} placeholder="OS posterior notes…" className="w-full rounded border border-yellow-200 bg-[#fff5cd] p-2 text-sm resize-none" />
      </div>

      <SectionHeader title="Retinoscopy" />
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphRetOD} onChange={setSphRetOD} />} osContent={<OS value={sphRetOS} onChange={setSphRetOS} />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylRetOD} onChange={setCylRetOD} />} osContent={<OS value={cylRetOS} onChange={setCylRetOS} />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisRetOD} onChange={setAxisRetOD} suffix="°" colorClass={OD_CLASS} />} osContent={<SuffixInput value={axisRetOS} onChange={setAxisRetOS} suffix="°" colorClass={OS_CLASS} />} />
      </div>
      {/* @Near removed from Retinoscopy per clinic request */}
      <p className="text-xs sm:text-sm font-semibold uppercase text-gray-600 mt-2">V.A after Retinoscopy</p>
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="@Far" odContent={<FractionInput value={retVaFarOD} onChange={setRetVaFarOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<FractionInput value={retVaFarOS} onChange={setRetVaFarOS} colorClass={OS_CLASS} label="OS (Left)" />} />
      </div>

      <SectionHeader title="Subjective Refraction" />
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphSubOD} onChange={setSphSubOD} />} osContent={<OS value={sphSubOS} onChange={setSphSubOS} />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylSubOD} onChange={setCylSubOD} />} osContent={<OS value={cylSubOS} onChange={setCylSubOS} />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisSubOD} onChange={setAxisSubOD} suffix="°" colorClass={OD_CLASS} />} osContent={<SuffixInput value={axisSubOS} onChange={setAxisSubOS} suffix="°" colorClass={OS_CLASS} />} />
        <EyeRow label="Add" odContent={<OD value={addSubOD} onChange={setAddSubOD} />} osContent={<OS value={addSubOS} onChange={setAddSubOS} />} />
      </div>

      <SectionHeader title="Final Prescription" />
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphFinalOD} onChange={setSphFinalOD} />} osContent={<OS value={sphFinalOS} onChange={setSphFinalOS} />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylFinalOD} onChange={setCylFinalOD} />} osContent={<OS value={cylFinalOS} onChange={setCylFinalOS} />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisFinalOD} onChange={setAxisFinalOD} suffix="°" colorClass={OD_CLASS} />} osContent={<SuffixInput value={axisFinalOS} onChange={setAxisFinalOS} suffix="°" colorClass={OS_CLASS} />} />
        <EyeRow label="Add" odContent={<OD value={addFinalOD} onChange={setAddFinalOD} />} osContent={<OS value={addFinalOS} onChange={setAddFinalOS} />} />
      </div>
      <p className="text-xs sm:text-sm font-semibold uppercase text-gray-600 mt-2">V.A after Final Prescription</p>
      <EyeColHeaders />
      <ODOSDesktopHeader />
      <div className="flex flex-col gap-3">
        <EyeRow label="@Far" odContent={<FractionInput value={finalVaFarOD} onChange={setFinalVaFarOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<FractionInput value={finalVaFarOS} onChange={setFinalVaFarOS} colorClass={OS_CLASS} label="OS (Left)" />} />
        <EyeRow label="@Near" odContent={<NearInput value={finalVaNearOD} onChange={setFinalVaNearOD} colorClass={OD_CLASS} label="OD (Right)" />} osContent={<NearInput value={finalVaNearOS} onChange={setFinalVaNearOS} colorClass={OS_CLASS} label="OS (Left)" />} />
      </div>

      <SectionHeader title="Diagnosis" />
      <YellowTextarea label="" value={diagnosis} onChange={setDiagnosis} rows={3} />

      <SectionHeader title="Drug Prescription" />
      <div className="flex flex-col gap-2">
        {/* Column headers — only shown on first row */}
        <div className="hidden sm:grid sm:grid-cols-12 sm:gap-2 px-0">
          <div className="col-span-2"><span className="text-xs font-medium text-gray-500">Type</span></div>
          <div className="col-span-4"><span className="text-xs font-medium text-gray-500">Drug name</span></div>
          <div className="col-span-2"><span className="text-xs font-medium text-gray-500">Qty</span></div>
          <div className="col-span-2"><span className="text-xs font-medium text-gray-500">Freq</span></div>
          <div className="col-span-2"><span className="text-xs font-medium text-gray-500">Duration</span></div>
        </div>
        {drugs.map((d, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
            {/* Type */}
            <div className="col-span-1 sm:col-span-2">
              {i === 0 && <span className="text-xs font-medium text-gray-500 sm:hidden">Type</span>}
              <select value={d.type} onChange={e => updateDrug(i, 'type', e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm w-full">
                {DRUG_TYPES.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
            {/* Drug name */}
            <div className="col-span-1 sm:col-span-4">
              {i === 0 && <span className="text-xs font-medium text-gray-500 sm:hidden">Drug name</span>}
              <input value={d.name} onChange={e => updateDrug(i, 'name', e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm w-full" />
            </div>
            {/* Qty */}
            <div className="col-span-1 sm:col-span-2">
              {i === 0 && <span className="text-xs font-medium text-gray-500 sm:hidden">Qty</span>}
              <input value={d.qty} onChange={e => updateDrug(i, 'qty', e.target.value)} placeholder="e.g. 30" className="rounded border border-gray-300 p-1.5 text-sm w-full" />
            </div>
            {/* Freq */}
            <div className="col-span-1 sm:col-span-2">
              {i === 0 && <span className="text-xs font-medium text-gray-500 sm:hidden">Freq</span>}
              <select value={d.freq} onChange={e => updateDrug(i, 'freq', e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm w-full">
                {DRUG_FREQS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            </div>
            {/* Duration */}
            <div className="col-span-1 sm:col-span-2">
              {i === 0 && <span className="text-xs font-medium text-gray-500 sm:hidden">Duration</span>}
              <input value={d.duration} onChange={e => updateDrug(i, 'duration', e.target.value)} placeholder="e.g. 5 days" className="rounded border border-gray-300 p-1.5 text-sm w-full" />
            </div>
            {/* Remove button */}
            <div className="col-span-1 flex items-end pb-0.5">
              {drugs.length > 1 && (
                <button type="button" onClick={() => removeDrug(i)} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={addDrug} className="mt-1 w-fit rounded border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          + Add prescription
        </button>
      </div>

      <SectionHeader title="Referral" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Sel label="Referral?" value={hasReferral} onChange={setHasReferral} options={['No', 'Yes']} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">For</span>
          <input value={referralFor} onChange={e => setReferralFor(e.target.value)} disabled={hasReferral === 'No'} className="rounded border border-gray-300 p-1.5 text-sm disabled:opacity-40" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Slated for</span>
          <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} disabled={hasReferral === 'No'} className="rounded border border-gray-300 p-1.5 text-sm disabled:opacity-40" />
        </label>
      </div>

      <SectionHeader title="Next Appointment" />
      <label className="flex flex-col gap-1 max-w-xs">
        <span className="text-xs font-medium text-gray-600">Slated for</span>
        <input type="date" value={nextAppointment} onChange={e => setNextAppointment(e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm" />
      </label>
      <p className="text-xs text-gray-400">This date will appear on the dashboard follow-ups list and create a booked appointment.</p>

      <SectionHeader title="Notes" />
      <YellowTextarea label="" value={notes} onChange={setNotes} rows={4} />

      <button type="submit" disabled={saving} className="mt-4 rounded bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Saving...' : 'Save visit record'}
      </button>
      {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}
    </form>
  )
}
