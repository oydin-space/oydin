"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { recordVoice, voiceErrorKind, voiceSupported, type VoiceErrorKind } from "./voice";

export type VoiceRecorderState = "idle" | "recording" | "processing";

const noopSubscribe = () => () => undefined;

/** Расширение файла по mime записи: Safari даёт mp4, Chrome/Firefox — webm/ogg. */
export function voiceFileName(blob: Blob): string {
  return `voice.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`;
}

/**
 * Тап — начать запись, второй тап — стоп. Готовый blob отдаётся в `onBlob` (state = processing, пока промис не завершится).
 * Любая ошибка (микрофон, сервер) уходит в `onError` с понятным видом; запись останавливается при размонтировании.
 */
export function useVoiceRecorder(onBlob: (blob: Blob) => Promise<void> | void, onError: (kind: VoiceErrorKind) => void) {
  const supported = useSyncExternalStore(noopSubscribe, voiceSupported, () => false);
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const stopRef = useRef<AbortController | null>(null);
  const cb = useRef({ onBlob, onError });
  useEffect(() => {
    cb.current = { onBlob, onError };
  });
  useEffect(() => () => stopRef.current?.abort(), []);

  const toggle = useCallback(async () => {
    if (stopRef.current) return stopRef.current.abort();
    const ctl = new AbortController();
    stopRef.current = ctl;
    setState("recording");
    try {
      const blob = await recordVoice(ctl.signal);
      stopRef.current = null;
      if (!blob.size) return;
      setState("processing");
      await cb.current.onBlob(blob);
    } catch (e) {
      cb.current.onError(voiceErrorKind(e));
    } finally {
      stopRef.current = null;
      setState("idle");
    }
  }, []);

  return { state, supported, toggle };
}
