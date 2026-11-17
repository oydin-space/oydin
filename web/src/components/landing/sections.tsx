import Link from "next/link";
import { CrayonImage } from "./crayon-image";
import { Faq, type FaqItem } from "./faq";
import { HeroChat } from "./hero-chat";
import { Logo } from "./logo";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="ld-hero">
      <Reveal className="ld-hero-copy">
        <span className="ld-pill">Для малого бизнеса Узбекистана</span>
        <h1>Второй мозг для вашего бизнеса</h1>
        <p>Oydin видит кассовые разрывы заранее, отделяет личные траты от бизнеса и записывает расходы голосом за 5 секунд.</p>
        <div className="ld-cta">
          <Link href="/app" className="ld-btn ld-btn-lg">Открыть демо</Link>
          <a href="#features" className="ld-btn-ghost">Как это работает</a>
        </div>
      </Reveal>
      <Reveal delay={0.15} className="ld-hero-vis">
        <CrayonImage src="/brand/hero.png" fallback="🌼" className="ld-hero-img" />
        <HeroChat />
      </Reveal>
    </section>
  );
}

const problems = [
  { t: "Кассовые разрывы", d: "Деньги на счёте есть, а платить аренду и налоги в пятницу нечем. Обычно это становится видно слишком поздно.", c: "#FFE9C7" },
  { t: "Личное и бизнес в одном кошельке", d: "Поставщик, продукты, кредит — всё в одной куче. Непонятно, сколько бизнес зарабатывает на самом деле.", c: "#E6E4FB" },
];

export function Problem() {
  return (
    <section className="ld-sec" id="problem">
      <Reveal><h2>Знакомо?</h2></Reveal>
      <div className="ld-grid2">
        {problems.map((p, i) => (
          <Reveal key={p.t} delay={i * 0.1}>
            <div className="ld-block" style={{ background: p.c }}><h3>{p.t}</h3><p>{p.d}</p></div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const features = [
  { t: "Пульс", d: "Живой показатель здоровья бизнеса: хватает ли денег, как идут продажи и где просадка.", i: "pulse", e: "💓", c: "#FFE3E0" },
  { t: "Календарь платежей и конверты", d: "Все обязательные платежи на шкале времени. Деньги раскладываются по конвертам заранее.", i: "calendar", e: "🗓", c: "#DDF1E4" },
  { t: "Голосом за 5 секунд", d: "Скажите трату — Oydin определит сумму, категорию и целевая ли она.", i: "voice", e: "🎙", c: "#FFF1B8" },
  { t: "Инсайты рынка", d: "Подсказки на основе рыночных данных: цены, сезонность, спрос в вашей нише.", i: "insights", e: "🔎", c: "#DCEBFA" },
];

export function Features() {
  return (
    <section className="ld-sec" id="features">
      <Reveal><h2>Четыре вещи, которые делают жизнь спокойнее</h2></Reveal>
      <div className="ld-grid4">
        {features.map((f, i) => (
          <Reveal key={f.t} delay={i * 0.08}>
            <div className="ld-block ld-feat" style={{ background: f.c }}>
              <CrayonImage src={`/brand/icons/${f.i}.png`} fallback={f.e} className="ld-feat-ic" />
              <h3>{f.t}</h3><p>{f.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Case() {
  const nums = [["2,5 млн", "свободных денег после платежей"], ["12 дней", "до ближайшего кассового разрыва"], ["−18%", "личных трат из бизнес-кошелька"]];
  return (
    <section className="ld-sec" id="case">
      <Reveal>
        <div className="ld-case">
          <span className="ld-pill">Кейс · Print Lab</span>
          <h2>Печатная студия, которой не хватало ясности</h2>
          <p>Так может выглядеть первый месяц с Oydin. Цифры ниже — пример для демо, не реальные результаты клиента.</p>
          <div className="ld-nums">
            {nums.map(([n, l]) => (
              <div key={n}><b>{n}</b><span>{l}</span><em>пример</em></div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Pricing() {
  return (
    <section className="ld-sec" id="pricing">
      <Reveal><h2>Тарифы</h2></Reveal>
      <div className="ld-grid2">
        <Reveal><div className="ld-block" style={{ background: "#EEF3E2" }}><h3>Free</h3><div className="ld-price">0 сум</div><p>Пульс, учёт расходов голосом и текстом, базовый календарь платежей.</p></div></Reveal>
        <Reveal delay={0.1}><div className="ld-block" style={{ background: "#FFF1B8" }}><h3>Pro</h3><div className="ld-price">99 000 сум <small>/ мес</small></div><p>Конверты, инсайты рынка и AI-чат без ограничений.</p></div></Reveal>
      </div>
      <Reveal><p className="ld-note">Цена и состав тарифов — гипотеза, проверяем на пилотных клиентах.</p></Reveal>
    </section>
  );
}

export function Partners() {
  const items = ["Банки-партнёры", "ТПП Узбекистана"];
  return (
    <section className="ld-sec">
      <Reveal>
        <div className="ld-partners">
          <h2>Партнёры — гипотеза</h2>
          <p>Планируем обсуждать интеграции и каналы дистрибуции. Партнёрства пока не заключены.</p>
          <div className="ld-chips">{items.map((x) => <span key={x}>{x} · гипотеза</span>)}</div>
        </div>
      </Reveal>
    </section>
  );
}

const faq: FaqItem[] = [
  { q: "Что с налогами?", a: "Oydin напоминает о сроках платежей и откладывает деньги в отдельный конверт. Он не заменяет бухгалтера и не сдаёт отчётность за вас." },
  { q: "Насколько безопасны мои данные?", a: "Данные передаются по защищённому соединению и используются только для вашего аккаунта. Мы не продаём данные третьим лицам." },
  { q: "Нужно ли подключать банк?", a: "Нет. Достаточно говорить или писать траты — банковские интеграции рассматриваем как следующий шаг." },
  { q: "На каких языках работает голос?", a: "Сейчас основной язык — русский. Узбекский — в планах." },
  { q: "Сколько стоит?", a: "Есть бесплатный тариф. Pro — 99 000 сум в месяц (предварительная цена)." },
];

export function FaqSection() {
  return (
    <section className="ld-sec ld-narrow" id="faq">
      <Reveal><h2>Частые вопросы</h2></Reveal>
      <Faq items={faq} />
    </section>
  );
}

export function Footer() {
  return (
    <footer className="ld-footer">
      <Reveal>
        <div className="ld-final">
          <h2>Попробуйте Oydin на демо-данных</h2>
          <Link href="/app" className="ld-btn ld-btn-lg">Открыть демо</Link>
        </div>
      </Reveal>
      <div className="ld-foot-row"><span className="ld-brand"><Logo size={28} /><span>Oydin</span></span><span>© Oydin · Хакатон, демо-версия</span></div>
    </footer>
  );
}
