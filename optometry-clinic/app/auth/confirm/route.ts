import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  const setPasswordUrl = new URL('/auth/set-password', request.url)
  const errorUrl = new URL('/auth/error', request.url)
  const loginUrl = new URL('/login', request.url)

  const supabase = await createClient()

  // Handle PKCE code exchange (newer Supabase format)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(setPasswordUrl)
    }
  }

  // Handle token_hash format (older Supabase format)
  if (token_hash && type === 'invite') {
    const { error } = await supabase.auth.verifyOtp({
      type: 'invite',
      token_hash,
    })

    if (!error) {
      return NextResponse.redirect(setPasswordUrl)
    }

    errorUrl.searchParams.set(
      'message',
      'Invite link expired or already used. Ask your admin to resend.'
    )
    return NextResponse.redirect(errorUrl)
  }

  return NextResponse.redirect(loginUrl)
}