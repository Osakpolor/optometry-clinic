'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [userName, setUserName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // No active session — invite link wasn't used correctly
        router.push('/login')
        return
      }

      // Grab their name from staff_profiles to personalise the page
      const { data: profile } = await supabase
        .from('staff_profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()

      if (profile?.full_name) {
        setUserName(profile.full_name)
      }

      setChecking(false)
    }

    checkSession()
  }, [router, supabase])

  async function handleSetPassword() {
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // Password set — take them straight to the dashboard
    router.push('/dashboard')
  }

  // Show a neutral loading state while we verify the session
  if (checking) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#0d7b5f] border-t-transparent
                          rounded-full animate-spin" />
          <p className="text-sm text-[#6b7280]">Verifying your invitation…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12
                          bg-[#0d7b5f]/10 rounded-full mb-4">
            <svg className="w-6 h-6 text-[#0d7b5f]" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#171717] tracking-tight">
            Olu Eye Clinic
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            {userName
              ? `Welcome, ${userName.split(' ')[0]}! Set your password to get started.`
              : 'Set your password to activate your staff account.'}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-[#e5e7eb] rounded-lg p-6
                        shadow-sm space-y-4">

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#171717]">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              className="w-full h-10 px-3 text-sm border border-[#e5e7eb] rounded-md
                         outline-none focus:ring-2 focus:ring-[#0d7b5f]/30
                         focus:border-[#0d7b5f] text-[#171717]
                         placeholder:text-[#9ca3af] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#171717]">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
              className="w-full h-10 px-3 text-sm border border-[#e5e7eb] rounded-md
                         outline-none focus:ring-2 focus:ring-[#0d7b5f]/30
                         focus:border-[#0d7b5f] text-[#171717]
                         placeholder:text-[#9ca3af] transition-colors"
            />
          </div>

          {/* Password strength hint */}
          {password.length > 0 && password.length < 8 && (
            <p className="text-xs text-amber-600">
              {8 - password.length} more character{8 - password.length !== 1 ? 's' : ''} needed
            </p>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200
                            rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleSetPassword}
            disabled={loading || password.length < 8 || password !== confirmPassword}
            className="w-full h-10 bg-[#0d7b5f] hover:bg-[#0a6b52]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-white text-sm font-medium rounded-md
                       transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent
                                rounded-full animate-spin" />
                Activating…
              </span>
            ) : (
              'Activate my account'
            )}
          </button>
        </div>

        <p className="text-center text-xs text-[#9ca3af] mt-4">
          Need help? Contact your administrator.
        </p>

      </div>
    </div>
  )
}
