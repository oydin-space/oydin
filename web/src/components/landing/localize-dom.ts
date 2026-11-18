import type { Locale } from "./copy"

export const LOCALE_EVENT = "oydin:locale"

const ATTRS = ["aria-label", "alt", "title", "placeholder", "data-play-label", "data-pause-label", "data-speech-text", "data-speech-lang"]

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

/** Images the page scripts re-wrapped (phone layers) no longer line up by position: pair them by `src`, in order. */
function syncImages(live: ParentNode, next: ParentNode): number {
  const queues = new Map<string, string[]>()
  next.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src") ?? ""
    queues.set(src, [...(queues.get(src) ?? []), img.getAttribute("alt") ?? ""])
  })
  let changed = 0
  live.querySelectorAll("img[src]").forEach((img) => {
    const alt = queues.get(img.getAttribute("src") ?? "")?.shift()
    if (alt !== undefined && img.getAttribute("alt") !== alt) {
      img.setAttribute("alt", alt)
      changed++
    }
  })
  return changed
}

/** `app.js` copies feature titles into a live status line and the mobile summary; refresh them from the swapped cards. */
function refreshFeatureCopy(root: ParentNode) {
  const active = root.querySelector<HTMLElement>("[data-feature].active")
  if (!active) return
  const title = active.querySelector(".feature-heading")?.textContent?.trim() ?? ""
  const status = root.querySelector("#feature-status")
  if (status) status.textContent = title
  const summary = root.querySelector(".mobile-feature-summary")
  const description = active.querySelector(".feature-description")
  if (summary && summary.childNodes.length && description) {
    const heading = document.createElement("strong")
    heading.textContent = `${title}. `
    summary.replaceChildren(heading, (description.textContent ?? "").replace(/\s+/g, " ").trim())
  }
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
  let changed = sync(liveShell, nextShell) + syncImages(liveShell, nextShell)
  let live = liveShell.nextElementSibling
  let next = nextShell.nextElementSibling
  while (live && next && !live.matches("script, link, next-route-announcer")) {
    changed += sync(live, next)
    live = live.nextElementSibling
    next = next.nextElementSibling
  }
  refreshFeatureCopy(liveShell)
  document.documentElement.lang = locale
  document.title = doc.title || document.title
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: locale }))
  return changed > 0
}
