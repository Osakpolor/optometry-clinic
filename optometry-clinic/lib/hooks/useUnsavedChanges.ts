// lib/hooks/useUnsavedChanges.ts
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Guards against navigating away from a form with unsaved changes.
 *
 * Two layers:
 *  1. Browser tab close / refresh / URL-bar navigation → native
 *     "Leave site?" dialog (browsers only allow two buttons here).
 *  2. In-app link clicks → intercepted, so the caller can show a
 *     custom Save / Don't Save / Cancel modal.
 *
 * Usage:
 *   const guard = useUnsavedChanges(isDirty)
 *   // guard.pendingUrl  → the URL the user tried to go to (or null)
 *   // guard.confirmLeave() → proceed to pendingUrl (discard changes)
 *   // guard.cancelLeave()  → dismiss the modal, stay on page
 *   // guard.allowNextNavigation() → call right before a programmatic
 *   //     router.push after a successful save, so the guard doesn't fire
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const isDirtyRef = useRef(isDirty)
  const allowNavRef = useRef(false)

  // Keep a ref in sync so event handlers always see the latest value
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Layer 1 — native browser warning for tab close / refresh
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current && !allowNavRef.current) {
        e.preventDefault()
        e.returnValue = '' // required for Chrome to show the dialog
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Layer 2 — intercept in-app link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!isDirtyRef.current || allowNavRef.current) return

      // Find the nearest anchor ancestor of the click target
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // Ignore external links, new-tab, hash-only, and downloads
      if (
        anchor.target === '_blank' ||
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.hasAttribute('download')
      ) {
        return
      }

      // Intercept — show the custom modal instead of navigating
      e.preventDefault()
      e.stopPropagation()
      setPendingUrl(href)
    }

    // Capture phase so we catch the click before Next.js's Link handler
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  const confirmLeave = useCallback(() => {
    // User chose to leave without saving — allow the navigation through
    allowNavRef.current = true
    if (pendingUrl) {
      window.location.href = pendingUrl
    }
  }, [pendingUrl])

  const cancelLeave = useCallback(() => {
    setPendingUrl(null)
  }, [])

  const allowNextNavigation = useCallback(() => {
    // Call this right before a programmatic router.push after a save,
    // so the guard doesn't block the intended redirect.
    allowNavRef.current = true
  }, [])

  return {
    pendingUrl,
    confirmLeave,
    cancelLeave,
    allowNextNavigation,
  }
}
