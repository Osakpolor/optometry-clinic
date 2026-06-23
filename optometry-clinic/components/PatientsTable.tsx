'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

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
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('legacy_id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
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
        if (sortKey === 'legacy_id') {
          av = av ?? Infinity
          bv = bv ?? Infinity
        } else {
          av = av.toString().toLowerCase()
          bv = bv.toString().toLowerCase()
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1
        if (av > bv) return sortDir === 'asc' ? 1 : -1
        return 0
      })
  }, [patients, search, sortKey, sortDir])

  return (
    <div className="mt-6">
      <input
        type="text"
        placeholder="Search by name, phone, or patient ID…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded border border-gray-300 p-2 text-sm"
      />
      <p className="mt-2 text-xs text-gray-400">{filtered.length} of {patients.length} patients</p>

      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="cursor-pointer py-2 pr-4 select-none" onClick={() => toggleSort('legacy_id')}>
              ID <SortIcon col="legacy_id" />
            </th>
            <th className="cursor-pointer py-2 pr-4 select-none" onClick={() => toggleSort('full_name')}>
              Name <SortIcon col="full_name" />
            </th>
            <th className="cursor-pointer py-2 pr-4 select-none" onClick={() => toggleSort('sex')}>
              Sex <SortIcon col="sex" />
            </th>
            <th className="py-2 pr-4">Phone</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-gray-400">No patients match your search.</td></tr>
          )}
          {filtered.map(p => (
            <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 pr-4 text-gray-400">{p.legacy_id ?? '—'}</td>
              <td className="py-2 pr-4 font-medium">{p.full_name}</td>
              <td className="py-2 pr-4 text-gray-600">{p.sex ?? '—'}</td>
              <td className="py-2 pr-4 text-gray-600">{p.phone ?? '—'}</td>
              <td className="py-2 pr-4">
                <Link href={`/dashboard/patients/${p.id}`} className="text-blue-600 underline">View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}