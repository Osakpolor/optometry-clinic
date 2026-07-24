'use client'

// components/visits/SendClinicalSummaryButton.tsx
// Doctor control (Option A) — sits in the visit detail header.
// Shows one of two states:
//   • Not sent → a "Send diagnosis & prescription" button + hint line
//   • Sent     → a green confirmation with the send time + Resend link

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sendClinicalSummary } from '@/app/actions/sendClinicalSummary'

type Props = {
  visitId: string
  sentAt: string | null
  hasDiagnosis: boolean
}

export function SendClinicalSummaryButton({ visitId, sentAt, hasDiagnosis }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localSentAt, setLocalSentAt] = useState<string | null>(sentAt)

  function handleSend() {
    if (!hasDiagnosis) {
      toast.error('Add a diagnosis before sending the clinical summary.')
      return
    }
    startTransition(async () => {
      const result = await sendClinicalSummary(visitId)
      if (result.success) {
        toast.success('Clinical summary sent to patient.')
        setLocalSentAt(new Date().toISOString())
        router.refresh()
      } else {
        toast.error(result.error ?? 'Could not send summary.')
      }
    })
  }

  if (localSentAt) {
    const when = new Date(localSentAt).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
        <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs text-green-700">
          Clinical summary sent to patient on {when}.
          <button
            onClick={handleSend}
            disabled={isPending}
            className="ml-1.5 underline hover:text-green-900 disabled:opacity-50"
          >
            {isPending ? 'Resending…' : 'Resend'}
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="text-xs text-muted-foreground">
        Patient received the thank-you message. Clinical summary not yet sent.
      </span>
      <button
        onClick={handleSend}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        {isPending ? 'Sending…' : 'Send diagnosis & prescription'}
      </button>
    </div>
  )
}
