"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const TEXT = "Потратил 250 тысяч на краску — целевая";

export function HeroChat() {
  const [n, setN] = useState(0);
  const [stage, setStage] = useState<"typing" | "card">("typing");

  useEffect(() => {
    const t = setTimeout(
      () => {
        if (stage === "typing") {
          if (n < TEXT.length) setN(n + 1);
          else setStage("card");
        } else {
          setN(0);
          setStage("typing");
        }
      },
      stage === "card" ? 4200 : n === TEXT.length ? 700 : 45,
    );
    return () => clearTimeout(t);
  }, [n, stage]);

  return (
    <div className="ld-chat" aria-label="Пример диалога с Oydin">
      <div className="ld-chat-in">
        <span className="ld-mic" aria-hidden>🎙</span>
        <span>{TEXT.slice(0, n)}<i className="ld-caret" /></span>
      </div>
      <AnimatePresence>
        {stage === "card" && (
          <motion.div className="ld-card" initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="ld-card-h"><b>Записано</b><span>пример</span></div>
            <div className="ld-card-r"><span>Сумма</span><b>250 000 сум</b></div>
            <div className="ld-card-r"><span>Категория</span><b>Краска</b></div>
            <div className="ld-card-r"><span>Тип</span><b className="ld-ok">Целевая · бизнес</b></div>
            <div className="ld-card-r"><span>Конверт «Закупки»</span><b>осталось 2,5 млн</b></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
