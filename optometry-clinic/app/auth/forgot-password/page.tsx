'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const emailRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email = emailRef.current?.value.trim() ?? ''
    if (!email) return

    setLoading(true)
    setErrorMsg('')

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/set-password`,
    })

    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    // Always show success even if the email isn't registered — this avoids
    // revealing which emails have accounts (a standard security practice).
    setSent(true)
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            {sent
              ? 'Check your email for a reset link.'
              : 'Enter your email and we\u2019ll send you a reset link.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4 text-center">
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-sm text-green-800">
                  If an account exists for that email, a password reset link
                  is on its way. It expires in 1 hour.
                </p>
              </div>
              <Link href="/login" className="text-sm text-brand hover:underline">
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  ref={emailRef}
                  required
                  type="email"
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
              {errorMsg && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
              )}
              <Link
                href="/login"
                className="text-sm text-brand hover:underline text-center"
              >
                ← Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}