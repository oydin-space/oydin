import type { ReactNode } from "react"

/** Renders `**key facts**` of an i18n template as <strong>. */
export function Bold({ children }: { children: string }): ReactNode {
  return children.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-bold">{part}</strong> : part))
}
