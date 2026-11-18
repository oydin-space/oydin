"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { api } from "@/lib/api"
import { type Locale } from "./copy"

interface Testimonial {
  id: number
  name: string
  position: string
  company: string
  text: string
  photo: string | null
  logo: string | null
}

/** Client-side testimonials (contract C5): logo, quote, then person photo + name + position, company. Hidden when empty. */
export function Testimonials({ locale }: { locale: Locale }) {
  const [items, setItems] = useState<Testimonial[]>([])
  const [mount, setMount] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let alive = true
    api<{ items: Testimonial[] }>(`/public/testimonials/?lang=${locale}`)
      .then((r) => {
        if (!alive) return
        setMount(document.getElementById("testimonials-mount"))
        setItems(r.items)
      })
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [locale])

  useEffect(() => {
    const section = document.getElementById("testimonials")
    if (section) section.hidden = items.length === 0
  }, [items])

  if (!mount || items.length === 0) return null
  return createPortal(
    <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => (
        <li key={t.id} className="flex min-w-0 flex-col gap-4 rounded-3xl border border-[#3b342a]/10 bg-[#fffaf0] p-6 text-[#3b342a]">
          {t.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.logo} alt={t.company} loading="lazy" className="h-8 w-auto max-w-[160px] self-start object-contain" />
          )}
          <blockquote className="m-0 text-base leading-relaxed [overflow-wrap:anywhere]">{t.text}</blockquote>
          <div className="mt-auto flex min-w-0 items-center gap-3">
            {t.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.photo} alt="" loading="lazy" className="size-11 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-[#FFD62C] font-bold">
                {t.name.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 text-sm leading-snug">
              <strong className="block [overflow-wrap:anywhere]">{t.name}</strong>
              <span className="block opacity-75 [overflow-wrap:anywhere]">
                {t.position}, {t.company}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>,
    mount,
  )
}
