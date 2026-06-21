'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="mx-auto max-w-sm p-10">
      <h1 className="text-2xl font-semibold">Staff login</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Password</span>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <button type="submit" disabled={loading} className="mt-2 rounded bg-black p-2 text-white disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      </form>
    </main>
  )
}