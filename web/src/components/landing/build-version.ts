const BUILD = process.env.NEXT_PUBLIC_BUILD ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? ""

/** Cache-busting suffix for the static landing CSS/JS under /landing. */
export const V = BUILD ? `?v=${BUILD.slice(0, 12)}` : ""
