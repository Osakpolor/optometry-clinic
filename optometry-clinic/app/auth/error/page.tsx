'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
  const params = useSearchParams()
  const message = params.get('message') ?? 'Something went wrong.'

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12
                        bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[#171717] mb-2">
          Invite link issue
        </h1>
        <p className="text-sm text-[#6b7280] mb-6">
          {decodeURIComponent(message)}
        </p>
        <p className="text-sm text-[#6b7280] mb-6">
          Please ask your administrator to send a fresh invitation.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center h-9 px-4
                     bg-[#0d7b5f] text-white text-sm font-medium
                     rounded-md hover:bg-[#0a6b52] transition-colors"
        >
          Go to login
        </Link>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
