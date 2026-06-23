/**
 * OLU EYE CLINIC — REUSABLE FORM COMPONENTS
 * ==========================================
 * Use these components for ALL forms across the app
 * to maintain consistent styling and UX.
 *
 * Usage:
 *   import { Field, inputClass, textareaClass, FormCard } from '@/components/ui/form-components'
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// ─── Base input class ────────────────────────────────────────────────────────
// Apply to any <input> or <select> element
export const inputClass =
  'w-full px-4 py-3 text-base rounded-lg border border-gray-200 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 ' +
  'transition-all bg-white placeholder:text-gray-400'

// ─── Textarea class ───────────────────────────────────────────────────────────
// Same as input but non-resizable by default
export const textareaClass = `${inputClass} resize-none`

// ─── Notes textarea class ─────────────────────────────────────────────────────
// Yellow tint for clinical notes fields (matches Access convention)
export const notesClass = `${textareaClass} bg-yellow-50`

// ─── OD (right eye) input class ───────────────────────────────────────────────
// Pink tint — matches Access EMR colour coding
export const odClass =
  'w-full px-3 py-1.5 text-sm rounded border border-pink-200 bg-pink-50 ' +
  'focus:border-pink-400 focus:outline-none focus:ring-1 focus:ring-pink-100 ' +
  'transition-all placeholder:text-gray-400'

// ─── OS (left eye) input class ────────────────────────────────────────────────
// Green tint — matches Access EMR colour coding
export const osClass =
  'w-full px-3 py-1.5 text-sm rounded border border-green-200 bg-green-50 ' +
  'focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-100 ' +
  'transition-all placeholder:text-gray-400'

// ─── Field wrapper ────────────────────────────────────────────────────────────
// Wraps a label + input pair with consistent spacing
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-base font-medium text-gray-700">
        {label}{' '}
        {required && <span className="text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─── FormCard ─────────────────────────────────────────────────────────────────
// Section card used to group related fields
export function FormCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6 flex flex-col gap-6">{children}</CardContent>
    </Card>
  )
}

// ─── FormGrid ─────────────────────────────────────────────────────────────────
// Responsive 2-column grid for side-by-side fields
export function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">{children}</div>
  )
}

// ─── OD/OS Header ─────────────────────────────────────────────────────────────
// Column headers for eye exam grids
export function ODOSHeader() {
  return (
    <>
      <div />
      <div className="col-span-2 text-center text-xs font-semibold text-pink-400">
        OD (Right)
      </div>
      <div className="col-span-2 text-center text-xs font-semibold text-green-500">
        OS (Left)
      </div>
    </>
  )
}

// ─── FormSection header (inline, no card) ────────────────────────────────────
// Lightweight section divider for use inside a form without a card wrapper
export function FormSectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mt-4 border-b border-gray-200 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
      {title}
    </h3>
  )
}

// ─── USAGE EXAMPLE ───────────────────────────────────────────────────────────
//
// import { Field, inputClass, textareaClass, notesClass, FormCard, FormGrid } from '@/components/ui/form-components'
//
// <FormCard title="Personal details">
//   <FormGrid>
//     <Field label="First name" required>
//       <input className={inputClass} placeholder="First name" />
//     </Field>
//     <Field label="Last name" required>
//       <input className={inputClass} placeholder="Last name" />
//     </Field>
//   </FormGrid>
//   <Field label="Notes" hint="Visible to all staff">
//     <textarea className={notesClass} rows={4} />
//   </Field>
// </FormCard>
