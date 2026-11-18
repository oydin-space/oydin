import { ApiError } from "./api";

// Запись голоса: MediaRecorder; автоостановка по паузе в речи или по сигналу stop (повторный тап по микрофону).
const MAX_MS = 55_000; // контракт: ≤ 60 с
const SILENCE_MS = 1800;
const SPEECH_LEVEL = 0.035;

// Safari (iOS и macOS) пишет только audio/mp4; Chrome/Firefox — webm/opus. Порядок зависит от движка.
function isSafari(): boolean {
  return typeof navigator !== "undefined" && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
}

function pickMime(): string | undefined {
  const candidates = isSafari()
    ? ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
}

export function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export type VoiceErrorKind = "denied" | "unavailable" | "failed";

/** Почему не вышло: нет доступа к микрофону / сервер не распознаёт (ключ ИИ, лимит, формат) / запись сломалась. */
export function voiceErrorKind(e: unknown): VoiceErrorKind {
  if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError" || e.name === "NotFoundError")) return "denied";
  if (e instanceof ApiError) return "unavailable";
  return "failed";
}

export async function recordVoice(stop: AbortSignal): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => stream.getTracks().forEach((t) => t.stop());
  let rec: MediaRecorder;
  const mime = pickMime();
  try {
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch (e) {
    release();
    throw e;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Автостоп по тишине — удобство; если AudioContext недоступен (старый iOS), запись всё равно идёт, стоп по тапу.
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  try {
    ctx = new AudioContext();
    void ctx.resume();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
  } catch {
    analyser = null;
  }
  const buf = new Uint8Array(512);

  return new Promise<Blob>((resolve, reject) => {
    let heardSpeech = false;
    let lastVoice = performance.now();
    const started = lastVoice;
    const timer = setInterval(() => {
      const now = performance.now();
      let peak = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      }
      if (peak > SPEECH_LEVEL) {
        heardSpeech = true;
        lastVoice = now;
      }
      if (now - started > MAX_MS || (heardSpeech && now - lastVoice > SILENCE_MS)) finish();
    }, 120);

    const cleanup = () => {
      clearInterval(timer);
      release();
      void ctx?.close();
    };
    const finish = () => rec.state !== "inactive" && rec.stop();
    rec.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }));
    };
    rec.onerror = () => {
      cleanup();
      reject(new Error("voice_record_failed"));
    };
    stop.addEventListener("abort", finish, { once: true });
    rec.start(1000);
    if (stop.aborted) finish();
  });
}
