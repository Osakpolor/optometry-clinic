'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'

function Field({
  label, required, hint, children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-base font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full px-4 py-3 text-base rounded-lg border border-gray-200 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'transition-all bg-white placeholder:text-gray-400'

// Derive age (years) from a date-of-birth string. Returns '' if invalid.
function ageFromDob(dob: string): string {
  if (!dob) return ''
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return ''
  const now = new Date()
  let a = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--
  return a >= 0 && a < 150 ? String(a) : ''
}

const REFERRAL_OPTIONS = [
  'Referred by friend/family',
  'Social Media',
  'Google Search',
  'Signboard',
  'Other',
]

export default function RegisterPatientForm({
  nextFileNumber,
}: {
  nextFileNumber: number
}) {
  const router = useRouter()
  const supabase = createClient()

  const [fileNumber, setFileNumber] = useState(String(nextFileNumber))
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [otherNames, setOtherNames] = useState('')
  const [sex, setSex] = useState('')
  const [age, setAge] = useState('')
  const [dob, setDob] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [occupation, setOccupation] = useState('')
  const [phone1, setPhone1] = useState('')
  const [phone2, setPhone2] = useState('')
  const [address, setAddress] = useState('')
  const [kinName, setKinName] = useState('')
  const [kinRelationship, setKinRelationship] = useState('')
  const [kinPhone, setKinPhone] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [referralDetail, setReferralDetail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // When DOB changes, auto-fill Age (but the user can still override Age).
  function handleDobChange(value: string) {
    setDob(value)
    const derived = ageFromDob(value)
    if (derived) setAge(derived)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    const patientId = crypto.randomUUID()
    const fullName = [firstName, lastName, otherNames]
      .filter(Boolean)
      .join(' ')

    const fn = fileNumber.trim() || null

    const ageInt = age.trim() ? parseInt(age.trim(), 10) : null

    const { error } = await supabase.from('patients').insert({
      id: patientId,
      full_name: fullName,
      phone: phone1 || null,
      phone2: phone2 || null,
      sex: sex || null,
      age: Number.isFinite(ageInt as number) ? ageInt : null,
      date_of_birth: dob || null,
      marital_status: maritalStatus || null,
      occupation: occupation || null,
      address: address || null,
      next_of_kin_name: kinName || null,
      next_of_kin_relationship: kinRelationship || null,
      next_of_kin_phone: kinPhone || null,
      referral_source: referralSource || null,
      referral_detail: referralDetail || null,
      notes: notes || null,
      file_number: fn,
    })

    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        setErrorMsg(
          `File number "${fn}" is already assigned to another patient. ` +
          `Please use a different number.`
        )
      } else {
        setErrorMsg(error.message)
      }
      return
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    router.push(`/dashboard/patients/${patientId}`)
    router.refresh()
  }

  // Whether the chosen referral source needs a free-text detail box
  const referralNeedsDetail =
    referralSource === 'Referred by friend/family' ||
    referralSource === 'Social Media' ||
    referralSource === 'Other'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* File number */}
      <Card className="border-brand/30 bg-brand/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
            File number
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <Field
            label="File number"
            required
            hint="Pre-filled with the next available number. Change it if you need to use a specific number (e.g. filling a gap)."
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-muted-foreground">#</span>
              <input
                required
                value={fileNumber}
                onChange={e => setFileNumber(e.target.value)}
                placeholder={String(nextFileNumber)}
                className={`${inputClass} text-2xl font-bold tracking-tight max-w-[200px]`}
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Personal details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
            Personal details
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="First name" required>
              <input
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                className={inputClass}
              />
            </Field>
            <Field label="Last name" required>
              <input
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Other names">
              <input
                value={otherNames}
                onChange={e => setOtherNames(e.target.value)}
                placeholder="Middle name etc."
                className={inputClass}
              />
            </Field>
            <Field label="Sex">
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger className="py-3 text-base h-auto">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Field label="Date of birth" hint="Optional. If set, age fills in automatically.">
              <input
                type="date"
                value={dob}
                onChange={e => handleDobChange(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Age" hint="Auto-filled from DOB; editable.">
              <input
                type="number"
                min="0"
                max="149"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 34"
                className={inputClass}
              />
            </Field>
            <Field label="Marital status">
              <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                <SelectTrigger className="py-3 text-base h-auto">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married">Married</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Occupation">
            <input
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              placeholder="e.g. Teacher, Trader, Student"
              className={inputClass}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Contact details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
            Contact details
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Telephone 1 (WhatsApp)">
              <input
                value={phone1}
                onChange={e => setPhone1(e.target.value)}
                placeholder="Phone number"
                className={inputClass}
              />
            </Field>
            <Field label="Telephone 2">
              <input
                value={phone2}
                onChange={e => setPhone2(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Address">
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={3}
              placeholder="Street, area, city"
              className={`${inputClass} resize-none`}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Next of kin */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
            Next of kin
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Name">
              <input
                value={kinName}
                onChange={e => setKinName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </Field>
            <Field label="Relationship">
              <input
                value={kinRelationship}
                onChange={e => setKinRelationship(e.target.value)}
                placeholder="e.g. Spouse, Parent, Sibling"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Next of kin's phone number">
            <input
              value={kinPhone}
              onChange={e => setKinPhone(e.target.value)}
              placeholder="Phone number"
              className={inputClass}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Referral source */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
            How did you hear about us?
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 flex flex-col gap-6">
          <Field label="Referral source">
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger className="py-3 text-base h-auto">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {REFERRAL_OPTIONS.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {referralNeedsDetail && (
            <Field
              label={
                referralSource === 'Referred by friend/family'
                  ? 'Referred by whom?'
                  : referralSource === 'Social Media'
                  ? 'Which platform?'
                  : 'Please specify'
              }
            >
              <input
                value={referralDetail}
                onChange={e => setReferralDetail(e.target.value)}
                placeholder={
                  referralSource === 'Social Media'
                    ? 'e.g. Facebook, Instagram, WhatsApp'
                    : 'Details'
                }
                className={inputClass}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Any additional notes about this patient…"
            className={`${inputClass} resize-none bg-yellow-50`}
          />
        </CardContent>
      </Card>

      {errorMsg && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errorMsg}
        </p>
      )}

      <div className="flex items-center justify-between pb-8">
        <p className="text-muted-foreground text-sm">
          Registering as{' '}
          <span className="font-semibold text-foreground">
            File #{fileNumber || '—'}
          </span>
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.push('/dashboard/patients')}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Registering…' : 'Register patient'}
          </Button>
        </div>
      </div>
    </form>
  )
}
