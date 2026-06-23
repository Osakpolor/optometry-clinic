'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CHARTS = ['Snellen', 'Illiterate E', 'Landot C', 'Children Chart', 'LogMAR']
const VA_TYPES = ['Analog', 'Digital']
const DRUG_TYPES = ['', 'Tab', 'Cap', 'Gutt', 'Oc']
const DRUG_FREQS = ['', 'qds', 'tds', 'bd', 'dly', 'nocte']
const DISC_TYPES = ['', 'Type I', 'Type II', 'Type III', 'Type IV', 'Type V']

type Drug = { type: string; name: string; freq: string }

function strip(val: string | null | undefined, suffix: string): string {
  if (!val) return ''
  return val.toString().replace(suffix, '').replace('6/', '').replace(/^N/, '').trim()
}

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
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className="flex items-center gap-1">
        <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass} flex-1`}>
          <span className="pl-1.5 text-xs text-gray-400 select-none">6/</span>
          <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" />
        </div>
        <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass} w-12`}>
          <input value={addValue} onChange={e => onAddChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" placeholder="add" />
        </div>
      </div>
    </label>
  )
}

function NearInput({ label, value, onChange, colorClass }: { label?: string; value: string; onChange: (v: string) => void; colorClass: string }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className={`flex items-center rounded border text-sm overflow-hidden ${colorClass}`}>
        <span className="pl-1.5 text-xs text-gray-400 select-none">N</span>
        <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent p-1.5 outline-none w-0 min-w-0" />
      </div>
    </label>
  )
}

const OD_CLASS = 'border-pink-200 bg-pink-50'
const OS_CLASS = 'border-green-200 bg-green-50'

function OD({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} className="rounded border border-pink-200 bg-pink-50 p-1.5 text-sm w-full" />
    </label>
  )
}

function OS({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-gray-500">{label}</span>}
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

export default function EditVisitForm({ patientId, visitId, visit }: { patientId: string; visitId: string; visit: any }) {
  const router = useRouter()
  const supabase = createClient()
  const e = visit.eye_test_results ?? {}
  const r = visit.refraction ?? {}
  const ant = visit.anterior_segment ?? {}
  const post = visit.posterior_segment ?? {}
  const meds: any[] = visit.medications ?? []

  const [reasonForVisit, setReasonForVisit] = useState(visit.reason_for_visit ?? '')
  const [symptoms, setSymptoms] = useState(visit.symptoms_presented ?? '')
  const [lastEyeExam, setLastEyeExam] = useState(visit.last_eye_exam ?? '')
  const [age, setAge] = useState(visit.age_at_visit ?? '')
  const [bp, setBp] = useState(visit.bp ?? '')
  const [hasPrx, setHasPrx] = useState(r.has_prx ?? 'No')

  const [sphPrxOD, setSphPrxOD] = useState(r.sph_prx_od ?? '')
  const [cylPrxOD, setCylPrxOD] = useState(r.cyl_prx_od ?? '')
  const [axisPrxOD, setAxisPrxOD] = useState(strip(r.axis_prx_od, '°'))
  const [addPrxOD, setAddPrxOD] = useState(r.add_prx_od ?? '')
  const [sphPrxOS, setSphPrxOS] = useState(r.sph_prx_os ?? '')
  const [cylPrxOS, setCylPrxOS] = useState(r.cyl_prx_os ?? '')
  const [axisPrxOS, setAxisPrxOS] = useState(strip(r.axis_prx_os, '°'))
  const [addPrxOS, setAddPrxOS] = useState(r.add_prx_os ?? '')

  const [vaType, setVaType] = useState(e.va_type ?? 'Analog')
  const [vaChart, setVaChart] = useState(e.va_chart ?? 'Snellen')
  const [vaFarOD, setVaFarOD] = useState(strip(e.va_far_od, ''))
  const [vaFarODAdd, setVaFarODAdd] = useState(e.va_far_od_add ?? '')
  const [vaFarOS, setVaFarOS] = useState(strip(e.va_far_os, ''))
  const [vaFarOSAdd, setVaFarOSAdd] = useState(e.va_far_os_add ?? '')
  const [vaNearOD, setVaNearOD] = useState(strip(e.va_near_od, ''))
  const [vaNearOS, setVaNearOS] = useState(strip(e.va_near_os, ''))
  const [vaPinholeOD, setVaPinholeOD] = useState(strip(e.va_pinhole_od, ''))
  const [vaPinholeODAdd, setVaPinholeODAdd] = useState(e.va_pinhole_od_add ?? '')
  const [vaPinholeOS, setVaPinholeOS] = useState(strip(e.va_pinhole_os, ''))
  const [vaPinholeOSAdd, setVaPinholeOSAdd] = useState(e.va_pinhole_os_add ?? '')
  const [pxVaFarOD, setPxVaFarOD] = useState(strip(e.px_va_far_od, ''))
  const [pxVaFarODAdd, setPxVaFarODAdd] = useState(e.px_va_far_od_add ?? '')
  const [pxVaFarOS, setPxVaFarOS] = useState(strip(e.px_va_far_os, ''))
  const [pxVaFarOSAdd, setPxVaFarOSAdd] = useState(e.px_va_far_os_add ?? '')
  const [pxVaNearOD, setPxVaNearOD] = useState(strip(e.px_va_near_od, ''))
  const [pxVaNearOS, setPxVaNearOS] = useState(strip(e.px_va_near_os, ''))

  const [sphAutoOD, setSphAutoOD] = useState(r.sph_auto_od ?? '')
  const [cylAutoOD, setCylAutoOD] = useState(r.cyl_auto_od ?? '')
  const [axisAutoOD, setAxisAutoOD] = useState(strip(r.axis_auto_od, '°'))
  const [sphAutoOS, setSphAutoOS] = useState(r.sph_auto_os ?? '')
  const [cylAutoOS, setCylAutoOS] = useState(r.cyl_auto_os ?? '')
  const [axisAutoOS, setAxisAutoOS] = useState(strip(r.axis_auto_os, '°'))

  const [iopOD, setIopOD] = useState(strip(e.iop_od, 'mmHg'))
  const [iopOS, setIopOS] = useState(strip(e.iop_os, 'mmHg'))

  const [lidOD, setLidOD] = useState(ant.lid_od ?? '')
  const [conjOD, setConjOD] = useState(ant.conjunctiva_od ?? '')
  const [corneaOD, setCorneaOD] = useState(ant.cornea_od ?? '')
  const [irisOD, setIrisOD] = useState(ant.iris_od ?? '')
  const [pupilOD, setPupilOD] = useState(ant.pupil_od ?? '')
  const [lensOD, setLensOD] = useState(ant.lens_od ?? '')
  const [lidOS, setLidOS] = useState(ant.lid_os ?? '')
  const [conjOS, setConjOS] = useState(ant.conjunctiva_os ?? '')
  const [corneaOS, setCorneaOS] = useState(ant.cornea_os ?? '')
  const [irisOS, setIrisOS] = useState(ant.iris_os ?? '')
  const [pupilOS, setPupilOS] = useState(ant.pupil_os ?? '')
  const [lensOS, setLensOS] = useState(ant.lens_os ?? '')

  const [discOD, setDiscOD] = useState(post.disc_od ?? '')
  const [discOS, setDiscOS] = useState(post.disc_os ?? '')
  const [cupOD, setCupOD] = useState(strip(post.cup_od, '%'))
  const [cupOS, setCupOS] = useState(strip(post.cup_os, '%'))
  const [maculaOD, setMaculaOD] = useState(post.macula_od ?? '')
  const [maculaOS, setMaculaOS] = useState(post.macula_os ?? '')

  const [sphRetOD, setSphRetOD] = useState(r.sph_ret_od ?? '')
  const [cylRetOD, setCylRetOD] = useState(r.cyl_ret_od ?? '')
  const [axisRetOD, setAxisRetOD] = useState(strip(r.axis_ret_od, '°'))
  const [sphRetOS, setSphRetOS] = useState(r.sph_ret_os ?? '')
  const [cylRetOS, setCylRetOS] = useState(r.cyl_ret_os ?? '')
  const [axisRetOS, setAxisRetOS] = useState(strip(r.axis_ret_os, '°'))

  const [sphFinalOD, setSphFinalOD] = useState(r.sph_final_od ?? '')
  const [cylFinalOD, setCylFinalOD] = useState(r.cyl_final_od ?? '')
  const [axisFinalOD, setAxisFinalOD] = useState(strip(r.axis_final_od, '°'))
  const [addFinalOD, setAddFinalOD] = useState(r.add_final_od ?? '')
  const [sphFinalOS, setSphFinalOS] = useState(r.sph_final_os ?? '')
  const [cylFinalOS, setCylFinalOS] = useState(r.cyl_final_os ?? '')
  const [axisFinalOS, setAxisFinalOS] = useState(strip(r.axis_final_os, '°'))
  const [addFinalOS, setAddFinalOS] = useState(r.add_final_os ?? '')

  const [diagnosis, setDiagnosis] = useState(visit.diagnosis ?? '')
  const [drugs, setDrugs] = useState<Drug[]>(
    meds.length > 0
      ? [...meds.map((m: any) => ({ type: m.type ?? '', name: m.name ?? '', freq: m.freq ?? '' })),
         ...Array(Math.max(0, 5 - meds.length)).fill({ type: '', name: '', freq: '' })]
      : Array(5).fill({ type: '', name: '', freq: '' })
  )
  const [hasReferral, setHasReferral] = useState(visit.referral ? 'Yes' : 'No')
  const [referralFor, setReferralFor] = useState(visit.referral ?? '')
  const [refDate, setRefDate] = useState(visit.ref_date ?? '')
  const [notes, setNotes] = useState(visit.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function updateDrug(i: number, field: keyof Drug, val: string) {
    setDrugs(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    setErrorMsg('')

    const medsList = drugs.filter(d => d.name || d.type).map(d => ({
      type: d.type || null, name: d.name || null, freq: d.freq || null
    }))

    const { error } = await supabase.from('visit_records').update({
      reason_for_visit: reasonForVisit || null,
      symptoms_presented: symptoms || null,
      last_eye_exam: lastEyeExam || null,
      age_at_visit: age || null,
      bp: bp || null,
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
      medications: medsList,
      diagnosis: diagnosis || null,
      referral: hasReferral === 'Yes' ? referralFor : null,
      ref_date: refDate || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', visitId)

    setSaving(false)
    if (error) { setErrorMsg(error.message); return }
    router.push(`/dashboard/patients/${patientId}/visits/${visitId}`)
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
      <div className="grid grid-cols-5 gap-2 items-center">
        <ODOSHeader />
        <span className="text-xs text-gray-500">Sphere</span>
        <OD value={sphPrxOD} onChange={setSphPrxOD} /><div />
        <OS value={sphPrxOS} onChange={setSphPrxOS} /><div />
        <span className="text-xs text-gray-500">Cylinder</span>
        <OD value={cylPrxOD} onChange={setCylPrxOD} /><div />
        <OS value={cylPrxOS} onChange={setCylPrxOS} /><div />
        <span className="text-xs text-gray-500">Axis</span>
        <SuffixInput value={axisPrxOD} onChange={setAxisPrxOD} suffix="°" colorClass={OD_CLASS} /><div />
        <SuffixInput value={axisPrxOS} onChange={setAxisPrxOS} suffix="°" colorClass={OS_CLASS} /><div />
        <span className="text-xs text-gray-500">Add</span>
        <OD value={addPrxOD} onChange={setAddPrxOD} /><div />
        <OS value={addPrxOS} onChange={setAddPrxOS} /><div />
      </div>

      <SectionHeader title="Visual Acuity" />
      <div className="grid grid-cols-2 gap-4">
        <Sel label="Type" value={vaType} onChange={setVaType} options={VA_TYPES} />
        <Sel label="Chart used" value={vaChart} onChange={setVaChart} options={CHARTS} />
      </div>
      <p className="text-xs font-semibold uppercase text-gray-400 mt-2">Without Correction</p>
      <div className="grid grid-cols-5 gap-2 items-end">
        <ODOSHeader />
        <span className="text-xs text-gray-500 self-center">@Far</span>
        <FractionInput value={vaFarOD} onChange={setVaFarOD} addValue={vaFarODAdd} onAddChange={setVaFarODAdd} colorClass={OD_CLASS} />
        <div />
        <FractionInput value={vaFarOS} onChange={setVaFarOS} addValue={vaFarOSAdd} onAddChange={setVaFarOSAdd} colorClass={OS_CLASS} />
        <div />
        <span className="text-xs text-gray-500 self-center">@Near</span>
        <NearInput value={vaNearOD} onChange={setVaNearOD} colorClass={OD_CLASS} /><div />
        <NearInput value={vaNearOS} onChange={setVaNearOS} colorClass={OS_CLASS} /><div />
        <span className="text-xs text-gray-500 self-center">Pin Hole</span>
        <FractionInput value={vaPinholeOD} onChange={setVaPinholeOD} addValue={vaPinholeODAdd} onAddChange={setVaPinholeODAdd} colorClass={OD_CLASS} />
        <div />
        <FractionInput value={vaPinholeOS} onChange={setVaPinholeOS} addValue={vaPinholeOSAdd} onAddChange={setVaPinholeOSAdd} colorClass={OS_CLASS} />
        <div />
      </div>
      <p className="text-xs font-semibold uppercase text-gray-400 mt-2">With Correction</p>
      <div className="grid grid-cols-5 gap-2 items-end">
        <ODOSHeader />
        <span className="text-xs text-gray-500 self-center">@Far</span>
        <FractionInput value={pxVaFarOD} onChange={setPxVaFarOD} addValue={pxVaFarODAdd} onAddChange={setPxVaFarODAdd} colorClass={OD_CLASS} />
        <div />
        <FractionInput value={pxVaFarOS} onChange={setPxVaFarOS} addValue={pxVaFarOSAdd} onAddChange={setPxVaFarOSAdd} colorClass={OS_CLASS} />
        <div />
        <span className="text-xs text-gray-500 self-center">@Near</span>
        <NearInput value={pxVaNearOD} onChange={setPxVaNearOD} colorClass={OD_CLASS} /><div />
        <NearInput value={pxVaNearOS} onChange={setPxVaNearOS} colorClass={OS_CLASS} /><div />
      </div>

      <SectionHeader title="Auto-Refraction" />
      <div className="grid grid-cols-5 gap-2 items-center">
        <ODOSHeader />
        <span className="text-xs text-gray-500">Sphere</span>
        <OD value={sphAutoOD} onChange={setSphAutoOD} /><div />
        <OS value={sphAutoOS} onChange={setSphAutoOS} /><div />
        <span className="text-xs text-gray-500">Cylinder</span>
        <OD value={cylAutoOD} onChange={setCylAutoOD} /><div />
        <OS value={cylAutoOS} onChange={setCylAutoOS} /><div />
        <span className="text-xs text-gray-500">Axis</span>
        <SuffixInput value={axisAutoOD} onChange={setAxisAutoOD} suffix="°" colorClass={OD_CLASS} /><div />
        <SuffixInput value={axisAutoOS} onChange={setAxisAutoOS} suffix="°" colorClass={OS_CLASS} /><div />
      </div>

      <SectionHeader title="IOP" />
      <div className="grid grid-cols-2 gap-4">
        <SuffixInput label="IOP OD (right)" value={iopOD} onChange={setIopOD} suffix="mmHg" colorClass={OD_CLASS} />
        <SuffixInput label="IOP OS (left)" value={iopOS} onChange={setIopOS} suffix="mmHg" colorClass={OS_CLASS} />
      </div>

      <SectionHeader title="External Exam (Anterior Segment)" />
      <div className="grid grid-cols-5 gap-2 items-center">
        <div /><div className="col-span-2 text-center text-xs font-semibold text-pink-400">OD</div>
        <div className="col-span-2 text-center text-xs font-semibold text-green-500">OS</div>
        <span className="text-xs text-gray-500">Lid</span>
        <div className="col-span-2"><OD value={lidOD} onChange={setLidOD} /></div>
        <div className="col-span-2"><OS value={lidOS} onChange={setLidOS} /></div>
        <span className="text-xs text-gray-500">Conjunctiva</span>
        <div className="col-span-2"><OD value={conjOD} onChange={setConjOD} /></div>
        <div className="col-span-2"><OS value={conjOS} onChange={setConjOS} /></div>
        <span className="text-xs text-gray-500">Cornea</span>
        <div className="col-span-2"><OD value={corneaOD} onChange={setCorneaOD} /></div>
        <div className="col-span-2"><OS value={corneaOS} onChange={setCorneaOS} /></div>
        <span className="text-xs text-gray-500">Iris</span>
        <div className="col-span-2"><OD value={irisOD} onChange={setIrisOD} /></div>
        <div className="col-span-2"><OS value={irisOS} onChange={setIrisOS} /></div>
        <span className="text-xs text-gray-500">Pupil</span>
        <div className="col-span-2"><OD value={pupilOD} onChange={setPupilOD} /></div>
        <div className="col-span-2"><OS value={pupilOS} onChange={setPupilOS} /></div>
        <span className="text-xs text-gray-500">Lens</span>
        <div className="col-span-2"><OD value={lensOD} onChange={setLensOD} /></div>
        <div className="col-span-2"><OS value={lensOS} onChange={setLensOS} /></div>
      </div>

      <SectionHeader title="Ophthalmoscopy (Posterior Segment)" />
      <div className="grid grid-cols-5 gap-2 items-center">
        <div /><div className="col-span-2 text-center text-xs font-semibold text-pink-400">OD</div>
        <div className="col-span-2 text-center text-xs font-semibold text-green-500">OS</div>
        <span className="text-xs text-gray-500">Disc</span>
        <div className="col-span-2">
          <select value={discOD} onChange={e => setDiscOD(e.target.value)} className="w-full rounded border border-pink-200 bg-pink-50 p-1.5 text-sm">
            {DISC_TYPES.map(o => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <select value={discOS} onChange={e => setDiscOS(e.target.value)} className="w-full rounded border border-green-200 bg-green-50 p-1.5 text-sm">
            {DISC_TYPES.map(o => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        </div>
        <span className="text-xs text-gray-500">Cupping</span>
        <div className="col-span-2"><SuffixInput value={cupOD} onChange={setCupOD} suffix="%" colorClass={OD_CLASS} /></div>
        <div className="col-span-2"><SuffixInput value={cupOS} onChange={setCupOS} suffix="%" colorClass={OS_CLASS} /></div>
        <span className="text-xs text-gray-500">Macula</span>
        <div className="col-span-2"><OD value={maculaOD} onChange={setMaculaOD} /></div>
        <div className="col-span-2"><OS value={maculaOS} onChange={setMaculaOS} /></div>
      </div>

      <SectionHeader title="Retinoscopy" />
      <div className="grid grid-cols-5 gap-2 items-center">
        <ODOSHeader />
        <span className="text-xs text-gray-500">Sphere</span>
        <OD value={sphRetOD} onChange={setSphRetOD} /><div />
        <OS value={sphRetOS} onChange={setSphRetOS} /><div />
        <span className="text-xs text-gray-500">Cylinder</span>
        <OD value={cylRetOD} onChange={setCylRetOD} /><div />
        <OS value={cylRetOS} onChange={setCylRetOS} /><div />
        <span className="text-xs text-gray-500">Axis</span>
        <SuffixInput value={axisRetOD} onChange={setAxisRetOD} suffix="°" colorClass={OD_CLASS} /><div />
        <SuffixInput value={axisRetOS} onChange={setAxisRetOS} suffix="°" colorClass={OS_CLASS} /><div />
      </div>

      <SectionHeader title="Final Prescription" />
      <div className="grid grid-cols-5 gap-2 items-center">
        <ODOSHeader />
        <span className="text-xs text-gray-500">Sphere</span>
        <OD value={sphFinalOD} onChange={setSphFinalOD} /><div />
        <OS value={sphFinalOS} onChange={setSphFinalOS} /><div />
        <span className="text-xs text-gray-500">Cylinder</span>
        <OD value={cylFinalOD} onChange={setCylFinalOD} /><div />
        <OS value={cylFinalOS} onChange={setCylFinalOS} /><div />
        <span className="text-xs text-gray-500">Axis</span>
        <SuffixInput value={axisFinalOD} onChange={setAxisFinalOD} suffix="°" colorClass={OD_CLASS} /><div />
        <SuffixInput value={axisFinalOS} onChange={setAxisFinalOS} suffix="°" colorClass={OS_CLASS} /><div />
        <span className="text-xs text-gray-500">Add</span>
        <OD value={addFinalOD} onChange={setAddFinalOD} /><div />
        <OS value={addFinalOS} onChange={setAddFinalOS} /><div />
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
      <div className="grid grid-cols-3 gap-4">
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
        {saving ? 'Saving...' : 'Save changes'}
      </button>
      {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}
    </form>
  )
}
