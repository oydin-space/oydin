"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Share2, Square, Volume2 } from "lucide-react"
import { IconButton, Button, ErrorState, Skeleton, toast } from "@/components/ui"
import { useI18n, useT } from "@/i18n"
import { makeT, type Locale } from "@/i18n/core"
import { formatDate, formatMoney } from "@/i18n/core"
import { todayIso } from "@/lib/core-api"
import { AttentionList } from "./attention-list"
import { Bold } from "./bold"
import { composeBrief } from "./brief-text"
import { RevenueCard } from "./revenue-card"
import { RunwayCard } from "./runway-card"
import { speechLocale, useSpeech } from "./speech"
import { useBriefOverview } from "./use-brief-overview"

/** /app/brief: the full morning brief. */
export function BriefDetail() {
  const t = useT()
  const router = useRouter()
  const { locale } = useI18n()
  const { pulse, payments, debtors, split, days, weekLoading } = useBriefOverview()
  const { available, speaking, voices, speak, stop } = useSpeech()
  const p = pulse.data
  const lang: Locale = speechLocale(locale, voices)
  const script = () => (p ? composeBrief(makeT(lang), lang, { pulse: p, payments, debtors }) : "")

  const share = async () => {
    const text = composeBrief(makeT(locale), locale, { pulse: p!, payments, debtors })
    try {
      if (navigator.share) await navigator.share({ title: t("biz.home.briefTitle"), text })
      else {
        await navigator.clipboard.writeText(text)
        toast.success(t("biz.brief.shared"))
      }
    } catch {
      /* share dismissed */
    }
  }

  const day = (iso: string) => formatDate(iso, locale, { day: "numeric", month: "long" })
  const first = payments[0]
  const sentences: string[] = []
  if (p?.revenue_week?.delta_pct != null) sentences.push(t(p.revenue_week.delta_pct >= 0 ? "biz.brief.sum.up" : "biz.brief.sum.down", { pct: `${Math.abs(p.revenue_week.delta_pct).toLocaleString(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 1 })}%` }))
  if (p) sentences.push(p.gap ? t("biz.brief.sum.gap", { date: day(p.gap.date), amount: formatMoney(p.gap.amount, locale) }) : t("biz.brief.sum.noGap"))
  if (first && first.next_date >= todayIso()) sentences.push(t("biz.brief.sum.pay", { title: first.title, date: day(first.next_date) }))

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 pb-4">
      <header className="flex items-center justify-between gap-2">
        <IconButton icon={ArrowLeft} label={t("biz.brief.back")} variant="secondary" onClick={() => (window.history.length > 1 ? router.back() : router.push("/app"))} />
        <div className="flex gap-2">
          {available ? <IconButton icon={speaking ? Square : Volume2} label={speaking ? t("biz.brief.stop") : t("biz.brief.speak")} variant="secondary" disabled={!p} onClick={() => (speaking ? stop() : speak(script(), lang))} /> : null}
          <IconButton icon={Share2} label={t("biz.brief.share")} variant="secondary" disabled={!p} onClick={() => void share()} />
        </div>
      </header>

      {pulse.error ? (
        <ErrorState message={pulse.error} onRetry={pulse.reload} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-[34px] font-bold leading-tight md:text-[40px]">{t("biz.home.briefTitle")}</h1>
              <p className="text-small text-muted-foreground">{formatDate(new Date(), locale, { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            {p ? (
              <p className="text-[20px] leading-snug md:text-[22px]">
                {sentences.map((s, i) => (
                  <span key={i}>{i ? " " : null}<Bold>{s}</Bold></span>
                ))}
              </p>
            ) : (
              <Skeleton className="h-24 w-full rounded-2xl" />
            )}
          </div>
          <hr className="border-border" />
          <section className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold">{t("biz.brief.attention")}</h2>
            <AttentionList payments={payments} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold">{t("biz.brief.overview")}</h2>
            {split ? <RunwayCard split={split} /> : <Skeleton className="h-36 w-full rounded-[24px]" />}
            <RevenueCard days={days} deltaPct={p?.revenue_week?.delta_pct} loading={weekLoading} />
          </section>
        </>
      )}

      <div className="sticky bottom-3 z-10 flex justify-center pt-2">
        <Button asChild size="lg" className="w-full sm:w-auto sm:px-10">
          <Link href="/app">{t("biz.home.qaAsk")}</Link>
        </Button>
      </div>
    </div>
  )
}
