'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email = emailRef.current?.value.trim() ?? ''
    const password = passwordRef.current?.value ?? ''
    if (!email || !password) return

    setLoading(true)
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErrorMsg(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Staff login</CardTitle>
          <CardDescription>Sign in to access the clinic dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" ref={emailRef} required type="email" placeholder="doctor@olueyeclinic.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-brand hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input id="password" ref={passwordRef} required type="password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            {errorMsg && <p className="text-sm text-red-500 text-center">{errorMsg}</p>}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}