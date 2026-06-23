'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SiteNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/dashboard')) return null

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-semibold text-gray-900">
          Olu Eye Clinic
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/services" className="text-gray-500 hover:text-gray-900 transition-colors">
            Services
          </Link>
          <Link href="/book" className="text-gray-500 hover:text-gray-900 transition-colors">
            Book appointment
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">Staff login</Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}