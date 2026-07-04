'use client'

import { useRef, useState } from 'react'
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
  const fullNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const [role, setRole] = useState<Role>('receptionist')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fullName = fullNameRef.current?.value.trim() ?? ''
    const email = emailRef.current?.value.trim() ?? ''
    if (!fullName || !email) return

    setLoading(true)
    const result = await inviteStaffMember(email, fullName, role)
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }

    toast.success(`Invitation sent to ${email}. They'll receive an email to set their password.`)
    if (fullNameRef.current) fullNameRef.current.value = ''
    if (emailRef.current) emailRef.current.value = ''
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
            ref={fullNameRef}
            required
            placeholder="Dr. Chukwuma Eze"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Email address
          </label>
          <Input
            ref={emailRef}
            required
            type="email"
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