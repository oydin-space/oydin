"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import type { Locale } from "@/i18n/core"

const LANG: Record<Locale, string> = { ru: "ru-RU", uz: "uz-UZ", en: "en-US" }

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"

const noopSubscribe = () => () => {}

const norm = (l: string) => l.replace("_", "-").toLowerCase()
const findVoice = (voices: SpeechSynthesisVoice[], tag: string) => {
  const prefix = norm(tag).split("-")[0]
  return voices.find((v) => norm(v.lang) === norm(tag)) ?? voices.find((v) => norm(v.lang).startsWith(prefix))
}

/** Locale to speak in: Uzbek falls back to Russian when the device has no uz voice. */
export function speechLocale(locale: Locale, voices: SpeechSynthesisVoice[]): Locale {
  return locale === "uz" && !findVoice(voices, LANG.uz) ? "ru" : locale
}

/** Browser SpeechSynthesis wrapper: availability, playing state, speak/stop. */
export function useSpeech() {
  const available = useSyncExternalStore(noopSubscribe, supported, () => false)
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (!supported()) return
    const synth = window.speechSynthesis
    const load = () => setVoices(synth.getVoices())
    load()
    synth.addEventListener("voiceschanged", load)
    return () => {
      synth.removeEventListener("voiceschanged", load)
      synth.cancel()
    }
  }, [])

  const stop = useCallback(() => {
    if (supported()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback((text: string, locale: Locale) => {
    if (!supported()) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = LANG[locale]
    const voice = findVoice(synth.getVoices(), LANG[locale])
    if (voice) u.voice = voice
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(u)
  }, [])

  return { available, speaking, voices, speak, stop }
}
