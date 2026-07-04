'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { deleteStaffMember } from '@/app/actions/staffActions'

// Collapse any run of whitespace to a single space, trim, lowercase —
// so confirmation is tolerant of invisible whitespace differences.
function normalizeName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

type Props = {
  staffId: string
  staffName: string
}

export function DeleteStaffButton({ staffId, staffName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [isPending, startTransition] = useTransition()

  const nameMatches = normalizeName(confirmName) === normalizeName(staffName)

  function handleOpen() {
    setConfirmName('')
    setOpen(true)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteStaffMember(staffId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${staffName} has been deleted.`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
      >
        <Trash2 className="w-3 h-3 mr-1" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-red-50/80">
            <DialogTitle className="text-base font-semibold text-red-900">
              Delete staff member
            </DialogTitle>
            <p className="text-sm text-red-700/80 mt-0.5">
              This permanently removes the staff account and login access.
              Staff who have recorded clinical visits cannot be deleted —
              deactivate them instead.
            </p>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800">
                You are about to permanently delete{' '}
                <span className="font-semibold">{staffName}</span>.
                Their login will stop working immediately. This cannot be undone.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type the staff member's full name to confirm
              </label>
              <Input
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={staffName}
                className="text-sm"
                autoComplete="off"
              />
              {confirmName && !nameMatches && (
                <p className="text-xs text-red-500">
                  Name doesn't match. Please type exactly: {staffName}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-gray-50/80 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!nameMatches || isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? 'Deleting…' : 'Delete staff member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}