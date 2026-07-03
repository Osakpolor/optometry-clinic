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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // No session at all — send to login
        router.push('/login')
        return
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

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <p className="text-[14px] text-[#6b7280]">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#171717] tracking-tight">
            Olu Eye Clinic
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Set your password to activate your staff account
          </p>
        </div>

        <div className="bg-white border border-[#e5e7eb] rounded-[6px] p-6 shadow-sm space-y-4">

          <div className="space-y-1">
            <label className="text-[14px] font-medium text-[#171717]">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full h-9 px-3 text-[14px] border border-[#e5e7eb] rounded-[6px] outline-none focus:ring-2 focus:ring-[#0d7b5f] focus:border-transparent text-[#171717] placeholder:text-[#9ca3af]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[14px] font-medium text-[#171717]">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full h-9 px-3 text-[14px] border border-[#e5e7eb] rounded-[6px] outline-none focus:ring-2 focus:ring-[#0d7b5f] focus:border-transparent text-[#171717] placeholder:text-[#9ca3af]"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSetPassword}
            disabled={loading}
            className="w-full h-9 bg-[#0d7b5f] hover:bg-[#0a6b52] disabled:opacity-50 text-white text-[14px] font-medium rounded-[6px] transition-colors"
          >
            {loading ? 'Activating account...' : 'Activate account'}
          </button>
        </div>

        <p className="text-center text-[13px] text-[#6b7280] mt-4">
          Need help? Contact your administrator.
        </p>

      </div>
    </div>
  )
}