// components/ConversationsPreview.tsx
// Dashboard card: a compact preview of recent WhatsApp conversations.
// Server component — respects per-role visibility (a 'none' role sees nothing;
// 'preview' and 'full' both see names + last line here, which is all the card
// shows). Links through to the full inbox.

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getConversationThreads } from '@/app/actions/getConversations'

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function ConversationsPreview() {
  const { threads, access } = await getConversationThreads()
  if (!access || access.view === 'none') return null

  const top = (threads ?? []).slice(0, 6)
  const unreadTotal = (threads ?? []).filter(t => t.hasUnread).length

  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Recent conversations
          </CardTitle>
          {unreadTotal > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
              {unreadTotal} unread
            </span>
          )}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="px-5 pt-2 pb-3">
        {top.length > 0 ? (
          <ul className="divide-y divide-border">
            {top.map(t => (
              <li key={t.phoneNumber}>
                <Link
                  href="/dashboard/conversations"
                  className="group flex items-center justify-between gap-2 py-2.5 hover:opacity-80 transition-opacity"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.hasUnread && <span className="w-2 h-2 rounded-full bg-brand shrink-0" />}
                      <span className={`text-sm truncate ${t.hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                        {t.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">{t.lastMessagePreview}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{timeLabel(t.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No conversations yet.</p>
        )}
        <Link
          href="/dashboard/conversations"
          className="block mt-2 text-xs font-medium text-brand hover:text-brand-hover transition-colors"
        >
          Open inbox →
        </Link>
      </CardContent>
    </Card>
  )
}
