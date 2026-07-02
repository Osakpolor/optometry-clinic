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
import { deletePatient } from '@/app/actions/deletePatient'

type Props = {
  patientId: string
  patientName: string
}

export function DeletePatientButton({ patientId, patientName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [isPending, startTransition] = useTransition()

  const nameMatches = confirmName.trim().toLowerCase() === patientName.trim().toLowerCase()

  function handleOpen() {
    setConfirmName('')
    setOpen(true)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePatient(patientId)

      if (result?.error) {
        toast.error(result.error)
        return
      }

      toast.success(`${patientName}'s record has been archived.`)
      setOpen(false)
      router.push('/dashboard/patients')
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">

          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-red-50/80">
            <DialogTitle className="text-base font-semibold text-red-900">
              Archive patient record
            </DialogTitle>
            <p className="text-sm text-red-700/80 mt-0.5">
              This will hide the patient and all their visits from the system.
              The data is not permanently deleted and can be restored by
              contacting support.
            </p>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800">
                You are about to archive{' '}
                <span className="font-semibold">{patientName}</span>.
                Their visit history, appointments, and clinical records
                will all be hidden.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type the patient's full name to confirm
              </label>
              <Input
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={patientName}
                className="text-sm"
                autoComplete="off"
              />
              {confirmName && !nameMatches && (
                <p className="text-xs text-red-500">
                  Name doesn't match. Please type exactly: {patientName}
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
              {isPending ? 'Archiving…' : 'Archive patient'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  )
}
