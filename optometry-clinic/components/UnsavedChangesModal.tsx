// components/UnsavedChangesModal.tsx
'use client'

type Props = {
  open: boolean
  saving?: boolean
  onSave: () => void       // Save, then leave
  onDiscard: () => void    // Leave without saving
  onCancel: () => void     // Stay on the page
}

/**
 * Word-style unsaved changes prompt with three options:
 *   Save — saves the form, then navigates away
 *   Don't save — discards changes, navigates away
 *   Cancel — dismisses, stays on the page
 */
export function UnsavedChangesModal({ open, saving, onSave, onDiscard, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — clicking it cancels (stays on page) */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Save changes before leaving?
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            You have unsaved changes on this visit. If you leave now without
            saving, your changes will be lost.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border bg-gray-50/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Don't save
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
