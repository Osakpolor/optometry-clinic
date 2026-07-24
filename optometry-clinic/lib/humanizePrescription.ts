// lib/humanizePrescription.ts
//
// Translates a doctor's clinical shorthand prescription into plain,
// patient-friendly language — used ONLY for patient-facing messages
// (WhatsApp). Doctors continue to see the compact clinical form in the app.
//
// Design: the UNIT for a quantity is derived from the drug TYPE, not from
// the letter case of the quantity (doctors won't reliably type i vs I).
//   Gutt (eye drop) → quantity counted in "drop(s)"
//   Tab / Cap       → quantity counted as tablet(s)/capsule(s) (no "drop")
//   Oc (ointment)   → "apply" (not counted)
//   Syr (syrup)     → dose as given (ml/spoon), passed through
//
// Anything not recognised is passed through unchanged, so custom free-text
// (e.g. a typed frequency like "every 4 hrs") is never dropped or mangled.

type Drug = {
  type?: string | null
  name?: string | null
  qty?: string | null
  freq?: string | null
  duration?: string | null
}

// Drug type → { form label, counted unit (singular/plural), verb }
const TYPE_MAP: Record<string, { form: string; unit?: [string, string]; verb: string }> = {
  tab:  { form: 'tablet',    unit: ['tablet', 'tablets'],   verb: 'take' },
  cap:  { form: 'capsule',   unit: ['capsule', 'capsules'], verb: 'take' },
  gutt: { form: 'eye drops', unit: ['drop', 'drops'],       verb: 'instil' },
  oc:   { form: 'eye ointment',                              verb: 'apply' },
  syr:  { form: 'syrup',                                     verb: 'take' },
}

// Frequency shorthand → plain words
const FREQ_MAP: Record<string, string> = {
  od:    'once daily',
  om:    'every morning',
  on:    'every night',
  bd:    'twice daily',
  tds:   'three times daily',
  qds:   'four times daily',
  nocte: 'at night',
  mane:  'in the morning',
  prn:   'as needed',
  stat:  'immediately',
  dly:   'daily',
  hourly:'every hour',
}

// Roman-numeral / count shorthand → number word
const QTY_MAP: Record<string, string> = {
  i: 'one', ii: 'two', iii: 'three', iv: 'four', v: 'five',
  '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
}

function humanizeQty(qty: string, type: string): string {
  const key = qty.trim().toLowerCase()
  const word = QTY_MAP[key]
  const t = TYPE_MAP[type]

  // Counted forms (drops, tablets, capsules) get a unit
  if (word && t?.unit) {
    const [singular, plural] = t.unit
    const unit = word === 'one' ? singular : plural
    return `${word} ${unit}`
  }

  // Recognised number but uncounted form (ointment/syrup) — just the number
  if (word) return word

  // Unrecognised (e.g. "5ml", "1/2 spoon") — pass through untouched
  return qty.trim()
}

function humanizeFreq(freq: string): string {
  const key = freq.trim().toLowerCase()
  // Recognised shorthand → words; otherwise pass through (custom free-text)
  return FREQ_MAP[key] ?? freq.trim()
}

/**
 * Turn one drug into a patient-friendly sentence fragment.
 * e.g. { Gutt, Hypromellose, i, tds, 2 weeks }
 *   → "Hypromellose eye drops — instil one drop, three times daily, for 2 weeks"
 */
export function humanizePrescription(drug: Drug): string {
  const typeKey = (drug.type ?? '').trim().toLowerCase()
  const t = TYPE_MAP[typeKey]
  const name = (drug.name ?? '').trim()

  const parts: string[] = []

  // "Hypromellose eye drops" / "Amoxicillin tablet"
  if (name && t) {
    parts.push(`${name} ${t.form}`)
  } else if (name) {
    parts.push(name)
  } else if (t) {
    parts.push(t.form)
  }

  // Build the instruction: verb + qty + freq
  const instruction: string[] = []
  if (drug.qty && drug.qty.trim()) {
    const qtyText = humanizeQty(drug.qty, typeKey)
    const verb = t?.verb ?? 'take'
    instruction.push(`${verb} ${qtyText}`)
  }
  if (drug.freq && drug.freq.trim()) {
    instruction.push(humanizeFreq(drug.freq))
  }
  if (drug.duration && drug.duration.trim()) {
    instruction.push(`for ${drug.duration.trim()}`)
  }

  const head = parts.join(' ')
  const tail = instruction.join(', ')

  if (head && tail) return `${head} — ${tail}`
  return head || tail || ''
}

/**
 * Humanize a whole prescription list into one patient-friendly string.
 * Joined with "; " (never newlines — WhatsApp template params reject them).
 */
export function humanizePrescriptionList(meds: Drug[]): string {
  if (!meds || meds.length === 0) return 'None prescribed at this visit.'

  const lines = meds
    .filter(m => m.name || m.type)
    .map(humanizePrescription)
    .filter(Boolean)

  const joined = lines.length > 0 ? lines.join('; ') : 'None prescribed at this visit.'
  // Safety: strip anything WhatsApp template params reject
  return joined.replace(/[\n\t]+/g, ' ').replace(/\s{4,}/g, ' ').trim()
}