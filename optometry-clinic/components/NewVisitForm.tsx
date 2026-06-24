'use client'

import React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CHARTS = ['Snellen', 'Illiterate E', 'Landot C', 'Children Chart', 'LogMAR']
const VA_TYPES = ['Analog', 'Digital']
const DRUG_TYPES = ['', 'Tab', 'Cap', 'Gutt', 'Oc']
const DRUG_FREQS = ['', 'qds', 'tds', 'bd', 'dly', 'nocte']
const DISC_TYPES = ['', 'Type I', 'Type II', 'Type III', 'Type IV', 'Type V']

type Drug = { type: string; name: string; freq: string }

function SectionHeader({ title }: { title: string }) {
  return <h3 className="mt-6 border-b border-gray-200 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
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

function SuffixInput({ label, value, onChange, suffix, colorClass }: { label?: string; value: string; onChange: (v: string) => void; suffix: string; colorClass: string }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass}`}>
        <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" />
        {value && <span className="pr-1.5 text-xs text-gray-400 select-none whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  )
}

function FractionInput({ label, value, onChange, addValue, onAddChange, colorClass }: { label?: string; value: string; onChange: (v: string) => void; addValue: string; onAddChange: (v: string) => void; colorClass: string }) {
  const isOD = colorClass.includes('pink')
  return (
    <div className="flex flex-col gap-1">
      {label && <span className={`text-xs font-medium sm:hidden ${isOD ? 'text-pink-400' : 'text-green-500'}`}>{label}</span>}
      <div className="flex items-center gap-1">
        <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass} flex-1`}>
          <span className="pl-1.5 text-xs text-gray-400 select-none">6/</span>
          <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" />
        </div>
        <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass} w-12`}>
          <input value={addValue} onChange={e => onAddChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" placeholder="add" />
        </div>
      </div>
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
      {label && <span className="text-xs font-medium text-gray-600">{label}</span>}
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm">
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </label>
  )
}

function ODOSHeader() {
  return (
    <>
      <div />
      <div className="col-span-2 text-center text-xs font-semibold text-pink-400">OD (Right)</div>
      <div className="col-span-2 text-center text-xs font-semibold text-green-500">OS (Left)</div>
    </>
  )
}

// Mobile-friendly OD/OS row
function EyeRow({ label, odContent, osContent }: { label: string; odContent: React.ReactNode; osContent: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-2 items-end">
      <span className="text-xs text-gray-500 self-center col-span-2 sm:col-span-1">{label}</span>
      <div className="sm:col-span-2">{odContent}</div>
      <div className="sm:col-span-2">{osContent}</div>
    </div>
  )
}

// Mobile OD/OS section header
function EyeColHeaders() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:hidden mb-1">
      <span className="text-xs font-semibold text-pink-400 text-center">OD (Right)</span>
      <span className="text-xs font-semibold text-green-500 text-center">OS (Left)</span>
    </div>
  )
}

export default function NewVisitForm({ patientId, doctorId }: { patientId: string; doctorId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [reasonForVisit, setReasonForVisit] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [lastEyeExam, setLastEyeExam] = useState('')
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
  const [vaFarODAdd, setVaFarODAdd] = useState('')
  const [vaFarOS, setVaFarOS] = useState('')
  const [vaFarOSAdd, setVaFarOSAdd] = useState('')
  const [vaNearOD, setVaNearOD] = useState('')
  const [vaNearOS, setVaNearOS] = useState('')
  const [vaPinholeOD, setVaPinholeOD] = useState('')
  const [vaPinholeODAdd, setVaPinholeODAdd] = useState('')
  const [vaPinholeOS, setVaPinholeOS] = useState('')
  const [vaPinholeOSAdd, setVaPinholeOSAdd] = useState('')
  const [pxVaFarOD, setPxVaFarOD] = useState('')
  const [pxVaFarODAdd, setPxVaFarODAdd] = useState('')
  const [pxVaFarOS, setPxVaFarOS] = useState('')
  const [pxVaFarOSAdd, setPxVaFarOSAdd] = useState('')
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
  const [lidOD, setLidOD] = useState('')
  const [conjOD, setConjOD] = useState('')
  const [corneaOD, setCorneaOD] = useState('')
  const [irisOD, setIrisOD] = useState('')
  const [pupilOD, setPupilOD] = useState('')
  const [lensOD, setLensOD] = useState('')
  const [lidOS, setLidOS] = useState('')
  const [conjOS, setConjOS] = useState('')
  const [corneaOS, setCorneaOS] = useState('')
  const [irisOS, setIrisOS] = useState('')
  const [pupilOS, setPupilOS] = useState('')
  const [lensOS, setLensOS] = useState('')
  const [discOD, setDiscOD] = useState('')
  const [discOS, setDiscOS] = useState('')
  const [cupOD, setCupOD] = useState('')
  const [cupOS, setCupOS] = useState('')
  const [maculaOD, setMaculaOD] = useState('')
  const [maculaOS, setMaculaOS] = useState('')
  const [sphRetOD, setSphRetOD] = useState('')
  const [cylRetOD, setCylRetOD] = useState('')
  const [axisRetOD, setAxisRetOD] = useState('')
  const [sphRetOS, setSphRetOS] = useState('')
  const [cylRetOS, setCylRetOS] = useState('')
  const [axisRetOS, setAxisRetOS] = useState('')
  const [sphFinalOD, setSphFinalOD] = useState('')
  const [cylFinalOD, setCylFinalOD] = useState('')
  const [axisFinalOD, setAxisFinalOD] = useState('')
  const [addFinalOD, setAddFinalOD] = useState('')
  const [sphFinalOS, setSphFinalOS] = useState('')
  const [cylFinalOS, setCylFinalOS] = useState('')
  const [axisFinalOS, setAxisFinalOS] = useState('')
  const [addFinalOS, setAddFinalOS] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [drugs, setDrugs] = useState<Drug[]>([
    { type: '', name: '', freq: '' }, { type: '', name: '', freq: '' },
    { type: '', name: '', freq: '' }, { type: '', name: '', freq: '' },
    { type: '', name: '', freq: '' },
  ])
  const [hasReferral, setHasReferral] = useState('No')
  const [referralFor, setReferralFor] = useState('')
  const [refDate, setRefDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function updateDrug(i: number, field: keyof Drug, val: string) {
    setDrugs(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    const meds = drugs.filter(d => d.name || d.type).map(d => ({ type: d.type || null, name: d.name || null, freq: d.freq || null }))
    const { error } = await supabase.from('visit_records').insert({
      patient_id: patientId, doctor_id: doctorId,
      reason_for_visit: reasonForVisit || null, symptoms_presented: symptoms || null,
      last_eye_exam: lastEyeExam || null, age_at_visit: age || null, bp: bp || null,
      eye_test_results: {
        va_type: vaType, va_chart: vaChart,
        va_far_od: vaFarOD ? `6/${vaFarOD}` : null, va_far_od_add: vaFarODAdd || null,
        va_far_os: vaFarOS ? `6/${vaFarOS}` : null, va_far_os_add: vaFarOSAdd || null,
        va_near_od: vaNearOD ? `N${vaNearOD}` : null, va_near_os: vaNearOS ? `N${vaNearOS}` : null,
        va_pinhole_od: vaPinholeOD ? `6/${vaPinholeOD}` : null, va_pinhole_od_add: vaPinholeODAdd || null,
        va_pinhole_os: vaPinholeOS ? `6/${vaPinholeOS}` : null, va_pinhole_os_add: vaPinholeOSAdd || null,
        px_va_far_od: pxVaFarOD ? `6/${pxVaFarOD}` : null, px_va_far_od_add: pxVaFarODAdd || null,
        px_va_far_os: pxVaFarOS ? `6/${pxVaFarOS}` : null, px_va_far_os_add: pxVaFarOSAdd || null,
        px_va_near_od: pxVaNearOD ? `N${pxVaNearOD}` : null, px_va_near_os: pxVaNearOS ? `N${pxVaNearOS}` : null,
        iop_od: iopOD ? `${iopOD}mmHg` : null, iop_os: iopOS ? `${iopOS}mmHg` : null,
      },
      refraction: {
        has_prx: hasPrx,
        sph_prx_od: sphPrxOD || null, cyl_prx_od: cylPrxOD || null, axis_prx_od: axisPrxOD ? `${axisPrxOD}°` : null, add_prx_od: addPrxOD || null,
        sph_prx_os: sphPrxOS || null, cyl_prx_os: cylPrxOS || null, axis_prx_os: axisPrxOS ? `${axisPrxOS}°` : null, add_prx_os: addPrxOS || null,
        sph_auto_od: sphAutoOD || null, cyl_auto_od: cylAutoOD || null, axis_auto_od: axisAutoOD ? `${axisAutoOD}°` : null,
        sph_auto_os: sphAutoOS || null, cyl_auto_os: cylAutoOS || null, axis_auto_os: axisAutoOS ? `${axisAutoOS}°` : null,
        sph_ret_od: sphRetOD || null, cyl_ret_od: cylRetOD || null, axis_ret_od: axisRetOD ? `${axisRetOD}°` : null,
        sph_ret_os: sphRetOS || null, cyl_ret_os: cylRetOS || null, axis_ret_os: axisRetOS ? `${axisRetOS}°` : null,
        sph_final_od: sphFinalOD || null, cyl_final_od: cylFinalOD || null, axis_final_od: axisFinalOD ? `${axisFinalOD}°` : null, add_final_od: addFinalOD || null,
        sph_final_os: sphFinalOS || null, cyl_final_os: cylFinalOS || null, axis_final_os: axisFinalOS ? `${axisFinalOS}°` : null, add_final_os: addFinalOS || null,
      },
      anterior_segment: {
        lid_od: lidOD || null, conjunctiva_od: conjOD || null, cornea_od: corneaOD || null,
        iris_od: irisOD || null, pupil_od: pupilOD || null, lens_od: lensOD || null,
        lid_os: lidOS || null, conjunctiva_os: conjOS || null, cornea_os: corneaOS || null,
        iris_os: irisOS || null, pupil_os: pupilOS || null, lens_os: lensOS || null,
      },
      posterior_segment: {
        disc_od: discOD || null, disc_os: discOS || null,
        cup_od: cupOD ? `${cupOD}%` : null, cup_os: cupOS ? `${cupOS}%` : null,
        macula_od: maculaOD || null, macula_os: maculaOS || null,
      },
      medications: meds,
      diagnosis: diagnosis || null,
      referral: hasReferral === 'Yes' ? referralFor : null,
      ref_date: refDate || null, notes: notes || null,
    })
    setSaving(false)
    if (error) { setErrorMsg(error.message); return }
    router.push(`/dashboard/patients/${patientId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 text-sm">

      <SectionHeader title="Presenting Complaint" />
      <div className="grid grid-cols-2 gap-4">
        <TextInput label="Age" value={age} onChange={setAge} />
        <TextInput label="Blood pressure" value={bp} onChange={setBp} />
      </div>
      <TextInput label="Reason for visit" value={reasonForVisit} onChange={setReasonForVisit} />
      <TextInput label="Symptoms presented" value={symptoms} onChange={setSymptoms} textarea />
      <TextInput label="Last eye exam" value={lastEyeExam} onChange={setLastEyeExam} textarea />

      <SectionHeader title="Prescription?" />
      <Sel label="Prescription?" value={hasPrx} onChange={setHasPrx} options={['No', 'Yes']} />
      <EyeColHeaders />
      <div className="hidden sm:grid sm:grid-cols-5 sm:gap-2"><ODOSHeader /></div>
      <EyeRow label="Sphere" odContent={<OD value={sphPrxOD} onChange={setSphPrxOD} label="OD" />} osContent={<OS value={sphPrxOS} onChange={setSphPrxOS} label="OS" />} />
      <EyeRow label="Cylinder" odContent={<OD value={cylPrxOD} onChange={setCylPrxOD} label="OD" />} osContent={<OS value={cylPrxOS} onChange={setSphPrxOS} label="OS" />} />
      <EyeRow label="Axis" odContent={<SuffixInput value={axisPrxOD} onChange={setAxisPrxOD} suffix="°" colorClass={OD_CLASS} label="OD" />} osContent={<SuffixInput value={axisPrxOS} onChange={setAxisPrxOS} suffix="°" colorClass={OS_CLASS} label="OS" />} />
      <EyeRow label="Add" odContent={<OD value={addPrxOD} onChange={setAddPrxOD} label="OD" />} osContent={<OS value={addPrxOS} onChange={setAddPrxOS} label="OS" />} />

      <SectionHeader title="Visual Acuity" />
      <div className="grid grid-cols-2 gap-4">
        <Sel label="Type" value={vaType} onChange={setVaType} options={VA_TYPES} />
        <Sel label="Chart used" value={vaChart} onChange={setVaChart} options={CHARTS} />
      </div>

      <p className="text-xs font-semibold uppercase text-gray-400 mt-2">Without Correction</p>
      <EyeColHeaders />
      <div className="hidden sm:grid sm:grid-cols-5 sm:gap-2"><ODOSHeader /></div>
      <div className="flex flex-col gap-3">
        <EyeRow label="@Far"
          odContent={<FractionInput value={vaFarOD} onChange={setVaFarOD} addValue={vaFarODAdd} onAddChange={setVaFarODAdd} colorClass={OD_CLASS} label="OD (Right)" />}
          osContent={<FractionInput value={vaFarOS} onChange={setVaFarOS} addValue={vaFarOSAdd} onAddChange={setVaFarOSAdd} colorClass={OS_CLASS} label="OS (Left)" />}
        />
        <EyeRow label="@Near"
          odContent={<NearInput value={vaNearOD} onChange={setVaNearOD} colorClass={OD_CLASS} label="OD (Right)" />}
          osContent={<NearInput value={vaNearOS} onChange={setVaNearOS} colorClass={OS_CLASS} label="OS (Left)" />}
        />
        <EyeRow label="Pin Hole"
          odContent={<FractionInput value={vaPinholeOD} onChange={setVaPinholeOD} addValue={vaPinholeODAdd} onAddChange={setVaPinholeODAdd} colorClass={OD_CLASS} label="OD (Right)" />}
          osContent={<FractionInput value={vaPinholeOS} onChange={setVaPinholeOS} addValue={vaPinholeOSAdd} onAddChange={setVaPinholeOSAdd} colorClass={OS_CLASS} label="OS (Left)" />}
        />
      </div>

      <p className="text-xs font-semibold uppercase text-gray-400 mt-2">With Correction</p>
      <EyeColHeaders />
      <div className="flex flex-col gap-3">
        <EyeRow label="@Far"
          odContent={<FractionInput value={pxVaFarOD} onChange={setPxVaFarOD} addValue={pxVaFarODAdd} onAddChange={setPxVaFarODAdd} colorClass={OD_CLASS} label="OD (Right)" />}
          osContent={<FractionInput value={pxVaFarOS} onChange={setPxVaFarOS} addValue={pxVaFarOSAdd} onAddChange={setPxVaFarOSAdd} colorClass={OS_CLASS} label="OS (Left)" />}
        />
        <EyeRow label="@Near"
          odContent={<NearInput value={pxVaNearOD} onChange={setPxVaNearOD} colorClass={OD_CLASS} label="OD (Right)" />}
          osContent={<NearInput value={pxVaNearOS} onChange={setPxVaNearOS} colorClass={OS_CLASS} label="OS (Left)" />}
        />
      </div>

      <SectionHeader title="Auto-Refraction" />
      <EyeColHeaders />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphAutoOD} onChange={setSphAutoOD} label="OD" />} osContent={<OS value={sphAutoOS} onChange={setSphAutoOS} label="OS" />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylAutoOD} onChange={setCylAutoOD} label="OD" />} osContent={<OS value={cylAutoOS} onChange={setCylAutoOS} label="OS" />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisAutoOD} onChange={setAxisAutoOD} suffix="°" colorClass={OD_CLASS} label="OD" />} osContent={<SuffixInput value={axisAutoOS} onChange={setAxisAutoOS} suffix="°" colorClass={OS_CLASS} label="OS" />} />
      </div>

      <SectionHeader title="IOP" />
      <div className="grid grid-cols-2 gap-4">
        <SuffixInput label="IOP OD (right)" value={iopOD} onChange={setIopOD} suffix="mmHg" colorClass={OD_CLASS} />
        <SuffixInput label="IOP OS (left)" value={iopOS} onChange={setIopOS} suffix="mmHg" colorClass={OS_CLASS} />
      </div>

      <SectionHeader title="External Exam (Anterior Segment)" />
      <EyeColHeaders />
      <div className="flex flex-col gap-3">
        <EyeRow label="Lid" odContent={<OD value={lidOD} onChange={setLidOD} label="OD" />} osContent={<OS value={lidOS} onChange={setLidOS} label="OS" />} />
        <EyeRow label="Conjunctiva" odContent={<OD value={conjOD} onChange={setConjOD} label="OD" />} osContent={<OS value={conjOS} onChange={setConjOS} label="OS" />} />
        <EyeRow label="Cornea" odContent={<OD value={corneaOD} onChange={setCorneaOD} label="OD" />} osContent={<OS value={corneaOS} onChange={setCorneaOS} label="OS" />} />
        <EyeRow label="Iris" odContent={<OD value={irisOD} onChange={setIrisOD} label="OD" />} osContent={<OS value={irisOS} onChange={setIrisOS} label="OS" />} />
        <EyeRow label="Pupil" odContent={<OD value={pupilOD} onChange={setPupilOD} label="OD" />} osContent={<OS value={pupilOS} onChange={setPupilOS} label="OS" />} />
        <EyeRow label="Lens" odContent={<OD value={lensOD} onChange={setLensOD} label="OD" />} osContent={<OS value={lensOS} onChange={setLensOS} label="OS" />} />
      </div>

      <SectionHeader title="Ophthalmoscopy (Posterior Segment)" />
      <EyeColHeaders />
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
        <EyeRow label="Cupping" odContent={<SuffixInput value={cupOD} onChange={setCupOD} suffix="%" colorClass={OD_CLASS} label="OD" />} osContent={<SuffixInput value={cupOS} onChange={setCupOS} suffix="%" colorClass={OS_CLASS} label="OS" />} />
        <EyeRow label="Macula" odContent={<OD value={maculaOD} onChange={setMaculaOD} label="OD" />} osContent={<OS value={maculaOS} onChange={setMaculaOS} label="OS" />} />
      </div>

      <SectionHeader title="Retinoscopy" />
      <EyeColHeaders />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphRetOD} onChange={setSphRetOD} label="OD" />} osContent={<OS value={sphRetOS} onChange={setSphRetOS} label="OS" />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylRetOD} onChange={setCylRetOD} label="OD" />} osContent={<OS value={cylRetOS} onChange={setCylRetOS} label="OS" />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisRetOD} onChange={setAxisRetOD} suffix="°" colorClass={OD_CLASS} label="OD" />} osContent={<SuffixInput value={axisRetOS} onChange={setAxisRetOS} suffix="°" colorClass={OS_CLASS} label="OS" />} />
      </div>

      <SectionHeader title="Final Prescription" />
      <EyeColHeaders />
      <div className="flex flex-col gap-3">
        <EyeRow label="Sphere" odContent={<OD value={sphFinalOD} onChange={setSphFinalOD} label="OD" />} osContent={<OS value={sphFinalOS} onChange={setSphFinalOS} label="OS" />} />
        <EyeRow label="Cylinder" odContent={<OD value={cylFinalOD} onChange={setCylFinalOD} label="OD" />} osContent={<OS value={cylFinalOS} onChange={setCylFinalOS} label="OS" />} />
        <EyeRow label="Axis" odContent={<SuffixInput value={axisFinalOD} onChange={setAxisFinalOD} suffix="°" colorClass={OD_CLASS} label="OD" />} osContent={<SuffixInput value={axisFinalOS} onChange={setAxisFinalOS} suffix="°" colorClass={OS_CLASS} label="OS" />} />
        <EyeRow label="Add" odContent={<OD value={addFinalOD} onChange={setAddFinalOD} label="OD" />} osContent={<OS value={addFinalOS} onChange={setAddFinalOS} label="OS" />} />
      </div>

      <SectionHeader title="Diagnosis" />
      <TextInput label="" value={diagnosis} onChange={setDiagnosis} textarea />

      <SectionHeader title="Drug Prescription" />
      {drugs.map((d, i) => (
        <div key={i} className="grid grid-cols-7 gap-2 items-end">
          <Sel label={i === 0 ? 'Type' : ''} value={d.type} onChange={v => updateDrug(i, 'type', v)} options={DRUG_TYPES} />
          <div className="col-span-4">
            <label className="flex flex-col gap-1">
              {i === 0 && <span className="text-xs font-medium text-gray-600">Drug name</span>}
              <input value={d.name} onChange={e => updateDrug(i, 'name', e.target.value)} className="rounded border border-gray-300 p-1.5 text-sm w-full" />
            </label>
          </div>
          <div className="col-span-2">
            <Sel label={i === 0 ? 'Frequency' : ''} value={d.freq} onChange={v => updateDrug(i, 'freq', v)} options={DRUG_FREQS} />
          </div>
        </div>
      ))}

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

      <SectionHeader title="Notes" />
      <TextInput label="" value={notes} onChange={setNotes} textarea />

      <button type="submit" disabled={saving} className="mt-4 rounded bg-black px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Saving...' : 'Save visit record'}
      </button>
      {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}
    </form>
  )
}
