'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function SiteNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  if (pathname.startsWith('/dashboard')) return null

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6 py-3">
        <Link href="/" className="font-bold text-base sm:text-lg">
          Olu Eye Clinic
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <Link href="/services" className="text-gray-500 hover:text-gray-900 transition-colors">Services</Link>
          <Link href="/book" className="text-gray-500 hover:text-gray-900 transition-colors">Book appointment</Link>
          <Link href="/login">
            <Button variant="outline" size="sm">Staff login</Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-md hover:bg-gray-100"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600" />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t bg-white px-4 py-3 flex flex-col gap-3">
          <Link href="/services" className="text-sm text-gray-700 py-1" onClick={() => setMenuOpen(false)}>Services</Link>
          <Link href="/book" className="text-sm text-gray-700 py-1" onClick={() => setMenuOpen(false)}>Book appointment</Link>
          <Link href="/login" onClick={() => setMenuOpen(false)}>
            <Button variant="outline" size="sm" className="w-full">Staff login</Button>
          </Link>
        </div>
      )}
    </header>
  )
}