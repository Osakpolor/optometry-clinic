'use client'

// components/ConversationsView.tsx
// WhatsApp-style team inbox. Left: threads (search, unread dots, takeover tag).
// Right: transcript that auto-scrolls to newest, a window-aware composer for
// staff replies, and take-over / hand-back-to-Iris controls.
//
// Permissions come from the server: `access` decides whether the composer and
// takeover controls appear at all; a 'preview' role sees the list but not the
// transcript.

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { ConversationThread } from '@/app/actions/getConversations'
import { getConversationMessages, type ThreadContext } from '@/app/actions/getConversations'
import { sendStaffReply } from '@/app/actions/sendStaffReply'
import { handBackToIris, takeOverConversation, markThreadRead } from '@/app/actions/conversationControl'
import type { RoleAccess } from '@/lib/conversationAccess'

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ConversationsView({
  threads: initialThreads,
  access,
}: {
  threads: ConversationThread[]
  access?: RoleAccess
}) {
  const canFull = access?.view === 'full'

  const [threads, setThreads] = useState(initialThreads)
  const [selected, setSelected] = useState<ConversationThread | null>(null)
  const [ctx, setCtx] = useState<ThreadContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState<'today' | '7days' | 'all'>('all')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to newest whenever the transcript changes.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [ctx?.messages, loading])

  // Date-range + search filter
  const filteredThreads = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const q = query.trim().toLowerCase()
    return threads.filter(t => {
      const last = new Date(t.lastMessageAt)
      if (range === 'today' && last < startOfToday) return false
      if (range === '7days' && last < sevenDaysAgo) return false
      if (q) {
        const hay = `${t.displayName} ${t.phoneNumber} ${t.lastMessagePreview}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [threads, range, query])

  const rangeTabs: { key: 'today' | '7days' | 'all'; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7days', label: 'Last 7 days' },
    { key: 'all', label: 'All' },
  ]

  async function openThread(t: ConversationThread) {
    setSelected(t)
    setDraft('')
    setSendError(null)
    setCtx(null)
    setLoading(true)
    const result = await getConversationMessages(t.phoneNumber)
    setLoading(false)
    setCtx(result)
    // Clear unread locally + persist read mark
    if (t.hasUnread) {
      setThreads(prev => prev.map(x => x.phoneNumber === t.phoneNumber ? { ...x, hasUnread: false } : x))
      markThreadRead(t.phoneNumber)
    }
  }

  async function refreshThread(phone: string) {
    const result = await getConversationMessages(phone)
    setCtx(result)
  }

  async function onSend() {
    if (!selected || !draft.trim()) return
    setSending(true)
    setSendError(null)
    const text = draft.trim()
    const res = await sendStaffReply(selected.phoneNumber, text)
    setSending(false)
    if (!res.ok) {
      setSendError(res.error ?? 'Could not send')
      return
    }
    setDraft('')
    // Reflect the sent message + takeover immediately
    await refreshThread(selected.phoneNumber)
    setThreads(prev => prev.map(x =>
      x.phoneNumber === selected.phoneNumber
        ? { ...x, humanControlled: true, lastMessagePreview: text.slice(0, 80), lastMessageAt: new Date().toISOString(), lastMessageRole: 'staff' }
        : x
    ))
  }

  async function onTakeOver() {
    if (!selected) return
    await takeOverConversation(selected.phoneNumber)
    await refreshThread(selected.phoneNumber)
    setThreads(prev => prev.map(x => x.phoneNumber === selected.phoneNumber ? { ...x, humanControlled: true } : x))
  }

  async function onHandBack() {
    if (!selected) return
    await handBackToIris(selected.phoneNumber)
    await refreshThread(selected.phoneNumber)
    setThreads(prev => prev.map(x => x.phoneNumber === selected.phoneNumber ? { ...x, humanControlled: false } : x))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-240px)] min-h-[440px]">
      {/* ── Thread list ── (hidden on mobile once a thread is open) */}
      <div className={`border border-border rounded-lg overflow-hidden bg-white flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-2 border-b bg-gray-50/60 shrink-0 space-y-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, number or message"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <div className="flex gap-1">
            {rangeTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setRange(tab.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  range === tab.key ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filteredThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">
              {threads.length === 0 ? 'No conversations yet.' : 'No conversations match.'}
            </p>
          ) : (
            <ul className="divide-y">
              {filteredThreads.map(t => (
                <li key={t.phoneNumber}>
                  <button
                    onClick={() => openThread(t)}
                    className={`w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors ${
                      selected?.phoneNumber === t.phoneNumber ? 'bg-brand/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${t.hasUnread ? 'font-semibold text-gray-900' : 'font-medium'}`}>
                        {t.displayName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.hasUnread && <span className="w-2 h-2 rounded-full bg-brand" aria-label="unread" />}
                        <span className="text-[11px] text-muted-foreground">{timeLabel(t.lastMessageAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.kind === 'patient' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Patient</span>}
                      {t.kind === 'lead' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Lead</span>}
                      {t.kind === 'unknown' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">Unknown</span>}
                      {t.humanControlled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Staff</span>}
                      <span className="text-xs text-muted-foreground truncate">{t.lastMessagePreview}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Transcript + composer ── */}
      <div className={`border border-border rounded-lg bg-white flex flex-col overflow-hidden ${selected ? 'flex' : 'hidden md:flex'}`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view the transcript.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setSelected(null)} className="md:hidden text-brand text-sm shrink-0">←</button>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{selected.displayName}</div>
                  <div className="text-xs text-muted-foreground">{selected.phoneNumber}</div>
                </div>
              </div>
              {selected.patientId && (
                <Link href={`/dashboard/patients/${selected.patientId}`} className="text-xs text-brand underline hover:no-underline shrink-0">
                  Open patient record →
                </Link>
              )}
            </div>

            {/* Takeover banner (only for full-access repliers) */}
            {canFull && ctx && access?.can_reply && (
              <div className="px-4 py-2 border-b bg-gray-50/70 shrink-0 flex items-center justify-between gap-2 text-xs">
                {ctx.humanControlled ? (
                  <>
                    <span className="text-amber-700">
                      Handled by staff{ctx.controlledBy ? ` (${ctx.controlledBy})` : ''} — Iris is paused
                    </span>
                    <button onClick={onHandBack} className="px-2 py-1 rounded bg-green-600 text-white font-medium hover:bg-green-700">
                      Hand back to Iris
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-green-700">Iris is auto-replying to this conversation</span>
                    <button onClick={onTakeOver} className="px-2 py-1 rounded border border-gray-300 font-medium hover:bg-gray-100">
                      Take over
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50/50">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
              ) : ctx?.restricted ? (
                <div className="flex-1 flex items-center justify-center text-center px-6">
                  <p className="text-sm text-muted-foreground">
                    Full transcripts are restricted for your role. You can see who has messaged and the
                    latest line, but not the full conversation. Ask an admin if you need access.
                  </p>
                </div>
              ) : (
                (ctx?.messages ?? []).map((m: any) => {
                  const isUser = m.role === 'user'
                  const isSystem = m.role === 'system'
                  const isStaff = m.role === 'staff'
                  // Patient → left/white; Iris → green; automated → blue; staff → teal(brand)
                  const bubble = isUser
                    ? 'bg-white border border-gray-200 rounded-tl-sm text-gray-800'
                    : isSystem
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : isStaff
                    ? 'bg-brand text-white rounded-tr-sm'
                    : 'bg-green-600 text-white rounded-tr-sm'
                  const meta = isUser ? 'text-gray-400' : isSystem ? 'text-blue-100' : isStaff ? 'text-white/80' : 'text-green-100'
                  const who = isUser ? 'Patient' : isSystem ? 'Automated' : isStaff ? 'Staff' : 'Iris (AI)'
                  return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${bubble}`}>
                        <div>{m.message}</div>
                        <div className={`text-[10px] mt-1 ${meta}`}>{who} · {timeLabel(m.created_at)}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Composer */}
            {!canFull ? null : !access?.can_reply ? (
              <div className="px-4 py-2.5 border-t shrink-0 bg-gray-50">
                <p className="text-[11px] text-muted-foreground text-center">
                  You have view access. Replying is limited to staff with reply permission.
                </p>
              </div>
            ) : ctx && !ctx.windowOpen ? (
              <div className="px-4 py-3 border-t shrink-0 bg-amber-50">
                <p className="text-xs text-amber-800 text-center">
                  This patient last messaged more than 24 hours ago, so WhatsApp won't deliver a typed
                  reply. Send an approved template (reminder or thank-you) to reopen the conversation.
                </p>
              </div>
            ) : (
              <div className="px-3 py-2.5 border-t shrink-0 bg-white">
                {sendError && <p className="text-xs text-red-600 mb-1.5">{sendError}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
                    }}
                    rows={1}
                    placeholder="Type a reply…  (Enter to send, Shift+Enter for a new line)"
                    className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand max-h-32"
                  />
                  <button
                    onClick={onSend}
                    disabled={sending || !draft.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50 shrink-0"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Replying here pauses Iris for this conversation until you hand it back.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
