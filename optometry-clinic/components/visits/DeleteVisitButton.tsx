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
import { deleteVisit } from '@/app/actions/deleteVisit'

// Collapse any run of whitespace to a single space, trim, lowercase —
// same normalization used in DeletePatientButton.
function normalizeName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

type Props = {
  visitId: string
  patientId: string
  patientName: string
  visitDate: string // formatted display date e.g. "14 July 2026"
}

export function DeleteVisitButton({ visitId, patientId, patientName, visitDate }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()

  // The doctor types "DELETE" (case-insensitive) to confirm — a fixed
  // word rather than the patient name, because a visit doesn't have
  // its own unique name to type. Doctors are used to this pattern from
  // other clinical systems.
  const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE'

  function handleOpen() {
    setConfirmText('')
    setOpen(true)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVisit(visitId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Visit record deleted.')
      setOpen(false)
      // Redirect back to the patient profile after deletion
      router.push(`/dashboard/patients/${patientId}`)
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
        Delete visit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">

          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-red-50/80">
            <DialogTitle className="text-base font-semibold text-red-900">
              Delete visit record
            </DialogTitle>
            <p className="text-sm text-red-700/80 mt-0.5">
              This permanently removes the clinical record. It cannot be undone.
            </p>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-800">
                You are about to permanently delete the visit record for{' '}
                <span className="font-semibold">{patientName}</span>{' '}
                on <span className="font-semibold">{visitDate}</span>.
                All clinical data, measurements, and drug prescriptions in this
                record will be lost.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type DELETE to confirm
              </label>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="text-sm font-mono"
                autoComplete="off"
              />
              {confirmText && !isConfirmed && (
                <p className="text-xs text-red-500">
                  Type DELETE (in capitals) to enable the button.
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
              disabled={!isConfirmed || isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? 'Deleting…' : 'Delete visit record'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  )
}
