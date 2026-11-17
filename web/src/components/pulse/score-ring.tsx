"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Tone } from "@/lib/types";
import { PASTEL_DEEP, TONE_PASTEL } from "@/lib/tone";

/** Кольцо индекса живучести (0–100). Мягкие концы, без резких цветов. */
export function ScoreRing({ score, tone, size = 132, label = true }: { score: number; tone: Tone; size?: number; label?: boolean }) {
  const reduce = useReducedMotion();
  const stroke = Math.max(6, size * 0.1);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(100, Math.max(0, score)) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Индекс живучести: ${score} из 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.6)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={PASTEL_DEEP[TONE_PASTEL[tone]]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - frac) : c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="tabular font-semibold" style={{ fontSize: size * 0.3 }}>
          {score}
        </span>
        {label ? <span className="mt-1 text-[0.7rem] text-ink/60">живучесть</span> : null}
      </div>
    </div>
  );
}
