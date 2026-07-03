'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') ?? 'Something went wrong.'

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-[#171717] tracking-tight mb-2">
          Invite link invalid
        </h1>
        <p className="text-[14px] text-[#6b7280] mb-6">
          {message}
        </p>
        <p className="text-[13px] text-[#6b7280]">
          Please ask your administrator to send a new invite.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-[14px] text-[#0d7b5f] hover:underline font-medium"
        >
          Go to staff login
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