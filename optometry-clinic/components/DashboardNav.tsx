'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { Menu, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import SignOutButton from '@/components/SignOutButton'
import { createClient } from '@/lib/supabase/client'
import { getUnreadThreadCount } from '@/app/actions/conversationBadges'

type Props = {
  isAdmin: boolean
  // True for anyone who can manage appointments (admin / doctor / receptionist)
  // — the single rule that also gates the Scheduling page and its actions.
  canSchedule?: boolean
}

type NavLink = { href: string; label: string }

export default function DashboardNav({ isAdmin, canSchedule = false }: Props) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  useEffect(() => { pathRef.current = pathname }, [pathname])

  // Primary nav: Dashboard, Patients, Scheduling, Conversations.
  const primaryLinks: NavLink[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/patients', label: 'Patients' },
    ...(canSchedule ? [{ href: '/dashboard/scheduling', label: 'Scheduling' }] : []),
    { href: '/dashboard/conversations', label: 'Conversations' },
  ]

  // Admin/config items, grouped under an "Admin" menu. Admin-only — same access
  // as before (these were all admin-only); a non-admin never sees the menu.
  const adminLinks: NavLink[] = isAdmin
    ? [
        { href: '/dashboard/broadcasts', label: 'Broadcasts' },
        { href: '/dashboard/staff', label: 'Staff' },
        { href: '/dashboard/audit', label: 'Audit' },
      ]
    : []
  const adminActive = adminLinks.some(l => pathname === l.href)

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

  function label(link: NavLink) {
    const showBadge = link.label === 'Conversations' && unread > 0
    return (
      <span className="inline-flex items-center gap-1.5">
        {link.label}
        {showBadge && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-brand text-white">
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
            {primaryLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1 rounded text-sm transition-colors ${
                  pathname === link.href
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label(link)}
              </Link>
            ))}

            {/* Admin menu — admin only */}
            {adminLinks.length > 0 && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors outline-none',
                      adminActive
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground',
                      'aria-expanded:text-foreground'
                    )}
                  >
                    Admin <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 min-w-[9rem] rounded-md border border-gray-200 bg-white p-1 shadow-md"
                  >
                    {adminLinks.map(l => (
                      <DropdownMenu.Item key={l.href} asChild>
                        <Link
                          href={l.href}
                          className={cn(
                            'flex cursor-pointer rounded px-2 py-1.5 text-sm outline-none hover:bg-muted focus:bg-muted',
                            pathname === l.href ? 'text-foreground font-medium' : 'text-gray-700'
                          )}
                        >
                          {l.label}
                        </Link>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
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
            {primaryLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm border-b border-gray-50 last:border-0 transition-colors ${
                  pathname === link.href ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {label(link)}
              </Link>
            ))}

            {/* Admin group — admin only */}
            {adminLinks.length > 0 && (
              <div className="mt-1 border-t border-gray-100 pt-2">
                <p className="pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Admin</p>
                {adminLinks.map(l => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`block py-2.5 text-sm transition-colors ${
                      pathname === l.href ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="py-3"><SignOutButton /></div>
          </div>
        </div>
      )}
    </header>
  )
}
