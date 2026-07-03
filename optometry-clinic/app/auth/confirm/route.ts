import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type: type as 'invite' | 'recovery' | 'email',
      token_hash,
    })

    if (!error) {
      return NextResponse.redirect(new URL('/auth/set-password', request.url))
    }
  }

  // If no token_hash, maybe Supabase already established a session via hash fragment
  // Redirect to a client-side page that can detect the session and redirect
  return NextResponse.redirect(new URL('/auth/set-password', request.url))
}