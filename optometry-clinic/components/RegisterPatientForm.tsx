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
  const [phone1, setPhone1] = useState('')
  const [phone2, setPhone2] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    const patientId = crypto.randomUUID()
    const fullName = [firstName, lastName, otherNames]
      .filter(Boolean)
      .join(' ')

    // Normalise file number — strip whitespace, store as null if empty
    const fn = fileNumber.trim() || null

    const { error } = await supabase.from('patients').insert({
      id: patientId,
      full_name: fullName,
      phone: phone1 || null,
      phone2: phone2 || null,
      sex: sex || null,
      address: address || null,
      notes: notes || null,
      file_number: fn,
    })

    setSaving(false)

    if (error) {
      // Unique constraint violation — file number already taken
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* File number — top of form, most important reference */}
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
            <Field label="Telephone 1">
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
