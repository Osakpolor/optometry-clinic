'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateStaffRole, toggleStaffActive } from '@/app/actions/staffActions'
import { useRouter } from 'next/navigation'

type StaffMember = {
  id: string
  full_name: string
  email: string | null
  role: string
  is_active: boolean
  created_at: string
}

type Props = {
  staffMembers: StaffMember[]
  currentUserId: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  doctor: 'bg-blue-50 text-blue-700 border-blue-200',
  receptionist: 'bg-green-50 text-green-700 border-green-200',
}

function StaffRow({
  member,
  isSelf,
}: {
  member: StaffMember
  isSelf: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingRole, setEditingRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState(member.role)

  function handleRoleChange() {
    if (selectedRole === member.role) {
      setEditingRole(false)
      return
    }
    startTransition(async () => {
      const result = await updateStaffRole(member.id, selectedRole as any)
      if (result?.error) {
        toast.error(result.error)
        setSelectedRole(member.role)
      } else {
        toast.success(`${member.full_name}'s role updated to ${ROLE_LABELS[selectedRole]}.`)
        router.refresh()
      }
      setEditingRole(false)
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await toggleStaffActive(member.id, !member.is_active)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(
          member.is_active
            ? `${member.full_name} has been deactivated.`
            : `${member.full_name} has been reactivated.`
        )
        router.refresh()
      }
    })
  }

  return (
    <div className={`
      flex flex-col sm:flex-row sm:items-center justify-between
      py-4 gap-3 border-b border-gray-50 last:border-0
      ${!member.is_active ? 'opacity-50' : ''}
    `}>
      {/* Staff info */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {member.full_name}
          </span>
          {isSelf && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
          {!member.is_active && (
            <Badge variant="outline" className="text-xs text-gray-400 border-gray-200">
              Inactive
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {member.email ?? 'No email on record'}
        </span>
        <span className="text-xs text-muted-foreground">
          Joined {new Date(member.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Role badge / editor */}
        {editingRole && !isSelf ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="text-xs border border-input rounded-md px-2 py-1
                         focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={isPending}
            >
              <option value="receptionist">Receptionist</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={handleRoleChange}
              disabled={isPending}
            >
              {isPending ? '…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => { setEditingRole(false); setSelectedRole(member.role) }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            onClick={() => !isSelf && setEditingRole(true)}
            disabled={isSelf}
            className={`${isSelf ? 'cursor-default' : 'cursor-pointer hover:opacity-80'} transition-opacity`}
            title={isSelf ? 'You cannot change your own role' : 'Click to change role'}
          >
            <Badge
              variant="outline"
              className={`text-xs ${ROLE_COLORS[member.role] ?? ''}`}
            >
              {ROLE_LABELS[member.role] ?? member.role}
            </Badge>
          </button>
        )}

        {/* Activate / Deactivate */}
        {!isSelf && (
          <Button
            size="sm"
            variant="outline"
            className={`text-xs h-7 ${
              member.is_active
                ? 'text-red-600 border-red-200 hover:bg-red-50'
                : 'text-green-600 border-green-200 hover:bg-green-50'
            }`}
            onClick={handleToggleActive}
            disabled={isPending}
          >
            {isPending ? '…' : member.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function StaffList({ staffMembers, currentUserId }: Props) {
  if (staffMembers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No staff members found.
      </p>
    )
  }

  return (
    <div>
      {staffMembers.map(member => (
        <StaffRow
          key={member.id}
          member={member}
          isSelf={member.id === currentUserId}
        />
      ))}
    </div>
  )
}
