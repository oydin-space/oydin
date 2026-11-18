import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/** Content hash of the static landing CSS/JS, so any edit changes the URL and returning visitors never keep stale files. */
function hashLanding(): string {
  const hash = createHash("sha1")
  for (const dir of ["css", "js"]) {
    const base = join(process.cwd(), "public", "landing", dir)
    for (const name of readdirSync(base).sort()) hash.update(name).update(readFileSync(join(base, name)))
  }
  return hash.digest("hex").slice(0, 12)
}

function resolveVersion(): string {
  try {
    return hashLanding()
  } catch {
    // public/ not readable at runtime: fall back to the build id, then to this server's start time (changes per deploy).
    return (process.env.NEXT_PUBLIC_BUILD ?? process.env.GIT_SHA ?? String(Date.now())).slice(0, 12)
  }
}

/** Cache-busting suffix for the static landing CSS/JS under /landing. */
export const V = `?v=${resolveVersion()}`
