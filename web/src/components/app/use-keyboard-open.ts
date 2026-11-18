"use client"

import { useEffect, useState } from "react"

const EDITABLE = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable=''], [contenteditable='true']"

const isEditable = (el: EventTarget | null) => el instanceof Element && el.matches(EDITABLE)

/** True while the on-screen keyboard is (likely) open: visualViewport shrank below 75% of the window, or an editable field has focus. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    let focused = isEditable(document.activeElement)
    let shrunk = false
    const apply = () => setOpen(focused || shrunk)

    const onResize = () => {
      shrunk = !!vv && vv.height < window.innerHeight * 0.75
      apply()
    }
    const onIn = (e: FocusEvent) => {
      focused = isEditable(e.target)
      apply()
    }
    const onOut = (e: FocusEvent) => {
      // Moving focus between two fields must not flash the dock back.
      if (isEditable(e.relatedTarget)) return
      focused = false
      apply()
    }

    onResize()
    vv?.addEventListener("resize", onResize)
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    return () => {
      vv?.removeEventListener("resize", onResize)
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
    }
  }, [])

  return open
}
