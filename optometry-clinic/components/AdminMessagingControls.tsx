'use client'

// components/AdminMessagingControls.tsx
// Admin-only control panel for the WhatsApp messaging layer, shown on the
// Conversations page. Toggles Iris (AI replies) and the automated Meta
// messages on/off, and drives a test-mode allowlist so testing can't touch
// real patients. Every write goes through an admin-gated server action, so
// this is safe even though it's a client component.

import { useEffect, useState } from 'react'
import {
  getMessagingSettings,
  updateMessagingSettings,
} from '@/app/actions/messagingSettings'

type ReviewLinkMode = 'always' | 'once' | 'interval'

type Settings = {
  ai_enabled: boolean
  automated_sends_enabled: boolean
  test_mode: boolean
  test_numbers: string[]
  review_link_mode: ReviewLinkMode
  review_link_interval_days: number
}

export function AdminMessagingControls() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [numbersDraft, setNumbersDraft] = useState('')
  const [daysDraft, setDaysDraft] = useState('90')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getMessagingSettings().then(res => {
      if (!active) return
      if (res.settings) {
        setSettings(res.settings)
        setNumbersDraft(res.settings.test_numbers.join('\n'))
        setDaysDraft(String(res.settings.review_link_interval_days))
      } else {
        setError(res.error ?? 'Could not load settings')
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function apply(updates: Partial<Settings>) {
    if (!settings) return
    setSaving(true)
    setStatus(null)
    setError(null)

    const previous = settings
    const next = { ...settings, ...updates }
    setSettings(next) // optimistic

    const res = await updateMessagingSettings(updates)
    if (res.ok) {
      setStatus('Saved')
      setTimeout(() => setStatus(null), 1500)
    } else {
      setSettings(previous) // revert
      setError(res.error ?? 'Save failed')
    }
    setSaving(false)
  }

  function saveNumbers() {
    const parsed = numbersDraft
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean)
    apply({ test_numbers: parsed })
  }

  function saveDays() {
    const n = Math.floor(Number(daysDraft))
    if (!Number.isFinite(n) || n < 1) {
      // Reject junk — snap the field back to the saved value.
      setDaysDraft(String(settings?.review_link_interval_days ?? 90))
      return
    }
    setDaysDraft(String(n))
    if (n !== settings?.review_link_interval_days) apply({ review_link_interval_days: n })
  }

  if (loading) {
    return (
      <div className="mb-5 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
        Loading messaging controls…
      </div>
    )
  }

  if (!settings) {
    // Non-admins (action returns an error) simply don't see the panel.
    return null
  }

  const summary = settings.test_mode
    ? 'Test mode ON'
    : !settings.ai_enabled || !settings.automated_sends_enabled
      ? 'Some messaging paused'
      : 'All messaging live'

  return (
    <div className="mb-5 rounded-md border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">
          Messaging controls
          <span
            className={
              'ml-2 rounded-full px-2 py-0.5 text-xs font-medium ' +
              (settings.test_mode
                ? 'bg-amber-100 text-amber-800'
                : summary === 'All messaging live'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-700')
            }
          >
            {summary}
          </span>
        </span>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          <Toggle
            label="Iris AI replies"
            help="When off, Iris stops replying to all inbound WhatsApp messages."
            checked={settings.ai_enabled}
            disabled={saving}
            onChange={v => apply({ ai_enabled: v })}
          />
          <Toggle
            label="Automated messages"
            help="Post-visit thank-yous and appointment reminders. When off, none are sent."
            checked={settings.automated_sends_enabled}
            disabled={saving}
            onChange={v => apply({ automated_sends_enabled: v })}
          />

          {/* Review link in the thank-you: always / once per patient / every N days */}
          <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
            <div className="text-sm font-medium text-gray-800">Review link in thank-you</div>
            <p className="mb-2 text-xs text-gray-500">
              When the post-visit thank-you asks for a Google review. “Always” asks every
              visit; the others ask less often to spare the marketing cap.
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                ['always', 'Always'],
                ['once', 'Once per patient'],
                ['interval', 'Every N days'],
              ] as [ReviewLinkMode, string][]).map(([value, label]) => {
                const active = settings.review_link_mode === value
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={saving}
                    onClick={() => apply({ review_link_mode: value })}
                    className={
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ' +
                      (active
                        ? 'border-[#0d7b5f] bg-[#0d7b5f] text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400')
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {settings.review_link_mode === 'interval' && (
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="review-days" className="text-sm text-gray-700">
                  Ask again every
                </label>
                <input
                  id="review-days"
                  type="number"
                  min={1}
                  value={daysDraft}
                  disabled={saving}
                  onChange={e => setDaysDraft(e.target.value)}
                  onBlur={saveDays}
                  onKeyDown={e => { if (e.key === 'Enter') saveDays() }}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-[#0d7b5f] focus:outline-none focus:ring-1 focus:ring-[#0d7b5f]"
                />
                <span className="text-sm text-gray-700">days</span>
              </div>
            )}
          </div>

          <Toggle
            label="Test mode"
            help="When on, ONLY the numbers below receive Iris replies or automated messages. Real patients get nothing — use for short testing windows, then turn off."
            checked={settings.test_mode}
            disabled={saving}
            onChange={v => apply({ test_mode: v })}
          />

          <div className={settings.test_mode ? '' : 'opacity-60'}>
            <label className="block text-sm font-medium text-gray-800">
              Test numbers
            </label>
            <p className="mb-2 text-xs text-gray-500">
              One per line (or comma-separated). Any format — e.g. 2348012345678
              or 08012345678.
            </p>
            <textarea
              value={numbersDraft}
              onChange={e => setNumbersDraft(e.target.value)}
              rows={3}
              placeholder="2348012345678"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#0d7b5f] focus:outline-none focus:ring-1 focus:ring-[#0d7b5f]"
            />
            <button
              onClick={saveNumbers}
              disabled={saving}
              className="mt-2 rounded-md bg-[#0d7b5f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a6650] disabled:opacity-50"
            >
              Save numbers
            </button>
          </div>

          <div className="min-h-[1.25rem] text-xs">
            {status && <span className="text-emerald-700">{status}</span>}
            {error && <span className="text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string
  help: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-500">{help}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ' +
          (checked ? 'bg-[#0d7b5f]' : 'bg-gray-300')
        }
      >
        <span
          className={
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' +
            (checked ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </div>
  )
}
