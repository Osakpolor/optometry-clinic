'use client'

import Link from 'next/link'

type Props = {
  pendingCount: number
}

export default function RebookFlashBar({ pendingCount }: Props) {
  if (pendingCount === 0) return null

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Pulse dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <p className="text-sm text-amber-800 font-medium">
            {pendingCount === 1
              ? '1 patient has requested to reschedule their appointment.'
              : `${pendingCount} patients have requested to reschedule their appointments.`}
          </p>
        </div>
        <Link
          href="/dashboard/rebooking"
          className="text-sm font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
        >
          Review now →
        </Link>
      </div>
    </div>
  )
}