// Запись голоса: MediaRecorder; автоостановка по паузе в речи или по сигналу stop (повторный тап по микрофону).
const MAX_MS = 55_000; // контракт: ≤ 60 с
const SILENCE_MS = 1800;
const SPEECH_LEVEL = 0.035;

function pickMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
}

export function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export async function recordVoice(stop: AbortSignal): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);

  return new Promise<Blob>((resolve, reject) => {
    let heardSpeech = false;
    let lastVoice = performance.now();
    const started = lastVoice;
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      const now = performance.now();
      if (peak > SPEECH_LEVEL) {
        heardSpeech = true;
        lastVoice = now;
      }
      if (now - started > MAX_MS || (heardSpeech && now - lastVoice > SILENCE_MS)) finish();
    }, 120);

    const cleanup = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    };
    const finish = () => rec.state !== "inactive" && rec.stop();
    rec.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }));
    };
    rec.onerror = () => {
      cleanup();
      reject(new Error("Не удалось записать звук"));
    };
    stop.addEventListener("abort", finish, { once: true });
    rec.start();
  });
}
