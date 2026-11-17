import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Сгруппированный список как в iOS: общая рамка, разделители, без теней. */
export function ListGroup({ header, footer, className, children, ...props }: React.ComponentProps<"section"> & { header?: string; footer?: string }) {
  return (
    <section className={cn("flex flex-col gap-1.5", className)} {...props}>
      {header ? <h2 className="px-4 text-caption font-medium uppercase tracking-wide text-muted-foreground">{header}</h2> : null}
      <ul className="inset-group divide-y divide-border border border-border bg-card">{children}</ul>
      {footer ? <p className="px-4 text-caption text-muted-foreground">{footer}</p> : null}
    </section>
  );
}

export interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Иконка или логотип слева (без декоративной плитки вокруг иконки). */
  leading?: React.ReactNode;
  /** Сумма/значение справа. */
  trailing?: React.ReactNode;
  status?: React.ReactNode;
  /** Строка целиком — кнопка (или ссылка при href). Вложенных кнопок внутри нет. */
  onClick?: () => void;
  href?: string;
  chevron?: boolean;
  /** Заголовок переносится до 2 строк вместо усечения в одну. */
  wrapTitle?: boolean;
  className?: string;
}

const rowClass = "focus-ring flex min-h-row w-full items-center gap-3 px-4 py-2 text-left";

export function ListRow({ title, subtitle, leading, trailing, status, onClick, href, chevron, wrapTitle, className }: ListRowProps) {
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-body text-foreground", wrapTitle ? "line-clamp-2 break-words" : "truncate")}>{title}</span>
        {subtitle ? <span className="truncate text-small text-muted-foreground">{subtitle}</span> : null}
      </span>
      {status ? <span className="shrink-0">{status}</span> : null}
      {trailing ? <span className="shrink-0 text-body font-medium tabular-nums">{trailing}</span> : null}
      {chevron || onClick || href ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        href.startsWith("/") ? (
          <Link href={href} className={cn(rowClass, "state-layer", className)}>
            {body}
          </Link>
        ) : (
          <a href={href} className={cn(rowClass, "state-layer", className)}>
            {body}
          </a>
        )
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cn(rowClass, "state-layer press", className)}>
          {body}
        </button>
      ) : (
        <div className={cn(rowClass, className)}>{body}</div>
      )}
    </li>
  );
}
