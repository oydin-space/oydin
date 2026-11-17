import Link from "next/link";
import { Logo } from "./logo";

export function Nav() {
  return (
    <header className="ld-nav">
      <Link href="/" className="ld-brand"><Logo /><span>Oydin</span></Link>
      <nav className="ld-links" aria-label="Разделы">
        <a href="#features">Возможности</a>
        <a href="#case">Кейс</a>
        <a href="#pricing">Тарифы</a>
        <a href="#faq">FAQ</a>
      </nav>
      <Link href="/app" className="ld-btn">Открыть демо</Link>
    </header>
  );
}
