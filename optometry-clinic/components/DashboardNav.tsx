'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import SignOutButton from '@/components/SignOutButton'

type Props = {
  isAdmin: boolean
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/patients', label: 'Patients' },
  { href: '/dashboard/appointments', label: 'Appointments' },
]

export default function DashboardNav({ isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const links = isAdmin
    ? [...NAV_LINKS, { href: '/dashboard/staff', label: 'Staff' }]
    : NAV_LINKS

  return (
    <header className="bg-white sticky top-0 z-10 border-b shadow-sm">
      <nav className="mx-auto flex max-w-5xl items-center justify-between
                      px-4 sm:px-8 py-3">

        {/* Brand */}
        <div className="flex items-center gap-3 sm:gap-6">
          <span className="font-bold text-base sm:text-lg whitespace-nowrap">
            Olu Eye Clinic
          </span>

          {/* Desktop nav links */}
          <div className="hidden sm:flex items-center gap-1">
            <Separator orientation="vertical" className="h-5 mr-2" />
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2 py-1 rounded text-sm transition-colors ${
                  pathname === link.href
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop right side */}
        <div className="hidden sm:flex items-center gap-3">
          <Link href="/dashboard/patients/new">
            <Button size="sm">+ New patient</Button>
          </Link>
          <SignOutButton />
        </div>

        {/* Mobile right side — hamburger only */}
        <div className="flex sm:hidden items-center gap-2">
          <Link href="/dashboard/patients/new">
            <Button size="sm" className="text-xs px-2 py-1 h-8">
              + New
            </Button>
          </Link>
          <button
            onClick={() => setOpen(o => !o)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground
                       hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="sm:hidden border-t border-border bg-white">
          <div className="px-4 py-2 flex flex-col">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm border-b border-gray-50 last:border-0
                            transition-colors ${
                  pathname === link.href
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="py-3">
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
