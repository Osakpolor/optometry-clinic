'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import SignOutButton from '@/components/SignOutButton'
import { createClient } from '@/lib/supabase/client'
import { getUnreadThreadCount } from '@/app/actions/conversationBadges'

type Props = {
  isAdmin: boolean
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/patients', label: 'Patients' },
  { href: '/dashboard/appointments', label: 'Appointments' },
  { href: '/dashboard/conversations', label: 'Conversations' },
]

export default function DashboardNav({ isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])

  const links = isAdmin
    ? [...NAV_LINKS, { href: '/dashboard/staff', label: 'Staff' }, { href: '/dashboard/audit', label: 'Audit' }]
    : NAV_LINKS

  // Recompute the unread count on mount and whenever the route changes
  // (opening the inbox marks threads read, so leaving it refreshes the badge).
  useEffect(() => {
    let active = true
    getUnreadThreadCount().then(n => { if (active) setUnread(n) }).catch(() => {})
    return () => { active = false }
  }, [pathname])

  // Live bump on a new inbound message, unless the inbox is already open.
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('nav-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' }, payload => {
        const row = payload.new as any
        if (row.role !== 'user') return
        if (pathRef.current.startsWith('/dashboard/conversations')) return
        setUnread(c => c + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function label(link: { href: string; label: string }, mobile = false) {
    const showBadge = link.label === 'Conversations' && unread > 0
    return (
      <span className="inline-flex items-center gap-1.5">
        {link.label}
        {showBadge && (
          <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-brand text-white ${mobile ? '' : ''}`}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </span>
    )
  }

  return (
    <header className="bg-white sticky top-0 z-10 border-b shadow-sm">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-8 py-3">
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="font-bold text-base sm:text-lg whitespace-nowrap">Olu Eye Clinic</span>
          <div className="hidden sm:flex items-center gap-1">
            <Separator orientation="vertical" className="h-5 mr-2" />
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1 rounded text-sm transition-colors ${
                  pathname === link.href ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label(link)}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <Link href="/dashboard/patients/new">
            <Button size="sm">+ New patient</Button>
          </Link>
          <SignOutButton />
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <Link href="/dashboard/patients/new">
            <Button size="sm" className="text-xs px-2 py-1 h-8">+ New</Button>
          </Link>
          <button
            onClick={() => setOpen(o => !o)}
            className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {!open && unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" />
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div className="sm:hidden border-t border-border bg-white">
          <div className="px-4 py-2 flex flex-col">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm border-b border-gray-50 last:border-0 transition-colors ${
                  pathname === link.href ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {label(link, true)}
              </Link>
            ))}
            <div className="py-3"><SignOutButton /></div>
          </div>
        </div>
      )}
    </header>
  )
}
