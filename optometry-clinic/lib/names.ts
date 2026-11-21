// lib/names.ts
// Shared name-formatting helpers.
//
// STRATEGY (deliberate): we do NOT bulk-rewrite the ~1,900 stored names. We
// normalize names for DISPLAY and on NEW INPUT (create/edit). That is safe,
// reversible, and covers legacy rows too — a messy "AGU JONES" in the DB still
// renders "Agu Jones" everywhere without touching the stored value.
//
// KNOWN LIMITATION (do not solve here): a single `full_name` string carries no
// structure, so we cannot know whether it is "first last" or "last first".
// Names entered surname-first (e.g. "Agu Jones Peace", where "Peace" is the
// given name) will greet by the surname. The durable fix is STRUCTURED name
// fields (title / first / surname) captured at registration — a later change.

// Small words that stay lowercase inside a name (particles), unless they are
// the very first token. Kept intentionally short — don't over-engineer.
const LOWERCASE_PARTICLES = new Set(['van', 'von', 'de', 'da', 'di', 'del', 'der', 'la', 'le', 'bin', 'al'])

// Honorifics / titles to strip before deriving a first name for greetings.
// Compared case-insensitively and with any trailing "." removed.
const TITLES = new Set([
  'dr', 'doctor', 'chief', 'mr', 'mrs', 'miss', 'ms', 'prof', 'professor',
  'pastor', 'rev', 'reverend', 'engr', 'barr', 'mallam', 'alhaji', 'alhaja',
  'hon', 'sir', 'madam', 'pst',
])

// Title-case a single whitespace-delimited token, handling the common
// intra-word separators: hyphen (Ama-Chi), apostrophe (O'Brien), and the
// Scots/Irish Mc/Mac prefixes (McDonald, MacLeod). Not exhaustive by design.
function titleCaseToken(token: string, isFirstToken: boolean): string {
  if (!token) return token

  const lower = token.toLowerCase()

  // Keep recognised particles lowercase — but never the first token of a name
  // ("De" at the start is a given name, not a particle).
  if (!isFirstToken && LOWERCASE_PARTICLES.has(lower)) return lower

  // Capitalise each piece around hyphens and apostrophes, preserving the
  // separators (so "o'brien" → "O'Brien", "ama-chi" → "Ama-Chi").
  const capitalise = (s: string): string =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s

  const byApostrophe = lower.split("'").map((part) => {
    const byHyphen = part.split('-').map((seg) => {
      // Mc / Mac prefix: capitalise the prefix AND the following letter.
      if (seg.length > 2 && (seg.startsWith('mc') || seg.startsWith('mac'))) {
        const cut = seg.startsWith('mac') ? 3 : 2
        return capitalise(seg.slice(0, cut)) + capitalise(seg.slice(cut))
      }
      return capitalise(seg)
    })
    return byHyphen.join('-')
  })

  return byApostrophe.join("'")
}

/**
 * Title-case a full name for display.
 *   "AGU JONES"  -> "Agu Jones"
 *   "agu jones"  -> "Agu Jones"
 *   "o'brien"    -> "O'Brien"
 *   "mary mc-donald van der berg" -> "Mary Mc-Donald van der Berg"
 *
 * Non-destructive: use at render time and on save; never mutate historical
 * rows in place. Returns the input unchanged when it is empty/nullish.
 */
export function toTitleCase(name: string | null | undefined): string {
  if (!name) return ''
  const tokens = name.trim().split(/\s+/)
  return tokens
    .map((tok, i) => titleCaseToken(tok, i === 0))
    .join(' ')
}

/**
 * Choose the name to greet a patient by, given both a (possibly null) stored
 * structured first name and the full_name blob.
 *
 *   - first_name present  -> greet by it, Title-cased ("Dear Osakpolor").
 *   - first_name absent    -> this is a legacy/unstructured record whose name
 *     ORDER is unknown, so greet with the WHOLE name, Title-cased, NOT the first
 *     token ("Dear Omoregie Osakpolor"). Greeting by the first token would say
 *     "Dear Omoregie" — the surname — for surname-first records.
 *
 * Returns '' only when both are empty (callers that must never send an empty
 * greeting should supply their own fallback).
 */
export function greetingName(opts: {
  firstName?: string | null
  fullName?: string | null
}): string {
  const fn = (opts.firstName ?? '').trim()
  if (fn) return toTitleCase(fn)
  return toTitleCase(opts.fullName ?? '')
}

/**
 * Derive a first name for a greeting: strip a leading title (Dr, Chief, Mr…),
 * then return the first remaining token, Title-cased.
 *   "Chief Agu Jones Mary" -> "Agu"
 *   "Dr. Peace"            -> "Peace"
 *   "mrs okon"            -> "Okon"
 *
 * Returns '' when nothing usable remains (callers that must never send an empty
 * greeting — e.g. a WhatsApp template param — should supply their own fallback,
 * like `firstName(name) || 'there'`).
 *
 * See the surname-first limitation note at the top of this file.
 */
export function firstName(name: string | null | undefined): string {
  if (!name) return ''
  const tokens = name.trim().split(/\s+/).filter(Boolean)

  let i = 0
  // Skip any leading title tokens (allow a couple stacked, e.g. "Chief Dr").
  while (i < tokens.length) {
    const bare = tokens[i].toLowerCase().replace(/\.$/, '')
    if (TITLES.has(bare)) {
      i++
    } else {
      break
    }
  }

  const first = tokens[i] ?? ''
  return toTitleCase(first)
}
