'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type Patient = {
  id: string
  full_name: string
  phone: string | null
  sex: string | null
  legacy_id: number | null
  created_at: string
}

type SortKey = 'legacy_id' | 'full_name' | 'sex'
type SortDir = 'asc' | 'desc'

export default function PatientsTable({ patients }: { patients: Patient[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('legacy_id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return patients
      .filter(p =>
        !q ||
        p.full_name?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        String(p.legacy_id ?? '').includes(q)
      )
      .sort((a, b) => {
        let av: any = a[sortKey] ?? ''
        let bv: any = b[sortKey] ?? ''
        if (sortKey === 'legacy_id') { av = av ?? Infinity; bv = bv ?? Infinity }
        else { av = av.toString().toLowerCase(); bv = bv.toString().toLowerCase() }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
  }, [patients, search, sortKey, sortDir])

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-2">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search returning patient by name, phone or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 text-base rounded-lg border-2 border-gray-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-gray-400 bg-white shadow-sm"
        />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} of {patients.length} patients
      </p>

      {/* Mobile view — cards, always full-row clickable */}
      <div className="flex flex-col divide-y sm:hidden">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No patients match your search.</p>
        )}
        {filtered.map(p => (
          <div
            key={p.id}
            onClick={() => router.push(`/dashboard/patients/${p.id}`)}
            className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-1 px-1 rounded cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">{p.phone ?? '—'} {p.sex ? `· ${p.sex}` : ''}</p>
            </div>
            <span className="text-xs text-muted-foreground">#{p.legacy_id ?? '—'}</span>
          </div>
        ))}
      </div>

      {/* Desktop table — full row clickable, no View link */}
      <table className="hidden sm:table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th
              className="cursor-pointer py-2 pr-4 text-xs font-semibold text-muted-foreground select-none"
              onClick={() => toggleSort('legacy_id')}
            >
              ID <SortIcon col="legacy_id" />
            </th>
            <th
              className="cursor-pointer py-2 pr-4 text-xs font-semibold text-muted-foreground select-none"
              onClick={() => toggleSort('full_name')}
            >
              Name <SortIcon col="full_name" />
            </th>
            <th
              className="cursor-pointer py-2 pr-4 text-xs font-semibold text-muted-foreground select-none"
              onClick={() => toggleSort('sex')}
            >
              Sex <SortIcon col="sex" />
            </th>
            <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground">Phone</th>
            {/* No View column */}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                No patients match your search.
              </td>
            </tr>
          )}
          {filtered.map(p => (
            <tr
              key={p.id}
              onClick={() => router.push(`/dashboard/patients/${p.id}`)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="py-3 pr-4 text-muted-foreground text-xs">{p.legacy_id ?? '—'}</td>
              <td className="py-3 pr-4 font-medium">{p.full_name}</td>
              <td className="py-3 pr-4 text-muted-foreground">{p.sex ?? '—'}</td>
              <td className="py-3 pr-4 text-muted-foreground">{p.phone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}