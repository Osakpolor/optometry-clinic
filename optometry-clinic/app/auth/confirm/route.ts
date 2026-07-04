import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // Supabase sends the invite token as a query param when the
  // email template uses {{ .TokenHash }}. We exchange it here
  // server-side, which creates a session, then redirect the
  // staff member to the set-password page.
  if (token_hash && type === 'invite') {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type: 'invite',
      token_hash,
    })

    if (!error) {
      // Session is now active — send to set-password
      return NextResponse.redirect(`${origin}/auth/set-password`)
    }

    // Token exchange failed (expired, already used etc.)
    return NextResponse.redirect(
      `${origin}/auth/error?message=Invite+link+expired+or+already+used`
    )
  }

  // No token in URL — send to login
  return NextResponse.redirect(`${origin}/login`)
}
