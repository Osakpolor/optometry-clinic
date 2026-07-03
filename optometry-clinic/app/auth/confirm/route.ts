import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/auth/set-password'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type: type as 'invite' | 'recovery' | 'email',
      token_hash,
    })

    if (!error) {
      // Token verified — redirect to set password page
      return NextResponse.redirect(new URL('/auth/set-password', request.url))
    }
  }

  // Something went wrong — redirect to error page
  return NextResponse.redirect(
    new URL('/auth/error?message=Invalid+or+expired+invite+link', request.url)
  )
}