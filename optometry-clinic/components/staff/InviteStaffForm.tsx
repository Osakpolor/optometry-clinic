'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { inviteStaffMember } from '@/app/actions/staffActions'

const ROLES = [
  { value: 'receptionist', label: 'Receptionist', description: 'Can register patients, book appointments, record visits' },
  { value: 'doctor', label: 'Doctor / Optometrist', description: 'Full clinical access, can record and edit EMR visits' },
  { value: 'admin', label: 'Admin', description: 'Full access including staff management and patient deletion' },
] as const

type Role = 'receptionist' | 'doctor' | 'admin'

export function InviteStaffForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('receptionist')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await inviteStaffMember(email.trim(), fullName.trim(), role)
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Invitation sent to ${email}. They'll receive an email to set their password.`)
    setFullName('')
    setEmail('')
    setRole('receptionist')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name + Email row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Full name
          </label>
          <Input
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Dr. Chukwuma Eze"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Email address
          </label>
          <Input
            required
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="doctor@olueye.clinic"
            className="text-sm"
          />
        </div>
      </div>

      {/* Role selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Role
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ROLES.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`
                text-left rounded-lg border px-4 py-3 transition-all
                ${role === r.value
                  ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                  : 'border-border hover:border-gray-300 bg-white'
                }
              `}
            >
              <p className={`text-sm font-medium ${role === r.value ? 'text-brand' : 'text-gray-800'}`}>
                {r.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {r.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? 'Sending invite…' : 'Send invitation'}
        </Button>
      </div>
    </form>
  )
}
