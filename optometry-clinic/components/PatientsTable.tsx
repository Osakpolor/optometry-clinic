'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Patient = {
  id: string
  full_name: string
  phone: string | null
  sex: string | null
  legacy_id: number | null
  file_number: string | null
  created_at: string
}

type SortKey = 'file_number' | 'full_name' | 'sex'
type SortDir = 'asc' | 'desc'

function patientRef(p: Patient): string {
  if (p.file_number) return p.file_number
  if (p.legacy_id != null) return String(p.legacy_id)
  return '—'
}

function compareRefs(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return a.localeCompare(b)
}

// Debounce hook — delays updating the value until the user
// stops typing for `delay` ms, keeping search responsive on
// large patient lists.
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function PatientsTable({ patients }: { patients: Patient[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('file_number')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const debouncedSearch = useDebounce(search, 200)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return patients
      .filter(p =>
        !q ||
        // Search by name or file number only — phone intentionally
        // excluded per clinic preference.
        p.full_name?.toLowerCase().includes(q) ||
        (p.file_number ?? '').toLowerCase().includes(q) ||
        String(p.legacy_id ?? '').includes(q)
      )
      .sort((a, b) => {
        let result = 0
        if (sortKey === 'file_number') {
          const ra = patientRef(a)
          const rb = patientRef(b)
          if (ra === '—' && rb === '—') result = 0
          else if (ra === '—') result = 1
          else if (rb === '—') result = -1
          else result = compareRefs(ra, rb)
        } else {
          const av = (a[sortKey] ?? '').toString().toLowerCase()
          const bv = (b[sortKey] ?? '').toString().toLowerCase()
          result = av < bv ? -1 : av > bv ? 1 : 0
        }
        return sortDir === 'asc' ? result : -result
      })
  }, [patients, debouncedSearch, sortKey, sortDir])

  return (
    <div>
      {/* Search */}
      <div className="relative mb-2">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search returning patient by name or file number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 text-base rounded-lg border-2 border-gray-200
                     focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10
                     transition-all placeholder:text-gray-400 bg-white shadow-sm"
        />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} of {patients.length} patients
      </p>

      {/* Mobile view */}
      <div className="flex flex-col divide-y sm:hidden">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No patients match your search.
          </p>
        )}
        {filtered.map(p => (
          <div
            key={p.id}
            onClick={() => router.push(`/dashboard/patients/${p.id}`)}
            className="flex items-center justify-between py-3 hover:bg-gray-50
                       -mx-1 px-1 rounded cursor-pointer"
          >
            <div>
              <p className="text-sm font-medium">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {p.phone ?? '—'} {p.sex ? `· ${p.sex}` : ''}
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              #{patientRef(p)}
            </span>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <table className="hidden sm:table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th
              onClick={() => toggleSort('file_number')}
              className="cursor-pointer py-2 pr-6 text-xs font-semibold
                         text-muted-foreground select-none w-28"
            >
              File no. <SortIcon col="file_number" />
            </th>
            <th
              onClick={() => toggleSort('full_name')}
              className="cursor-pointer py-2 pr-6 text-xs font-semibold
                         text-muted-foreground select-none"
            >
              Name <SortIcon col="full_name" />
            </th>
            <th
              onClick={() => toggleSort('sex')}
              className="cursor-pointer py-2 pr-16 text-xs font-semibold
                         text-muted-foreground select-none w-28"
            >
              Sex <SortIcon col="sex" />
            </th>
            <th className="py-2 text-xs font-semibold text-muted-foreground">
              Phone
            </th>
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
              className="border-b border-gray-100 hover:bg-gray-50
                         cursor-pointer transition-colors"
            >
              <td className="py-3 pr-6 text-muted-foreground text-xs font-mono w-28">
                {patientRef(p)}
              </td>
              <td className="py-3 pr-6 font-medium">{p.full_name}</td>
              <td className="py-3 pr-16 text-muted-foreground w-28">
                {p.sex ?? '—'}
              </td>
              <td className="py-3 text-muted-foreground">{p.phone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
