import { words, type Locale } from "./copy"

const ATTRS = ["aria-label", "alt", "title", "placeholder"]

/** Copies translated text/attributes from `next` into `live` node by node; subtrees the page scripts re-shaped are skipped. */
function sync(live: Node, next: Node): number {
  let changed = 0
  if (live.nodeType !== next.nodeType) return 0
  if (live.nodeType === Node.TEXT_NODE) {
    if (live.nodeValue !== next.nodeValue) {
      live.nodeValue = next.nodeValue
      return 1
    }
    return 0
  }
  if (!(live instanceof Element) || !(next instanceof Element) || live.tagName !== next.tagName) return 0
  if (live.hasAttribute("data-lang-slot") || live.tagName === "SCRIPT" || live.tagName === "STYLE") return 0
  for (const name of ATTRS) {
    const value = next.getAttribute(name)
    if (value !== null && live.getAttribute(name) !== value) {
      live.setAttribute(name, value)
      changed++
    }
  }
  if (live.childNodes.length !== next.childNodes.length) return changed
  live.childNodes.forEach((child, i) => {
    changed += sync(child, next.childNodes[i])
  })
  return changed
}

/**
 * Re-renders the landing copy for `locale` without navigating: fetches the server markup
 * (cookie already set) and swaps text in place, so scroll position and layout stay untouched.
 * Returns false when nothing could be swapped (caller falls back to a refresh).
 */
export async function applyLocaleInPlace(locale: Locale): Promise<boolean> {
  const res = await fetch(location.pathname, { cache: "no-store", credentials: "same-origin" })
  if (!res.ok) return false
  const doc = new DOMParser().parseFromString(await res.text(), "text/html")
  const liveShell = document.querySelector(".page-shell")
  const nextShell = doc.querySelector(".page-shell")
  if (!liveShell || !nextShell) return false
  let changed = sync(liveShell, nextShell)
  if (liveShell.nextElementSibling && nextShell.nextElementSibling) {
    changed += sync(liveShell.nextElementSibling, nextShell.nextElementSibling)
  }
  document.documentElement.lang = locale
  document.title = doc.title || document.title
  ;(window as Window & { __oydinWords?: unknown }).__oydinWords = words[locale]
  return changed > 0
}
